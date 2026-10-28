import { listAudit } from "@/lib/audit";
import { requireAccess } from "@/lib/admin";
import { canViewAudit } from "@/lib/security/roles";
import LocalTime from "@/app/dashboard/components/LocalTime";
import { Badge, Card, EmptyRow, Mono, PageHeader, Pagination, Table } from "../components/ui";

const PER_PAGE = 50;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAccess(canViewAudit);
  const { page } = await searchParams;
  const currentPage = Math.max(1, parseInt(page ?? "1", 10) || 1);
  const { entries, total } = await listAudit({
    limit: PER_PAGE,
    offset: (currentPage - 1) * PER_PAGE,
  });
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div>
      <PageHeader title="Audit log" count={total} description="Sign-ins, role changes, bans and PII views." />

      <Card padding="flush">
        <Table headers={["When", "Who", "Action", "Target", "Detail"]}>
          {entries.length === 0 ? (
            <EmptyRow colSpan={5} title="Nothing logged yet" />
          ) : (
            entries.map((entry) => (
              <tr key={entry.id}>
                <td>
                  <LocalTime iso={entry.created_at} />
                </td>
                <td>
                  <Mono>{entry.actor_slack_id}</Mono>
                </td>
                <td>
                  {entry.sensitive ? <Badge tone="warning">{entry.action}</Badge> : <Mono>{entry.action}</Mono>}
                </td>
                <td>{entry.target ? <Mono>{entry.target}</Mono> : null}</td>
                <td>
                  {Object.keys(entry.detail ?? {}).length > 0 && (
                    <Mono>{JSON.stringify(entry.detail)}</Mono>
                  )}
                </td>
              </tr>
            ))
          )}
        </Table>
      </Card>

      <Pagination
        page={currentPage}
        totalPages={totalPages}
        hrefFor={(p) => `/admin/audit?page=${p}`}
      />
    </div>
  );
}
