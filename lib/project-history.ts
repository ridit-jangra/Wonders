import "server-only";
import { sql } from "@/lib/db";
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

const COLUMNS = () => sql`
  id, project_id, profile_id, from_status, to_status, reviewer_note, reward,
  reviewed_by, created_at
`;

export async function recordProjectHistory(entry: {
  projectId: ProjectId;
  profileId: string;
  fromStatus: ProjectStatus | null;
  toStatus: ProjectEvent;
  reviewerNote: string | null;
  reward: string | null;
  reviewedBy: string;
}) {
  await sql`
    insert into project_history (
      project_id, profile_id, from_status, to_status, reviewer_note,
      reward, reviewed_by
    ) values (
      ${Number(entry.projectId)},
      ${entry.profileId},
      ${entry.fromStatus},
      ${entry.toStatus},
      ${entry.reviewerNote},
      ${entry.reward},
      ${entry.reviewedBy}
    )
  `;
}

export async function getProjectHistory(
  projectId: ProjectId,
): Promise<ProjectHistoryEntry[]> {
  return sql<ProjectHistoryEntry[]>`
    select ${COLUMNS()} from project_history
    where project_id = ${projectId}
    order by created_at desc
  `;
}

export async function getProfileHistory(
  profileId: string,
): Promise<ProjectHistoryEntry[]> {
  return sql<ProjectHistoryEntry[]>`
    select ${COLUMNS()} from project_history
    where profile_id = ${profileId}
    order by created_at desc
  `;
}

export async function listRecentHistory(opts: {
  limit: number;
  offset: number;
}): Promise<{ entries: ProjectHistoryEntry[]; total: number }> {
  const [entries, [{ total }]] = await Promise.all([
    sql<ProjectHistoryEntry[]>`
      select ${COLUMNS()} from project_history
      order by created_at desc
      limit ${opts.limit} offset ${opts.offset}
    `,
    sql<{ total: number }[]>`
      select count(*)::int as total from project_history
    `,
  ]);
  return { entries, total };
}

export interface TimelineEntry {
  id: string;
  fromStatus: ProjectStatus | null;
  toStatus: ProjectStatus;
  note: string | null;
  actorSlackId: string;
  createdAt: string;
}

export async function getProjectTimeline(
  projectId: ProjectId,
  profileId: string,
): Promise<TimelineEntry[]> {
  return sql<TimelineEntry[]>`
    select
      id,
      from_status as "fromStatus",
      to_status as "toStatus",
      reviewer_note as note,
      reviewed_by as "actorSlackId",
      created_at as "createdAt"
    from project_history
    where project_id = ${projectId} and profile_id = ${profileId}
    order by created_at asc, id asc
  `;
}
