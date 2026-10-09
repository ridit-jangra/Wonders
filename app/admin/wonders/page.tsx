import { listAllProjects } from "@/lib/projects";
import type { ProjectStatus } from "@/lib/projects";
import {
  Card,
  EmptyRow,
  FilterBar,
  Mono,
  Muted,
  PageHeader,
  Pagination,
  StatusBadge,
  STATUS_LABEL,
  Table,
  TextLink,
} from "../components/ui";
import Select from "../components/Select";
import { requireAdmin } from "@/lib/admin";

const PER_PAGE = 25;

const STATUSES: ProjectStatus[] = [
  "building",
  "in_review",
  "second_pass",
  "rejected",
  "shipped",
  "fulfillment_started",
  "fulfilled",
];

export default async function AdminWondersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requireAdmin();
  const { q, status, page } = await searchParams;
  const currentPage = Math.max(1, parseInt(page ?? "1", 10) || 1);

  let statusFilter: ProjectStatus | undefined = undefined;
  if (STATUSES.includes(status as ProjectStatus)) {
    statusFilter = status as ProjectStatus;
  }

  const statusOptions = [{ value: "", label: "All statuses" }];
  for (const s of STATUSES) {
    statusOptions.push({ value: s, label: STATUS_LABEL[s] });
  }

  const { projects, total } = await listAllProjects({
    search: q,
    status: statusFilter,
    limit: PER_PAGE,
    offset: (currentPage - 1) * PER_PAGE,
  });
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div>
      <PageHeader title="All wonders" count={total} />

      <FilterBar q={q} placeholder="Search title">
        <Select name="status" defaultValue={statusFilter ?? ""} options={statusOptions} className="w-48" />
      </FilterBar>

      <Card padding="flush">
        <Table headers={["Title", "Owner", "Status", "Created"]}>
          {projects.map((project) => (
            <tr key={project.id}>
              <td>
                <TextLink href={`/admin/review/${project.id}`} className="font-bold">
                  {project.title}
                </TextLink>
              </td>
              <td>
                <TextLink href={`/admin/users/${project.profile_id}`}>
                  {project.profile?.name || project.profile?.email}
                </TextLink>
              </td>
              <td>
                <StatusBadge status={project.status} />
              </td>
              <td>
                <Muted>
                  <Mono>{new Date(project.created_at).toLocaleDateString()}</Mono>
                </Muted>
              </td>
            </tr>
          ))}
          {projects.length === 0 && (
            <EmptyRow colSpan={4} title="No wonders found" icon="search">
              Try a different search or status.
            </EmptyRow>
          )}
        </Table>
      </Card>

      <Pagination
        page={currentPage}
        totalPages={totalPages}
        hrefFor={(p) =>
          `/admin/wonders?q=${encodeURIComponent(q ?? "")}&status=${status ?? ""}&page=${p}`
        }
      />
    </div>
  );
}
