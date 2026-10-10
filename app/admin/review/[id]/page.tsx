/* eslint-disable @next/next/no-img-element */
import { Suspense } from "react";
import { LinkExternalIcon, MarkGithubIcon } from "@primer/octicons-react";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import {
  adminUpdateProject,
  firstPassReview,
  getProjectWithOwner,
  secondPassReview,
  setProjectHold,
} from "@/lib/projects";
import { getProjectHistory, recordProjectHistory } from "@/lib/project-history";
import { notifyPlayer } from "@/lib/notifications";
import {
  deleteReviewDraft,
  getProjectReviews,
  getReviewDraft,
  recordReview,
  saveReviewDraft,
  SECOND_PASS_CHECKS,
} from "@/lib/reviews";
import {
  ActionButton,
  Avatar,
  Badge,
  ButtonLink,
  Callout,
  Card,
  CardHeader,
  CountBadge,
  DescriptionList,
  Field,
  HistoryTimeline,
  Input,
  Mono,
  Muted,
  StatusBadge,
  Textarea,
  TextLink,
} from "../../components/ui";
import Markdown from "../../components/Markdown";
import Tabs from "../../components/Tabs";
import ReviewPassForm, { type DraftInput, type DraftResult } from "../../components/ReviewPassForm";
import { CommitsPanel, HackatimePanel, PanelLoading, PastReviewsPanel, YswsPanel } from "./panels";

const MIN_AUDIT_LENGTH = 20;
const MIN_FEEDBACK_LENGTH = 10;

function revalidateReview(id: string) {
  revalidatePath("/dashboard");
  revalidatePath("/wonders");
  revalidatePath("/explore");
  revalidatePath("/admin/fulfillment");
  revalidatePath("/admin");
  revalidatePath("/admin/review");
  revalidatePath(`/admin/review/${id}`);
}

function optionalUrl(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }
  return text;
}

export default async function AdminReviewPanelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdmin();

  const [project, history, reviews] = await Promise.all([
    getProjectWithOwner(id),
    getProjectHistory(id),
    getProjectReviews(id),
  ]);
  if (!project) notFound();

  let currentPass: "first" | "second" | null = null;
  if (project.status === "in_review") {
    currentPass = "first";
  } else if (project.status === "second_pass") {
    currentPass = "second";
  }

  let draft = null;
  if (currentPass) {
    draft = await getReviewDraft(id, currentPass);
  }

  async function autosaveDraft(input: DraftInput): Promise<DraftResult> {
    "use server";
    const admin = await requireAdmin();
    const existing = await getProjectWithOwner(id);
    if (!existing) {
      return { ok: false, savedAt: null };
    }

    let pass: "first" | "second" | null = null;
    if (existing.status === "in_review") {
      pass = "first";
    } else if (existing.status === "second_pass") {
      pass = "second";
    }
    if (!pass) {
      return { ok: false, savedAt: null };
    }

    const checks: string[] = [];
    if (Array.isArray(input.checks)) {
      for (const value of input.checks) {
        for (const check of SECOND_PASS_CHECKS) {
          if (check.key === value && !checks.includes(value)) {
            checks.push(value);
          }
        }
      }
    }

    const savedAt = await saveReviewDraft({
      projectId: id,
      pass,
      technicalNotes: String(input.technicalNotes ?? "").slice(0, 20000),
      additionalNotes: String(input.additionalNotes ?? "").slice(0, 20000),
      feedback: String(input.feedback ?? "").slice(0, 20000),
      checks,
      updatedBy: admin.slackId,
    });

    return { ok: true, savedAt };
  }

  async function submitReview(formData: FormData) {
    "use server";
    const admin = await requireAdmin();
    const existing = await getProjectWithOwner(id);
    if (!existing) notFound();

    let pass: "first" | "second" | null = null;
    if (existing.status === "in_review") {
      pass = "first";
    } else if (existing.status === "second_pass") {
      pass = "second";
    }
    if (!pass) {
      return;
    }

    const verdictValue = String(formData.get("verdict") ?? "");
    if (verdictValue !== "approved" && verdictValue !== "changes_requested") {
      return;
    }
    const verdict: "approved" | "changes_requested" = verdictValue;

    const feedback = String(formData.get("feedback") ?? "").trim();
    const technicalNotes = String(formData.get("technical_notes") ?? "").trim();
    const additionalNotes = String(formData.get("additional_notes") ?? "").trim();
    if (feedback.length < MIN_FEEDBACK_LENGTH) {
      return;
    }
    if (technicalNotes.length < MIN_AUDIT_LENGTH || additionalNotes.length < MIN_AUDIT_LENGTH) {
      return;
    }

    const checks: string[] = [];
    for (const value of formData.getAll("checks")) {
      const key = String(value);
      for (const check of SECOND_PASS_CHECKS) {
        if (check.key === key && !checks.includes(key)) {
          checks.push(key);
        }
      }
    }
    if (pass === "second" && verdict === "approved" && checks.length !== SECOND_PASS_CHECKS.length) {
      return;
    }

    let ok = false;
    let toStatus: "second_pass" | "shipped" | "rejected" = "rejected";
    if (pass === "first") {
      ok = await firstPassReview(id, verdict, feedback);
      if (verdict === "approved") {
        toStatus = "second_pass";
      }
    } else {
      ok = await secondPassReview(id, verdict, feedback);
      if (verdict === "approved") {
        toStatus = "shipped";
      }
    }

    if (ok) {
      await deleteReviewDraft(id, pass);
      await recordReview({
        projectId: id,
        pass,
        verdict,
        feedback,
        technicalNotes,
        additionalNotes,
        checks,
        reviewedBy: admin.slackId,
      });
      await recordProjectHistory({
        projectId: id,
        profileId: existing.profile_id,
        fromStatus: existing.status,
        toStatus,
        reviewerNote: feedback,
        reward: existing.reward,
        reviewedBy: admin.slackId,
      });

      let event: "first_pass_approved" | "second_pass_approved" | "changes_requested" = "changes_requested";
      if (toStatus === "second_pass") {
        event = "first_pass_approved";
      } else if (toStatus === "shipped") {
        event = "second_pass_approved";
      }
      notifyPlayer(existing.profile?.slack_id, event, { title: existing.title, note: feedback });
    }

    revalidateReview(id);
  }

  async function putOnHold(formData: FormData) {
    "use server";
    await requireAdmin();
    const existing = await getProjectWithOwner(id);
    if (!existing) notFound();

    const reason = String(formData.get("hold_reason") ?? "").trim();
    if (!reason) {
      return;
    }

    await setProjectHold(id, true, reason);
    revalidateReview(id);
  }

  async function releaseHold() {
    "use server";
    await requireAdmin();
    const existing = await getProjectWithOwner(id);
    if (!existing) notFound();

    await setProjectHold(id, false, null);
    revalidateReview(id);
  }

  async function editSubmission(formData: FormData) {
    "use server";
    await requireAdmin();
    const existing = await getProjectWithOwner(id);
    if (!existing) notFound();

    const title = String(formData.get("title") ?? "").trim();
    if (!title) {
      return;
    }

    await adminUpdateProject(id, {
      title,
      description: String(formData.get("description") ?? "").trim(),
      image_url: optionalUrl(formData.get("image_url")),
      link_url: optionalUrl(formData.get("link_url")),
      github_url: optionalUrl(formData.get("github_url")),
    });

    revalidateReview(id);
  }

  const owner = project.profile;
  const ownerName = owner?.name || owner?.slack_display_name || owner?.email || "Unknown user";
  const isReviewable = project.status === "in_review" || project.status === "second_pass";

  let firstPassReviewEntry = null;
  for (const review of reviews) {
    if (review.pass === "first" && review.verdict === "approved" && !firstPassReviewEntry) {
      firstPassReviewEntry = review;
    }
  }

  const passSummary =
    project.status === "second_pass" && firstPassReviewEntry ? (
      <Callout tone="info" icon="view-reload">
        Audit notes and the note to the user are prefilled from the first pass by{" "}
        <Mono>{firstPassReviewEntry.reviewed_by}</Mono>. Edit anything you disagree with.
      </Callout>
    ) : null;

  const reviewTab = (
    <div className="flex flex-col gap-4 pt-4">
      {project.status === "in_review" && (
        <Card>
          <h3 className="hc-heading text-base">First pass</h3>
          <p className="hc-caption mt-1 mb-4 text-sm">
            Every verdict needs a note. Approving sends this to second pass for a final check, so your
            first look is still a proposal.
          </p>
          <ReviewPassForm
            pass="first"
            action={submitReview}
            checks={[]}
            autosave={autosaveDraft}
            initialTechnical={draft?.technical_notes ?? ""}
            initialAdditional={draft?.additional_notes ?? ""}
            initialFeedback={draft?.feedback ?? ""}
            initialSavedAt={draft?.updated_at ?? null}
            initialSavedBy={draft?.updated_by ?? null}
          />
        </Card>
      )}

      {project.status === "second_pass" && (
        <Card>
          <h3 className="hc-heading text-base">Second pass</h3>
          <p className="hc-caption mt-1 mb-4 text-sm">
            Final review. Tick every check before approving. Approving ships it: it goes public on Explore and moves to Fulfillment.
          </p>
          <ReviewPassForm
            pass="second"
            action={submitReview}
            checks={SECOND_PASS_CHECKS}
            summary={passSummary}
            autosave={autosaveDraft}
            initialTechnical={draft ? draft.technical_notes : firstPassReviewEntry?.technical_notes ?? ""}
            initialAdditional={draft ? draft.additional_notes : firstPassReviewEntry?.additional_notes ?? ""}
            initialFeedback={draft ? draft.feedback : firstPassReviewEntry?.feedback ?? ""}
            initialChecks={draft?.checks ?? []}
            initialSavedAt={draft?.updated_at ?? null}
            initialSavedBy={draft?.updated_by ?? null}
          />
        </Card>
      )}

      {project.status === "building" && (
        <Callout tone="neutral" icon="code">
          Still being built. It shows up for review once the user ships it.
        </Callout>
      )}

      {project.status === "rejected" && (
        <Callout tone="danger" icon="forbidden">
          Changes requested. The user can edit and reship it for another review.
          {project.reviewer_note && <p className="mt-2">&ldquo;{project.reviewer_note}&rdquo;</p>}
        </Callout>
      )}

      {(project.status === "shipped" || project.status === "fulfillment_started") && (
        <Callout tone="success" icon="send">
          Live on /wonders.{" "}
          <TextLink href="/admin/fulfillment" className="font-bold">
            Manage the reward in Fulfillment
          </TextLink>
        </Callout>
      )}

      {project.status === "fulfilled" && (
        <Callout tone="success" icon="check-circle">
          Reward order complete.
        </Callout>
      )}
    </div>
  );

  const overviewTab = (
    <div className="flex flex-col gap-4 pt-4">
      <Card>
        <DescriptionList
          items={[
            ["Status", <StatusBadge key="status" status={project.status} />],
            ["Wonder", <Mono key="id">#{project.id}</Mono>],
            ["Created", <Mono key="created">{new Date(project.created_at).toLocaleString()}</Mono>],
            ["Email", owner?.email],
            [
              "Repo",
              project.github_url ? (
                <TextLink key="repo" href={project.github_url} external>
                  {project.github_url}
                </TextLink>
              ) : null,
            ],
            [
              "Demo",
              project.link_url ? (
                <TextLink key="demo" href={project.link_url} external>
                  {project.link_url}
                </TextLink>
              ) : null,
            ],
          ]}
        />
      </Card>
      <Card>
        <CardHeader title="History" icon="history" count={history.length} />
        <HistoryTimeline entries={history} />
      </Card>
    </div>
  );

  const actionsTab = (
    <div className="flex flex-col gap-4 pt-4">
      {isReviewable && (
      <Card>
        <CardHeader title={project.on_hold ? "On hold" : "Put this review on hold"} icon="important" />
        {project.on_hold ? (
          <form action={releaseHold} className="flex flex-col gap-3">
            <Callout tone="warning">&ldquo;{project.hold_reason}&rdquo;</Callout>
            <div className="[&>button]:w-full">
              <ActionButton pendingLabel="Releasing…">
                Release hold
              </ActionButton>
            </div>
          </form>
        ) : (
          <form action={putOnHold} className="flex flex-col gap-3">
            <p className="hc-caption text-sm">
              Parks this wonder so other reviewers know to leave it alone. It stays in the queue with an On hold tag.
            </p>
            <Textarea name="hold_reason" rows={3} placeholder="Why is this on hold? Other reviewers will see it." />
            <div className="[&>button]:w-full">
              <ActionButton pendingLabel="Holding…">
                Put on hold
              </ActionButton>
            </div>
          </form>
        )}
      </Card>
      )}
      <Card>
        <CardHeader title="Edit submission" icon="edit" />
        <EditSubmissionForm project={project} action={editSubmission} />
      </Card>
    </div>
  );

  const rightTabs = [
    { key: "review", label: "Review", content: reviewTab },
    { key: "actions", label: "Actions", content: actionsTab },
    { key: "overview", label: "Overview", content: overviewTab },
  ];

  return (
    <div className="hc-review grid gap-6 lg:grid-cols-[minmax(0,1fr)_460px] xl:gap-8">
      <div className="flex min-w-0 flex-col gap-6">
        <div>
          <ButtonLink href="/admin/review" variant="ghost" size="sm" icon="view-back">
            Review queue
          </ButtonLink>
        </div>

        <img
          src={project.image_url || "/project-image-fallback.png"}
          alt=""
          className="aspect-video w-full rounded-lg border border-[var(--border)] object-cover"
        />

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={project.status} />
            {project.on_hold && <Badge tone="warning">On hold</Badge>}
            <Muted className="text-sm">
              <Mono>#{project.id}</Mono>
            </Muted>
          </div>
          <h1 className="hc-title mt-2">{project.title}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            {project.github_url ? (
              <a href={project.github_url} target="_blank" rel="noreferrer" className="hc-btn hc-btn-outline hc-btn-sm hc-btn-octicon">
                <MarkGithubIcon size={14} />
                Repo
              </a>
            ) : (
              <Badge tone="danger">No repo</Badge>
            )}
            {project.link_url ? (
              <a href={project.link_url} target="_blank" rel="noreferrer" className="hc-btn hc-btn-outline hc-btn-sm hc-btn-octicon">
                <LinkExternalIcon size={14} />
                Demo
              </a>
            ) : (
              <Badge tone="danger">No demo</Badge>
            )}
          </div>
        </div>

        <Card>
          {project.description ? (
            <Markdown>{project.description}</Markdown>
          ) : (
            <Muted>No description.</Muted>
          )}
        </Card>

        <Card padding="compact">
          <div className="flex flex-wrap items-center gap-3">
            <Avatar src={owner?.slack_avatar_url} size={40} />
            <div className="min-w-0 flex-1">
              <TextLink href={`/admin/users/${project.profile_id}`} className="font-bold">
                {ownerName}
              </TextLink>
              <div className="text-sm">
                {owner?.slack_display_name && <Muted>@{owner.slack_display_name} · </Muted>}
                <TextLink href={`https://hackclub.slack.com/team/${owner?.slack_id}`} external>
                  <Mono>{owner?.slack_id}</Mono>
                </TextLink>
              </div>
            </div>
            <ButtonLink
              href={`https://hackclub.slack.com/team/${owner?.slack_id}`}
              external
              variant="outline"
              size="sm"
              icon="slack"
            >
              Open in Slack
            </ButtonLink>
          </div>
        </Card>

        <Card padding="flush">
          <Tabs
            sticky
            tabs={[
              {
                key: "commits",
                label: "Commits",
                content: (
                  <Suspense fallback={<PanelLoading label="commits" />}>
                    <CommitsPanel githubUrl={project.github_url} />
                  </Suspense>
                ),
              },
              {
                key: "hackatime",
                label: "Hackatime",
                content: (
                  <Suspense fallback={<PanelLoading label="Hackatime" />}>
                    <HackatimePanel
                      slackId={owner?.slack_id ?? null}
                      projectTitle={project.title}
                      githubUrl={project.github_url}
                    />
                  </Suspense>
                ),
              },
              {
                key: "reviews",
                label: (
                  <span className="flex items-center gap-2">
                    Past reviews <CountBadge>{reviews.length}</CountBadge>
                  </span>
                ),
                content: <PastReviewsPanel reviews={reviews} />,
              },
              {
                key: "ysws",
                label: "Other YSWS",
                content: (
                  <Suspense fallback={<PanelLoading label="ships.hackclub.com" />}>
                    <YswsPanel githubUrl={project.github_url} demoUrl={project.link_url} />
                  </Suspense>
                ),
              },
            ]}
          />
        </Card>
      </div>

      <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
        <Tabs variant="segmented" tabs={rightTabs} />
      </aside>
    </div>
  );
}

function EditSubmissionForm({
  project,
  action,
}: {
  project: {
    title: string;
    description: string;
    image_url: string | null;
    link_url: string | null;
    github_url: string | null;
  };
  action: (formData: FormData) => void;
}) {
  return (
    <form action={action} className="flex flex-col gap-3">
      <Field label="Title">
        <Input name="title" defaultValue={project.title} required />
      </Field>
      <Field label="Description" hint="Markdown supported.">
        <Textarea name="description" rows={6} defaultValue={project.description} />
      </Field>
      <Field label="Image URL">
        <Input name="image_url" type="url" defaultValue={project.image_url ?? ""} />
      </Field>
      <Field label="Repo URL">
        <Input name="github_url" type="url" defaultValue={project.github_url ?? ""} />
      </Field>
      <Field label="Demo URL">
        <Input name="link_url" type="url" defaultValue={project.link_url ?? ""} />
      </Field>
      <div className="[&>button]:w-full">
        <ActionButton pendingLabel="Saving…">
          Save submission
        </ActionButton>
      </div>
    </form>
  );
}
