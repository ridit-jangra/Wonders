import "server-only";
import { supabase } from "@/lib/supabase";
import type { ProjectId, ProjectStatus } from "@/lib/projects";

export type ProjectEvent = ProjectStatus;

export interface ProjectHistoryEntry {
  id: string;
  project_id: number;
  profile_id: string;
  from_status: ProjectStatus | null;
  to_status: ProjectEvent;
  reviewer_note: string | null;
  reward: string | null;
  reviewed_by: string;
  created_at: string;
}

const COLUMNS =
  "id, project_id, profile_id, from_status, to_status, reviewer_note, reward, reviewed_by, created_at";

export async function recordProjectHistory(entry: {
  projectId: ProjectId;
  profileId: string;
  fromStatus: ProjectStatus | null;
  toStatus: ProjectEvent;
  reviewerNote: string | null;
  reward: string | null;
  reviewedBy: string;
}) {
  const { error } = await supabase.from("project_history").insert({
    project_id: Number(entry.projectId),
    profile_id: entry.profileId,
    from_status: entry.fromStatus,
    to_status: entry.toStatus,
    reviewer_note: entry.reviewerNote,
    reward: entry.reward,
    reviewed_by: entry.reviewedBy,
  });

  if (error) {
    throw error;
  }
}

export async function getProjectHistory(
  projectId: ProjectId,
): Promise<ProjectHistoryEntry[]> {
  const { data, error } = await supabase
    .from("project_history")
    .select(COLUMNS)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }
  return data;
}

export async function getProfileHistory(
  profileId: string,
): Promise<ProjectHistoryEntry[]> {
  const { data, error } = await supabase
    .from("project_history")
    .select(COLUMNS)
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }
  return data;
}

export async function listRecentHistory(opts: {
  limit: number;
  offset: number;
}): Promise<{ entries: ProjectHistoryEntry[]; total: number }> {
  const { data, error, count } = await supabase
    .from("project_history")
    .select(COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1);

  if (error) {
    throw error;
  }
  return { entries: data, total: count ?? 0 };
}
