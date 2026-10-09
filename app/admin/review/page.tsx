import Link from "next/link";
import { listAllProjects } from "@/lib/projects";
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
import { requireAdmin } from "@/lib/admin";

const PER_PAGE = 25;

export default async function AdminReviewQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pass?: string }>;
}) {
  await requireAdmin();
  const { page, pass } = await searchParams;
  const currentPage = Math.max(1, parseInt(page ?? "1", 10) || 1);

  let activePass: "first" | "second" = "first";
  if (pass === "second") {
    activePass = "second";
  }

  const [firstPass, secondPass] = await Promise.all([
    listAllProjects({
      status: "in_review",
      limit: PER_PAGE,
      offset: activePass === "first" ? (currentPage - 1) * PER_PAGE : 0,
    }),
    listAllProjects({
      status: "second_pass",
      limit: PER_PAGE,
      offset: activePass === "second" ? (currentPage - 1) * PER_PAGE : 0,
    }),
  ]);

  let current = firstPass;
  if (activePass === "second") {
    current = secondPass;
  }
  const totalPages = Math.max(1, Math.ceil(current.total / PER_PAGE));

  return (
    <div>
      <PageHeader
        title="Review queue"
        count={firstPass.total + secondPass.total}
        description="First pass checks the work. Second pass is the final review before it can be published."
      />

      <Card padding="flush">
        <div className="hc-tabs" role="tablist">
          <Link
            href="/admin/review?pass=first"
            className="hc-tab gap-2"
            role="tab"
            aria-selected={activePass === "first"}
          >
            First pass <CountBadge>{firstPass.total}</CountBadge>
          </Link>
          <Link
            href="/admin/review?pass=second"
            className="hc-tab gap-2"
            role="tab"
            aria-selected={activePass === "second"}
          >
            Second pass <CountBadge>{secondPass.total}</CountBadge>
          </Link>
        </div>

        <Table headers={["Wonder", "Owner", "Slack ID", "Created"]}>
          {current.projects.map((project) => (
            <tr key={project.id}>
              <td>
                <div className="flex flex-wrap items-center gap-2">
                  <TextLink href={`/admin/review/${project.id}`} className="font-bold">
                    {project.title}
                  </TextLink>
                  {project.on_hold && <Badge tone="warning">On hold</Badge>}
                </div>
              </td>
              <td>
                <TextLink href={`/admin/users/${project.profile_id}`}>
                  {project.profile?.name || project.profile?.slack_display_name || project.profile?.email}
                </TextLink>
              </td>
              <td>
                <Mono>{project.profile?.slack_id}</Mono>
              </td>
              <td>
                <Muted>
                  <Mono>{new Date(project.created_at).toLocaleDateString()}</Mono>
                </Muted>
              </td>
            </tr>
          ))}
          {current.projects.length === 0 && (
            <EmptyRow colSpan={4} title="All caught up" icon="checkmark-all">
              Nothing is waiting on {activePass === "first" ? "a first" : "a second"} pass right now.
            </EmptyRow>
          )}
        </Table>
      </Card>

      <Pagination
        page={currentPage}
        totalPages={totalPages}
        hrefFor={(p) => `/admin/review?pass=${activePass}&page=${p}`}
      />
    </div>
  );
}
