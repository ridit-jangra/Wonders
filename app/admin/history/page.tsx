import { listRecentHistory } from "@/lib/project-history";
import { Card, HistoryTimeline, PageHeader, Pagination } from "../components/ui";

const PER_PAGE = 50;

export default async function AdminHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
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

      <Card>
        <HistoryTimeline entries={entries} linkProjects />
      </Card>

      <Pagination
        page={currentPage}
        totalPages={totalPages}
        hrefFor={(p) => `/admin/history?page=${p}`}
      />
    </div>
  );
}
