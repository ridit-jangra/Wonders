/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { getProjectWithOwner } from "@/lib/projects";
import { getProjectHistory } from "@/lib/project-history";
import { getProjectReviews } from "@/lib/reviews";
import { listJournalAdmin } from "@/lib/journal";
import { listUnits } from "@/lib/units";
import { airtableRecordUrl } from "@/lib/airtable";
import { YSWS, dollars, hoursValueCents } from "@/lib/ysws-config";
import { money } from "@/lib/budget-math";
import {
  Badge,
  ButtonLink,
  Callout,
  Card,
  CardHeader,
  DescriptionList,
  EmptyRow,
  HistoryTimeline,
  Mono,
  Muted,
  PageHeader,
  StatusBadge,
  Table,
  TextLink,
} from "../../components/ui";
import AdminTime from "@/app/admin/components/AdminTime";

const hours = (seconds: number) => `${(seconds / 3600).toFixed(1)}h`;

export default async function AdminWonderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) notFound();

  const project = await getProjectWithOwner(id);
  if (!project) notFound();

  const [history, reviews, journal, unitsByProject] = await Promise.all([
    getProjectHistory(id),
    getProjectReviews(id),
    listJournalAdmin(id),
    listUnits([project.id]),
  ]);
  const units = unitsByProject.get(project.id) ?? [];
  const owner = project.profile;
  const findings = project.ai_review_findings;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={
          <>
            {project.title} <StatusBadge status={project.status} />
            {project.banned_at && <Badge tone="danger">Banned</Badge>}
            {project.on_hold && <Badge tone="warning">On hold</Badge>}
          </>
        }
        description={`Wonder #${project.id}`}
        actions={
          <>
            <ButtonLink href={`/explore/${project.id}`} variant="outline" size="sm" icon="view">
              Public page and actions
            </ButtonLink>
            <ButtonLink href="/admin/fulfillment" variant="outline" size="sm" icon="package">
              Fulfillment
            </ButtonLink>
          </>
        }
      />

      {project.banned_at && (
        <Callout tone="danger" icon="forbidden">
          Banned{project.banned_by ? ` by ${project.banned_by}` : ""}
          {project.ban_reason ? `: "${project.ban_reason}"` : ""}
        </Callout>
      )}

      <Card>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_1fr]">
          <img
            src={project.image_url || "/project-image-fallback.png"}
            alt=""
            className="aspect-video w-full rounded-lg object-cover"
          />
          <div className="flex min-w-0 flex-col gap-4">
            <DescriptionList
              items={[
                ["Owner", owner ? <TextLink href={`/admin/users/${project.profile_id}`}>{owner.name || owner.email}</TextLink> : null],
                ["Created", <Mono key="c"><AdminTime iso={project.created_at} /></Mono>],
                [
                  "Repo",
                  project.github_url ? (
                    <TextLink href={project.github_url} external>
                      {project.github_url}
                    </TextLink>
                  ) : null,
                ],
                [
                  "Demo",
                  project.link_url ? (
                    <TextLink href={project.link_url} external>
                      {project.link_url}
                    </TextLink>
                  ) : null,
                ],
                ["Hackatime projects", project.hackatime_projects.length ? <Mono key="h">{project.hackatime_projects.join(", ")}</Mono> : null],
              ]}
            />
            <p className="whitespace-pre-wrap">{project.description}</p>
            {project.reviewer_note && (
              <p className="hc-caption">
                Last note to the player: &ldquo;{project.reviewer_note}&rdquo;
              </p>
            )}
          </div>
        </div>
      </Card>

      <Card padding="flush">
        <CardHeader title="Team and rewards" count={units.length} />
        <Table headers={["Person", "Role", "Hours", "Value", "Reward", "Airtable"]}>
          {units.map((unit) => {
            const recordUrl = unit.airtableIds.length
              ? airtableRecordUrl(unit.airtableIds[unit.airtableIds.length - 1])
              : null;
            return (
              <tr key={unit.profileId}>
                <td>
                  <TextLink href={`/admin/users/${unit.profileId}`} className="font-bold">
                    {unit.name}
                  </TextLink>
                </td>
                <td>{unit.kind === "owner" ? "Owner" : `Collaborator C${unit.unitId}`}</td>
                <td>{unit.seconds !== null ? <Mono>{hours(unit.seconds)}</Mono> : <Muted>—</Muted>}</td>
                <td>
                  {unit.seconds !== null ? (
                    <Mono>
                      {money(hoursValueCents(unit.seconds))} at {dollars(YSWS.rates.hourlyCents)}/h
                    </Mono>
                  ) : (
                    <Muted>—</Muted>
                  )}
                </td>
                <td>
                  {unit.fulfilledAt ? (
                    <Badge tone="success">Fulfilled</Badge>
                  ) : unit.reward ? (
                    <Badge tone="info">{unit.reward}</Badge>
                  ) : (
                    <Muted>not set</Muted>
                  )}
                </td>
                <td>
                  {recordUrl ? (
                    <TextLink href={recordUrl} external>
                      Open record
                    </TextLink>
                  ) : unit.airtableError ? (
                    <Badge tone="danger">Push failed</Badge>
                  ) : (
                    <Muted>not pushed</Muted>
                  )}
                </td>
              </tr>
            );
          })}
          {units.length === 0 && <EmptyRow colSpan={6} title="No one on this wonder" />}
        </Table>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Status history" count={history.length} />
          <HistoryTimeline entries={history} />
        </Card>

        <Card>
          <CardHeader title="Automatic check" />
          {project.ai_review_status === "none" ? (
            <Muted>Hasn&apos;t run.</Muted>
          ) : (
            <div className="flex flex-col gap-3">
              <p>
                <Badge tone={project.ai_review_status === "flagged" ? "warning" : "info"}>
                  {project.ai_review_status}
                </Badge>
              </p>
              {project.ai_review_summary && <p className="whitespace-pre-wrap">{project.ai_review_summary}</p>}
              {project.ai_review_error && <Callout tone="warning">{project.ai_review_error}</Callout>}
              {findings && findings.redFlags.length > 0 && (
                <div>
                  <p className="hc-eyebrow mb-1">Red flags</p>
                  <ul className="list-disc pl-5">
                    {findings.redFlags.map((flag, index) => (
                      <li key={index}>{flag}</li>
                    ))}
                  </ul>
                </div>
              )}
              {findings && findings.strengths.length > 0 && (
                <div>
                  <p className="hc-eyebrow mb-1">Strengths</p>
                  <ul className="list-disc pl-5">
                    {findings.strengths.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Past reviews" count={reviews.length} />
        {reviews.length === 0 ? (
          <Muted>No reviews recorded.</Muted>
        ) : (
          <ul className="flex flex-col gap-4">
            {reviews.map((review) => (
              <li key={review.id} className="flex flex-col gap-1 border-b border-[var(--border)] pb-4 last:border-b-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="info">{review.pass === "first" ? "First pass" : "Second pass"}</Badge>
                  <Badge tone={review.verdict === "approved" ? "success" : "danger"}>
                    {review.verdict === "approved" ? "Approved" : "Changes requested"}
                  </Badge>
                  <Muted>
                    <Mono>{review.reviewed_by}</Mono> · <Mono><AdminTime iso={review.created_at} /></Mono>
                  </Muted>
                </div>
                {review.feedback && <p className="whitespace-pre-wrap">&ldquo;{review.feedback}&rdquo;</p>}
                {review.technical_notes && (
                  <p className="hc-caption whitespace-pre-wrap">Technical: {review.technical_notes}</p>
                )}
                {review.additional_notes && (
                  <p className="hc-caption whitespace-pre-wrap">Notes: {review.additional_notes}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Journal" count={journal.length} />
        {journal.length === 0 ? (
          <Muted>No journal entries.</Muted>
        ) : (
          <ul className="flex flex-col gap-4">
            {journal.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-1 border-b border-[var(--border)] pb-4 last:border-b-0">
                <div className="flex flex-wrap items-center gap-2">
                  {entry.title && <strong>{entry.title}</strong>}
                  {entry.authorName && <Badge>{entry.authorName}</Badge>}
                  <Muted>
                    <Mono><AdminTime iso={entry.createdAt} /></Mono>
                  </Muted>
                </div>
                <p className="whitespace-pre-wrap">{entry.content}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
