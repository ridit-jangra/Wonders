/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { listAllProjects } from "@/lib/projects";
import { listRecentReviews } from "@/lib/reviews";
import { reviewToolUrl, YSWS } from "@/lib/ysws-config";
import {
  Badge,
  Card,
  CountBadge,
  EmptyRow,
  Mono,
  Muted,
  PageHeader,
  Pagination,
  Table,
  TextLink,
} from "../components/ui";
import { requireAccess } from "@/lib/admin";
import { canReview } from "@/lib/security/roles";

const PER_PAGE = 25;

type Pass = "first" | "second" | "reviewed";

function ago(iso: string): string {
  const hours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.floor(hours / 24)}d`;
}

function logged(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function Reviewer({
  slackId,
  name,
  profileId,
}: {
  slackId: string | null;
  name: string | null;
  profileId: string | null;
}) {
  if (!slackId) return <Muted>-</Muted>;
  if (profileId) return <TextLink href={`/admin/users/${profileId}`}>@{name || slackId}</TextLink>;
  return <Mono>{slackId}</Mono>;
}

function WonderLink({ id, title }: { id: number; title: string }) {
  const external = reviewToolUrl(id);
  return external ? (
    <TextLink href={external} external className="font-bold">
      {title}
    </TextLink>
  ) : (
    <TextLink href={`/admin/wonders/${id}`} className="font-bold">
      {title}
    </TextLink>
  );
}

export default async function AdminReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pass?: string }>;
}) {
  await requireAccess(canReview);
  const { page, pass } = await searchParams;
  const currentPage = Math.max(1, parseInt(page ?? "1", 10) || 1);
  const active: Pass = pass === "second" ? "second" : pass === "reviewed" ? "reviewed" : "first";
  const offsetFor = (tab: Pass) => (active === tab ? (currentPage - 1) * PER_PAGE : 0);

  const [firstPass, secondPass, reviewed] = await Promise.all([
    listAllProjects({ status: "in_review", limit: PER_PAGE, offset: offsetFor("first") }),
    listAllProjects({ status: "second_pass", limit: PER_PAGE, offset: offsetFor("second") }),
    listRecentReviews({ limit: PER_PAGE, offset: offsetFor("reviewed") }),
  ]);

  const queue = active === "second" ? secondPass : firstPass;
  const total = active === "reviewed" ? reviewed.total : queue.total;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div>
      <PageHeader
        title="Review queue"
        count={firstPass.total + secondPass.total}
        description={`Oldest first. Click a wonder to review it in ${YSWS.reviewTool.name}.`}
      />

      <Card padding="flush">
        <div className="hc-tabs" role="tablist">
          <Link href="/admin/review?pass=first" className="hc-tab gap-2" role="tab" aria-selected={active === "first"}>
            First pass <CountBadge>{firstPass.total}</CountBadge>
          </Link>
          <Link href="/admin/review?pass=second" className="hc-tab gap-2" role="tab" aria-selected={active === "second"}>
            Second pass <CountBadge>{secondPass.total}</CountBadge>
          </Link>
          <Link
            href="/admin/review?pass=reviewed"
            className="hc-tab gap-2"
            role="tab"
            aria-selected={active === "reviewed"}
          >
            Reviewed <CountBadge>{reviewed.total}</CountBadge>
          </Link>
        </div>

        {active === "reviewed" ? (
          <Table headers={["Project", "Maker", "Status", "Reviewer", "Reviewed"]}>
            {reviewed.rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <img
                      src={row.image_url || "/project-image-fallback.png"}
                      alt=""
                      className="h-10 w-14 rounded object-cover"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <WonderLink id={row.project_id} title={row.title} />
                      <Muted>
                        <Mono>#{row.project_id}</Mono>
                      </Muted>
                    </div>
                  </div>
                </td>
                <td>
                  <TextLink href={`/admin/users/${row.owner_profile_id}`}>@{row.owner_name}</TextLink>
                </td>
                <td>
                  <Badge tone={row.verdict === "approved" ? "success" : "danger"}>
                    {row.verdict === "approved" ? "Approved" : "Needs changes"}
                  </Badge>
                </td>
                <td>
                  <Reviewer slackId={row.first_reviewed_by} name={row.first_reviewer_name} profileId={row.first_reviewer_profile_id} />
                  {row.pass === "second" && (
                    <div>
                      <Muted>2nd: </Muted>
                      <Reviewer slackId={row.reviewed_by} name={row.reviewer_name} profileId={row.reviewer_profile_id} />
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap">
                  <Mono>{ago(row.created_at)}</Mono>
                  {row.hackatime_seconds ? (
                    <div>
                      <Muted>
                        <Mono>{logged(row.hackatime_seconds)} logged</Mono>
                      </Muted>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
            {reviewed.rows.length === 0 && (
              <EmptyRow colSpan={5} title="Nothing reviewed yet" icon="history">
                Reviews show up here once they are recorded.
              </EmptyRow>
            )}
          </Table>
        ) : (
          <Table headers={["Wonder", "Owner", "Slack ID", "Created"]}>
            {queue.projects.map((project) => (
              <tr key={project.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <img
                      src={project.image_url || "/project-image-fallback.png"}
                      alt=""
                      className="h-10 w-14 rounded object-cover"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                    <WonderLink id={project.id} title={project.title} />
                    <Muted>
                      <Mono>#{project.id}</Mono>
                    </Muted>
                    {project.on_hold && <Badge tone="warning">On hold</Badge>}
                    {project.ai_review_status === "flagged" && <Badge tone="warning">Auto-check flagged</Badge>}
                    </div>
                  </div>
                </td>
                <td>
                  <TextLink href={`/admin/users/${project.profile_id}`}>
                    {project.profile?.name || project.profile?.slack_display_name || project.profile?.email}
                  </TextLink>
                </td>
                <td>
                  {project.profile?.slack_id ? (
                    <TextLink href={`https://hackclub.slack.com/team/${project.profile.slack_id}`} external>
                      <Mono>{project.profile.slack_id}</Mono>
                    </TextLink>
                  ) : null}
                </td>
                <td>
                  <Muted>
                    <Mono>{new Date(project.created_at).toLocaleDateString()}</Mono>
                  </Muted>
                </td>
              </tr>
            ))}
            {queue.projects.length === 0 && (
              <EmptyRow colSpan={4} title="All caught up" icon="checkmark-all">
                Nothing is waiting on {active === "first" ? "a first" : "a second"} pass right now.
              </EmptyRow>
            )}
          </Table>
        )}
      </Card>

      <Pagination page={currentPage} totalPages={totalPages} hrefFor={(p) => `/admin/review?pass=${active}&page=${p}`} />
    </div>
  );
}
