import "server-only";
import { sql } from "@/lib/db";
import { countProjectsByStatus } from "@/lib/projects";

export interface OverviewStats {
  totalUsers: number;
  totalWonders: number;
  byStatus: Awaited<ReturnType<typeof countProjectsByStatus>>;
}

export async function getOverviewStats(): Promise<OverviewStats> {
  const [[{ totalUsers }], byStatus] = await Promise.all([
    sql<{ totalUsers: number }[]>`
      select count(*)::int as "totalUsers" from profiles
    `,
    countProjectsByStatus(),
  ]);

  const totalWonders = Object.values(byStatus).reduce((a, b) => a + b, 0);

  return {
    totalUsers,
    totalWonders,
    byStatus,
  };
}
