import "server-only";
import { supabase } from "@/lib/supabase";
import { countProjectsByStatus } from "@/lib/projects";

export interface OverviewStats {
  totalUsers: number;
  totalWonders: number;
  byStatus: Awaited<ReturnType<typeof countProjectsByStatus>>;
}

export async function getOverviewStats(): Promise<OverviewStats> {
  const [{ count: totalUsers, error }, byStatus] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    countProjectsByStatus(),
  ]);
  if (error) {
    throw error;
  }

  const totalWonders = Object.values(byStatus).reduce((a, b) => a + b, 0);

  return {
    totalUsers: totalUsers ?? 0,
    totalWonders,
    byStatus,
  };
}
