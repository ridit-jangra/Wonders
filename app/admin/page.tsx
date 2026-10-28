import { getOverviewStats } from "@/lib/admin-stats";
import { listAllProjects, type ProjectWithOwner } from "@/lib/projects";
import { listRecentHistory } from "@/lib/project-history";
import {
  Avatar,
  Badge,
  CardLink,
  EmptyState,
  Mono,
  Muted,
  PageHeader,
  StatusBadge,
  TextLink,
} from "./components/ui";
import { requireAdmin } from "@/lib/admin";
import { canFulfill, canReview } from "@/lib/security/roles";

const EMPTY = { projects: [] as ProjectWithOwner[], total: 0 };

function fulfilmentBadge(project: ProjectWithOwner) {
  if (project.status === "shipped") {
    return project.reward ? (
      <Badge tone="success">reward set</Badge>
    ) : (
      <Badge tone="warning">needs reward</Badge>
    );
  }
  if (project.reward_sent_at) {
    return <Badge tone="success">on its way</Badge>;
  }
  if (project.reward_ordered_at) {
    return <Badge tone="info">ordered</Badge>;
  }
  return <Badge>started</Badge>;
}

function Ticket({
  project,
  href,
  extra,
}: {
  project: ProjectWithOwner;
  href: string;
  extra?: React.ReactNode;
}) {
  return (
    <CardLink href={href}>
      <div className="flex items-center gap-3">
        <Avatar src={project.profile?.slack_avatar_url} size={32} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold">{project.title}</span>
            {extra}
            {project.on_hold && <Badge tone="warning">on hold</Badge>}
          </div>
          <div className="text-sm">
            <Muted>
              {project.profile?.slack_display_name ||
                project.profile?.name ||
                project.profile?.email}
            </Muted>
          </div>
        </div>
        <Muted className="shrink-0 text-sm">
          <Mono>{new Date(project.created_at).toLocaleDateString()}</Mono>
        </Muted>
      </div>
    </CardLink>
  );
}

export default async function AdminOverviewPage() {
  const admin = await requireAdmin();
  const showReview = canReview(admin);
  const showFulfil = canFulfill(admin);

  const [stats, review, fulfil, recent] = await Promise.all([
    getOverviewStats(),
    showReview
      ? listAllProjects({ status: ["in_review", "second_pass"], limit: 8, offset: 0 })
      : EMPTY,
    showFulfil
      ? listAllProjects({ status: ["shipped", "fulfillment_started"], limit: 8, offset: 0 })
      : EMPTY,
    listRecentHistory({ limit: 8, offset: 0 }),
  ]);

  const summary = [
    showReview ? `${review.total} to review` : null,
    showFulfil ? `${fulfil.total} to fulfil` : null,
    `${stats.totalUsers} players`,
    `${stats.totalWonders} wonders`,
    `${stats.byStatus.fulfilled ?? 0} fulfilled`,
  ]
    .filter(Boolean)
    .join(" \u00b7 ");

  const lanes = showReview && showFulfil ? "lg:grid-cols-2" : "";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Inbox" description={summary} />

      <div className={`grid gap-8 ${lanes}`}>
        {showReview && (
          <section>
            <div className="hc-lane-head">
              Review <Badge>{review.total}</Badge>
              <TextLink href="/admin/review">all</TextLink>
            </div>
            {review.projects.length === 0 ? (
              <EmptyState title="Inbox zero" icon="checkmark-all">
                Nothing is waiting on review.
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-2">
                {review.projects.map((project) => (
                  <Ticket
                    key={project.id}
                    project={project}
                    href={`/admin/review/${project.id}`}
                    extra={<StatusBadge status={project.status} />}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {showFulfil && (
          <section>
            <div className="hc-lane-head">
              Fulfil <Badge>{fulfil.total}</Badge>
              <TextLink href="/admin/fulfillment">all</TextLink>
            </div>
            {fulfil.projects.length === 0 ? (
              <EmptyState title="Nothing to send" icon="package">
                No rewards are waiting.
              </EmptyState>
            ) : (
              <div className="flex flex-col gap-2">
                {fulfil.projects.map((project) => (
                  <Ticket
                    key={project.id}
                    project={project}
                    href="/admin/fulfillment"
                    extra={fulfilmentBadge(project)}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <section>
        <div className="hc-lane-head">
          Recent
          <TextLink href="/admin/history">all</TextLink>
        </div>
        {recent.entries.length === 0 ? (
          <Muted>No activity yet.</Muted>
        ) : (
          <ul className="hc-feed">
            {recent.entries.map((entry) => (
              <li key={entry.id}>
                <TextLink href={`/admin/review/${entry.project_id}`}>
                  wonder #{entry.project_id}
                </TextLink>
                <StatusBadge status={entry.to_status} />
                <Muted>
                  <Mono>{entry.reviewed_by}</Mono>
                </Muted>
                <Muted className="ml-auto">
                  <Mono>{new Date(entry.created_at).toLocaleString()}</Mono>
                </Muted>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
