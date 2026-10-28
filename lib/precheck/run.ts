import "server-only";
import { writeAudit } from "@/lib/audit";
import { notifyPlayerNow } from "@/lib/notifications";
import { recordProjectHistory } from "@/lib/project-history";
import { recordReview } from "@/lib/reviews";
import { findOtherYswsEntries } from "@/lib/ysws";
import {
  BLOCKING,
  classifyRepoStatus,
  evaluate,
  MAX_AUTO_SENDBACKS,
  parseGithubRepo,
  reviewNoteFor,
  shouldSendBack,
  type AiAnswer,
  type BlockingId,
  type DemoState,
  type RepoState,
} from "./rules";
import {
  AiProviderError,
  askModel,
  demoStateOf,
  fetchCommitInfo,
  fetchFileList,
  fetchReadme,
  fetchRepoMeta,
  PRECHECK_MODEL,
  probeUrl,
  type CommitInfo,
  type ProbeResult,
} from "./sources";
import {
  finishPrecheck,
  getPrecheckProject,
  sendBackAfterPrecheck,
  type AutoCheckFindings,
} from "./store";

export const AUTO_CHECK_REVIEWER = "wonders-auto-check";

export function precheckEnabled(): boolean {
  return (process.env.AI_PRECHECK ?? "").toLowerCase() !== "off";
}

function commitNotes(commits: CommitInfo[]): string[] {
  const notes: string[] = [];
  if (commits.length === 1) {
    notes.push("Only one commit in the repo, so the work was not built up over time.");
  } else if (commits.length >= 2) {
    const times = commits
      .map((commit) => Date.parse(commit.date))
      .filter((time) => Number.isFinite(time));
    if (times.length >= 2 && Math.max(...times) - Math.min(...times) < 60 * 60 * 1000) {
      notes.push("All the recent commits landed within one hour.");
    }
  }
  return notes;
}

function aiProviderNote(error: unknown): string {
  if (error instanceof AiProviderError) {
    return `AI review unavailable (provider returned ${error.status})`;
  }
  return "AI review unavailable (the request failed)";
}

export async function runPrecheck(projectId: number, token: string): Promise<void> {
  try {
    const project = await getPrecheckProject(projectId);
    if (
      !project ||
      project.status !== "in_review" ||
      project.ai_review_status !== "pending" ||
      project.ai_review_token !== token
    ) {
      return;
    }

    const ref = parseGithubRepo(project.github_url);
    const [probe, meta] = await Promise.all([
      project.link_url ? probeUrl(project.link_url) : Promise.resolve<ProbeResult | null>(null),
      ref ? fetchRepoMeta(ref) : Promise.resolve(null),
    ]);

    const demo: DemoState = probe ? demoStateOf(probe) : "unknown";
    const repo: RepoState | "skipped" = ref && meta ? classifyRepoStatus(meta.status) : "skipped";

    let readme: string | null | undefined;
    let files: string[] = [];
    let commits: CommitInfo[] = [];
    if (ref && repo === "ok") {
      [readme, files, commits] = await Promise.all([
        fetchReadme(ref),
        fetchFileList(ref, meta?.defaultBranch ?? "HEAD"),
        fetchCommitInfo(ref),
      ]);
    }

    const sendbacks = project.ai_precheck_sendbacks;
    const hardMiss =
      repo === "not_found" || demo === "dead" || (repo === "ok" && readme === null);
    const willSendBack = hardMiss && sendbacks < MAX_AUTO_SENDBACKS;

    let ai: AiAnswer | null = null;
    let aiNote: string | null = null;
    let otherYsws: string[] = [];
    if (!willSendBack) {
      const matches = await findOtherYswsEntries({
        githubUrl: project.github_url,
        demoUrl: project.link_url,
      }).catch(() => ({ ok: false, matches: [] }));
      otherYsws = matches.matches.map((match) => `- ${match.entry.ysws}: ${match.name}`);

      if (typeof readme === "string") {
        if (!process.env.OPENROUTER_API_KEY) {
          aiNote = "AI review is not configured";
        } else {
          try {
            ai = await askModel({
              title: project.title,
              description: project.description,
              repoUrl: project.github_url,
              demoUrl: project.link_url,
              readme,
              files,
              commits,
              otherYsws,
            });
            if (!ai) {
              aiNote = "AI review returned an answer that could not be read";
            }
          } catch (error) {
            aiNote = aiProviderNote(error);
          }
        }
      }
    }

    const findings = evaluate({ repo, demo, readme, ai });
    const skipped = [
      ...findings.skipped.filter((item) => !item.startsWith("README content check")),
      ...(aiNote ? [aiNote] : []),
    ];
    const sendBack = shouldSendBack(findings.blocking, sendbacks);

    const notes = [
      ...(ai?.notes ?? []),
      ...commitNotes(commits),
      ...(otherYsws.length > 0 ? [`Already shipped to another YSWS:\n${otherYsws.join("\n")}`] : []),
    ];

    const details: AutoCheckFindings = {
      checks: {
        repo,
        demo,
        demoStatus: probe?.status ?? null,
        readme: readme === null ? "missing" : typeof readme === "string" ? "present" : "unknown",
      },
      blocking: findings.blocking.map((id: BlockingId) => ({
        id,
        label: BLOCKING[id],
        evidence: id === "what_it_is" || id === "how_to_run" ? (findings.evidence[id] ?? "") : "",
      })),
      skipped,
      notes,
      redFlags: ai?.redFlags ?? [],
      strengths: ai?.strengths ?? [],
      review: ai?.review ?? "",
      sentBack: sendBack,
    };
    const summary = ai?.summary ?? "";
    const error = skipped.join("; ");

    if (!sendBack) {
      const saved = await finishPrecheck(projectId, token, {
        status: findings.blocking.length > 0 ? "flagged" : "clear",
        summary,
        findings: details,
        error,
        model: PRECHECK_MODEL,
      });
      if (saved) {
        await writeAudit({
          actor: AUTO_CHECK_REVIEWER,
          action: findings.blocking.length > 0 ? "precheck.flagged" : "precheck.clear",
          target: `project:${projectId}`,
          detail: { blocking: findings.blocking, skipped },
        });
      }
      return;
    }

    const note = reviewNoteFor(findings.blocking);
    const sent = await sendBackAfterPrecheck(projectId, token, note, {
      summary,
      findings: details,
      error,
      model: PRECHECK_MODEL,
    });
    if (!sent) {
      return;
    }

    await recordProjectHistory({
      projectId,
      profileId: project.profile_id,
      fromStatus: "in_review",
      toStatus: "rejected",
      reviewerNote: note,
      reward: null,
      reviewedBy: AUTO_CHECK_REVIEWER,
    });
    await writeAudit({
      actor: AUTO_CHECK_REVIEWER,
      action: "precheck.sent_back",
      target: `project:${projectId}`,
      detail: { blocking: findings.blocking },
    });
    await recordReview({
      projectId,
      pass: "first",
      verdict: "changes_requested",
      feedback: note,
      technicalNotes: findings.blocking
        .map((id) => {
          const evidence = findings.evidence[id as "what_it_is" | "how_to_run"];
          return `${id}${evidence ? `: ${evidence}` : ""}`;
        })
        .join("\n"),
      additionalNotes: "Sent back by the automatic check right after shipping.",
      checks: [],
      reviewedBy: AUTO_CHECK_REVIEWER,
    });
    await notifyPlayerNow(project.owner_slack_id, "auto_check_sent_back", {
      title: project.title,
      note: findings.blocking.map((id) => `• ${BLOCKING[id]}`).join("\n"),
    });
  } catch (error) {
    console.error("[precheck] run failed", projectId, (error as Error)?.message ?? error);
    try {
      await finishPrecheck(projectId, token, {
        status: "error",
        summary: "",
        findings: null,
        error: String((error as Error)?.message ?? error),
        model: PRECHECK_MODEL,
      });
    } catch {}
  }
}
