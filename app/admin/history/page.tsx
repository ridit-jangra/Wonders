import { listRecentHistory } from "@/lib/project-history";
import {
  Badge,
  Card,
  EmptyRow,
  Icon,
  Mono,
  Muted,
  PageHeader,
  Pagination,
  StatusBadge,
  Table,
  TextLink, SlackId,
} from "../components/ui";
import { requireAdmin } from "@/lib/admin";
import AdminTime from "@/app/admin/components/AdminTime";

const PER_PAGE = 50;

export default async function AdminHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdmin();
  const { page } = await searchParams;
  const currentPage = Math.max(1, parseInt(page ?? "1", 10) || 1);
  const { entries, total } = await listRecentHistory({
    limit: PER_PAGE,
    offset: (currentPage - 1) * PER_PAGE,
  });
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div>
      <PageHeader title="Activity" count={total} description="Every status change, newest first." />

      <Card padding="flush">
        <Table headers={["When", "Wonder", "Change", "By", "Note"]}>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td className="whitespace-nowrap">
                <Muted>
                  <Mono><AdminTime iso={entry.created_at} /></Mono>
                </Muted>
              </td>
              <td className="whitespace-nowrap">
                <TextLink href={`/admin/wonders/${entry.project_id}`} className="font-bold">
                  {entry.project_title || `wonder #${entry.project_id}`}
                </TextLink>
              </td>
              <td>
                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                  {entry.from_status ? <StatusBadge status={entry.from_status} /> : <Badge>New</Badge>}
                  <Icon glyph="view-forward" size={16} className="hc-muted" />
                  <StatusBadge status={entry.to_status} />
                </span>
              </td>
              <td className="whitespace-nowrap">
                <SlackId id={entry.reviewed_by} />
              </td>
              <td className="max-w-md">
                {entry.reviewer_note ? <span className="line-clamp-2">&ldquo;{entry.reviewer_note}&rdquo;</span> : <Muted>—</Muted>}
              </td>
            </tr>
          ))}
          {entries.length === 0 && <EmptyRow colSpan={5} title="No activity yet" icon="history" />}
        </Table>
      </Card>

      <Pagination
        page={currentPage}
        totalPages={totalPages}
        hrefFor={(p) => `/admin/history?page=${p}`}
      />
    </div>
  );
}
