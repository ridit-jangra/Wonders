import Icon from "@hackclub/icons";
import type { ProjectWithOwner } from "@/lib/projects";
import { Badge, Callout, Card, CardHeader, Mono, Muted, Quote } from "./ui";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const STATUS: Record<string, { label: string; tone: Tone }> = {
  clear: { label: "Passed", tone: "success" },
  flagged: { label: "Flagged", tone: "warning" },
  sent_back: { label: "Sent back", tone: "danger" },
  error: { label: "Errored", tone: "warning" },
  pending: { label: "Running", tone: "info" },
};

function repoLine(state: string) {
  if (state === "ok") return { tone: "success" as Tone, text: "GitHub repo found and public" };
  if (state === "not_found") return { tone: "danger" as Tone, text: "GitHub repo not found or private" };
  if (state === "skipped") return { tone: "neutral" as Tone, text: "Not a GitHub repo, not checked" };
  return { tone: "warning" as Tone, text: "GitHub repo could not be checked" };
}

function demoLine(state: string, status: number | null) {
  const code = status ? ` (HTTP ${status})` : "";
  if (state === "ok") return { tone: "success" as Tone, text: `Demo link loads${code}` };
  if (state === "dead") return { tone: "danger" as Tone, text: `Demo link is dead${code}` };
  return { tone: "warning" as Tone, text: `Demo link could not be checked${code}` };
}

function readmeLine(state: string) {
  if (state === "present") return { tone: "success" as Tone, text: "README found" };
  if (state === "missing") return { tone: "danger" as Tone, text: "No README in the repo" };
  return { tone: "neutral" as Tone, text: "README not checked" };
}

export default function AutoCheckCard({ project }: { project: ProjectWithOwner }) {
  const status = project.ai_review_status;
  if (status === "none") {
    return null;
  }

  const findings = project.ai_review_findings;
  const verified =
    !findings ||
    findings.checks.repo === "ok" ||
    findings.checks.demo === "ok" ||
    findings.checks.readme === "present";
  const meta =
    status === "clear" && !verified
      ? { label: "Not checked", tone: "neutral" as Tone }
      : (STATUS[status] ?? { label: status, tone: "neutral" as Tone });
  const rows = findings
    ? [
        repoLine(findings.checks.repo),
        demoLine(findings.checks.demo, findings.checks.demoStatus),
        readmeLine(findings.checks.readme),
      ]
    : [];

  return (
    <Card>
      <details className="hc-collapse" open={status !== "clear" || !verified}>
      <summary>
        <CardHeader
          title="Auto-check"
          icon="important"
          action={
            <span className="flex items-center gap-2">
              <Badge tone={meta.tone}>{meta.label}</Badge>
              <Icon glyph="view-forward" size={20} className="hc-chevron hc-muted" />
            </span>
          }
        />
      </summary>

      {status === "pending" && (
        <Muted>The checks are still running. This refreshes when you reload.</Muted>
      )}

      {project.ai_review_summary && <p className="mb-3">{project.ai_review_summary}</p>}

      {rows.length > 0 && (
        <ul className="mb-3 flex flex-col gap-1.5 text-sm">
          {rows.map((row) => (
            <li key={row.text} className="flex items-center gap-2">
              <Badge tone={row.tone}>
                {row.tone === "success" ? "ok" : row.tone === "danger" ? "miss" : "?"}
              </Badge>
              {row.text}
            </li>
          ))}
        </ul>
      )}

      {findings && findings.blocking.length > 0 && (
        <div className="mb-3">
          <Callout tone={findings.sentBack ? "danger" : "warning"}>
            <div className="font-bold">
              {findings.sentBack ? "Sent back to the player for:" : "Misses a person should look at:"}
            </div>
            <ul className="mt-1 list-disc pl-5">
              {findings.blocking.map((item) => (
                <li key={item.id}>
                  {item.label}
                  {item.evidence && (
                    <>
                      {" "}
                      <Muted>({item.evidence})</Muted>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </Callout>
        </div>
      )}

      {findings && findings.notes.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-sm font-bold">Notes</div>
          <ul className="list-disc pl-5 text-sm">
            {findings.notes.map((note) => (
              <li key={note} className="whitespace-pre-line">
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {findings && (findings.redFlags.length > 0 || findings.strengths.length > 0) && (
        <div className="mb-3 flex flex-wrap gap-2">
          {findings.redFlags.map((flag) => (
            <Badge key={flag} tone="danger">
              {flag}
            </Badge>
          ))}
          {findings.strengths.map((strength) => (
            <Badge key={strength} tone="success">
              {strength}
            </Badge>
          ))}
        </div>
      )}

      {findings?.review && (
        <div className="mb-3">
          <div className="mb-1 text-sm font-bold">Reviewer notes</div>
          <Quote>{findings.review}</Quote>
        </div>
      )}

      {findings && findings.skipped.length > 0 && (
        <p className="text-sm">
          <Muted>Could not run: {findings.skipped.join("; ")}</Muted>
        </p>
      )}

      <p className="mt-3 text-xs">
        <Muted>
          {project.ai_review_model && <Mono>{project.ai_review_model}</Mono>}
          {project.ai_reviewed_at && (
            <>
              {" "}
              · <Mono>{new Date(project.ai_reviewed_at).toLocaleString()}</Mono>
            </>
          )}
          {" "}· written to help the reviewer, never a verdict
        </Muted>
      </p>
      </details>
    </Card>
  );
}
