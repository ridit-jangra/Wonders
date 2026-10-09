import { getOverviewStats } from "@/lib/admin-stats";
import { listAllProjects } from "@/lib/projects";
import { listRecentHistory } from "@/lib/project-history";
import {
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  HistoryTimeline,
  Mono,
  Muted,
  PageHeader,
  Stat,
  StatGrid,
  StatusBadge,
  TextLink,
} from "./components/ui";

export default async function AdminOverviewPage() {
  const [stats, reviewQueue, recent] = await Promise.all([
    getOverviewStats(),
    listAllProjects({ status: ["in_review", "second_pass"], limit: 6, offset: 0 }),
    listRecentHistory({ limit: 8, offset: 0 }),
  ]);

  const fulfilled = stats.byStatus.fulfilled ?? 0;
  const pendingFulfillments =
    (stats.byStatus.shipped ?? 0) + (stats.byStatus.fulfillment_started ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Overview" description="Everything happening across Wonders." />

      <StatGrid>
        <Stat label="Projects" value={stats.totalWonders} icon="rep" href="/admin/wonders" />
        <Stat label="Users" value={stats.totalUsers} icon="people-3" href="/admin/users" />
        <Stat
          label="Fulfilled"
          value={fulfilled}
          icon="check-circle"
          tone="success"
          href="/admin/wonders?status=fulfilled"
        />
        <Stat
          label="Pending fulfillments"
          value={pendingFulfillments}
          icon="package"
          tone="warning"
          href="/admin/fulfillment"
        />
      </StatGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card padding="flush">
          <CardHeader
            title="Needs review"
            icon="view"
            count={reviewQueue.total}
            action={
              <ButtonLink href="/admin/review" variant="ghost" size="sm">
                View all
              </ButtonLink>
            }
          />
          {reviewQueue.projects.length === 0 ? (
            <EmptyState title="All caught up" icon="checkmark-all">
              Nothing is waiting on review right now.
            </EmptyState>
          ) : (
            <ul>
              {reviewQueue.projects.map((project) => (
                <li
                  key={project.id}
                  className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-4 py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <TextLink href={`/admin/review/${project.id}`} className="font-bold">
                        {project.title}
                      </TextLink>
                      <StatusBadge status={project.status} />
                    </div>
                    <div className="text-sm">
                      <Muted>{project.profile?.name || project.profile?.email}</Muted>
                    </div>
                  </div>
                  <Muted className="shrink-0 text-sm">
                    <Mono>{new Date(project.created_at).toLocaleDateString()}</Mono>
                  </Muted>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padding="flush">
          <CardHeader
            title="Recent activity"
            icon="history"
            action={
              <ButtonLink href="/admin/history" variant="ghost" size="sm">
                View all
              </ButtonLink>
            }
          />
          <div className="p-4">
            <HistoryTimeline entries={recent.entries} linkProjects />
          </div>
        </Card>
      </div>
    </div>
  );
}
