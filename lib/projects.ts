import "server-only";
import { sql } from "@/lib/db";
import {
  PRECHECK_HIDE_MINUTES,
  type AutoCheckFindings,
  type AutoCheckStatus,
} from "@/lib/precheck/store";

export type ProjectStatus =
  | "building"
  | "in_review"
  | "second_pass"
  | "rejected"
  | "approved"
  | "shipped"
  | "fulfillment_started"
  | "fulfilled";

export type ProjectId = string | number;

export interface Project {
  id: number;
  profile_id: string;
  title: string;
  description: string;
  image_url: string | null;
  link_url: string | null;
  github_url: string | null;
  status: ProjectStatus;
  reviewer_note: string | null;
  reward: string | null;
  hackatime_projects: string[];
  hackatime_seconds: number | null;
  created_at: string;
}

const COLUMNS = () => sql`
  id, profile_id, title, description, image_url, link_url, github_url,
  status, reviewer_note, reward, hackatime_projects, hackatime_seconds,
  created_at
`;

export async function getProjects(profileId: string): Promise<Project[]> {
  return sql<Project[]>`
    select ${COLUMNS()} from projects
    where profile_id = ${profileId}
    order by created_at asc
  `;
}

export async function createProject(
  profileId: string,
  data: {
    title: string;
    description: string;
    link_url?: string;
    github_url?: string;
    image_url?: string | null;
  },
): Promise<Project> {
  const [project] = await sql<Project[]>`
    insert into projects (profile_id, title, description, link_url, github_url, image_url)
    values (
      ${profileId},
      ${data.title},
      ${data.description},
      ${data.link_url || null},
      ${data.github_url || null},
      ${data.image_url ?? null}
    )
    returning ${COLUMNS()}
  `;
  return project;
}

export async function getProject(id: ProjectId): Promise<Project | null> {
  const [project] = await sql<Project[]>`
    select ${COLUMNS()} from projects where id = ${id}
  `;
  return project ?? null;
}

export async function updateProject(
  id: ProjectId,
  profileId: string,
  data: {
    title: string;
    description: string;
    link_url?: string;
    github_url?: string;
    image_url?: string | null;
    hackatime_projects?: string[];
  },
) {
  await sql`
    update projects set
      title = ${data.title},
      description = ${data.description},
      link_url = ${data.link_url || null},
      github_url = ${data.github_url || null},
      ${data.image_url !== undefined ? sql`image_url = ${data.image_url},` : sql``}
      ${data.hackatime_projects !== undefined ? sql`hackatime_projects = ${data.hackatime_projects},` : sql``}
      updated_at = now()
    where id = ${id}
      and profile_id = ${profileId}
      and status in ('building', 'rejected')
  `;
}

export async function shipProject(
  id: ProjectId,
  profileId: string,
  hackatimeSeconds: number | null,
): Promise<boolean> {
  const rows = await sql`
    update projects set
      status = 'in_review',
      hackatime_seconds = ${hackatimeSeconds},
      updated_at = now()
    where id = ${id}
      and profile_id = ${profileId}
      and status in ('building', 'rejected')
    returning id
  `;
  return rows.length > 0;
}

export async function unshipProject(id: ProjectId, profileId: string): Promise<boolean> {
  const rows = await sql`
    update projects set
      status = 'building',
      ai_review_status = 'none',
      ai_review_token = null,
      ai_review_summary = null,
      ai_review_findings = null,
      ai_review_model = null,
      ai_reviewed_at = null,
      updated_at = now()
    where id = ${id}
      and profile_id = ${profileId}
      and status = 'in_review'
    returning id
  `;
  return rows.length > 0;
}

export async function deleteProject(id: ProjectId, profileId: string) {
  await sql`
    delete from projects
    where id = ${id}
      and profile_id = ${profileId}
      and status in ('building', 'rejected')
  `;
}


export interface ProjectOwner {
  name: string;
  slack_id: string;
  email: string;
  slack_display_name: string | null;
  slack_avatar_url: string | null;
}

export interface ProjectWithOwner extends Project {
  fulfilled_at: string | null;
  fulfilled_by: string | null;
  reward_ordered_at: string | null;
  reward_sent_at: string | null;
  on_hold: boolean;
  hold_reason: string | null;
  ai_review_status: AutoCheckStatus;
  ai_review_summary: string | null;
  ai_review_findings: AutoCheckFindings | null;
  ai_review_error: string | null;
  ai_review_model: string | null;
  ai_reviewed_at: string | null;
  ai_precheck_sendbacks: number;
  profile: ProjectOwner;
}

const ADMIN_COLUMNS = () => sql`
  p.id, p.profile_id, p.title, p.description, p.image_url, p.link_url,
  p.github_url, p.status, p.reviewer_note, p.reward, p.hackatime_projects,
  p.hackatime_seconds, p.created_at,
  p.fulfilled_at, p.fulfilled_by, p.reward_ordered_at, p.reward_sent_at,
  p.on_hold, p.hold_reason,
  p.ai_review_status, p.ai_review_summary, p.ai_review_findings,
  p.ai_review_error, p.ai_review_model, p.ai_reviewed_at,
  p.ai_precheck_sendbacks,
  json_build_object(
    'name', o.name,
    'slack_id', o.slack_id,
    'email', o.email,
    'slack_display_name', o.slack_display_name,
    'slack_avatar_url', o.slack_avatar_url
  ) as profile
`;

export async function listAllProjects(opts: {
  status?: ProjectStatus | ProjectStatus[];
  search?: string;
  limit: number;
  offset: number;
}): Promise<{ projects: ProjectWithOwner[]; total: number }> {
  const statuses = opts.status ? [opts.status].flat() : null;
  const where = sql`
    where not (
      p.ai_review_status = 'pending'
      and p.ai_review_started_at > now() - make_interval(mins => ${PRECHECK_HIDE_MINUTES})
    )
    ${statuses ? sql`and p.status = any(${statuses})` : sql``}
    ${opts.search ? sql`and p.title ilike ${"%" + opts.search + "%"}` : sql``}
  `;

  const [projects, [{ total }]] = await Promise.all([
    sql<ProjectWithOwner[]>`
      select ${ADMIN_COLUMNS()}
      from projects p join profiles o on o.id = p.profile_id
      ${where}
      order by p.created_at desc
      limit ${opts.limit} offset ${opts.offset}
    `,
    sql<{ total: number }[]>`
      select count(*)::int as total from projects p ${where}
    `,
  ]);
  return { projects, total };
}

export async function getProjectWithOwner(
  id: ProjectId,
): Promise<ProjectWithOwner | null> {
  const [project] = await sql<ProjectWithOwner[]>`
    select ${ADMIN_COLUMNS()}
    from projects p join profiles o on o.id = p.profile_id
    where p.id = ${id}
  `;
  return project ?? null;
}

export async function countProjectsByStatus(): Promise<
  Record<ProjectStatus, number>
> {
  const rows = await sql<{ status: ProjectStatus; count: number }[]>`
    select status, count(*)::int as count from projects group by status
  `;

  const counts: Record<ProjectStatus, number> = {
    building: 0,
    in_review: 0,
    second_pass: 0,
    rejected: 0,
    approved: 0,
    shipped: 0,
    fulfillment_started: 0,
    fulfilled: 0,
  };
  for (const row of rows) {
    counts[row.status] = row.count;
  }
  return counts;
}

export async function firstPassReview(
  id: ProjectId,
  verdict: "approved" | "changes_requested",
  feedback: string,
): Promise<boolean> {
  let nextStatus: ProjectStatus = "rejected";
  if (verdict === "approved") {
    nextStatus = "second_pass";
  }

  const rows = await sql`
    update projects set
      status = ${nextStatus},
      reviewer_note = ${feedback},
      on_hold = false,
      hold_reason = null,
      updated_at = now()
    where id = ${id} and status = 'in_review'
    returning id
  `;
  return rows.length > 0;
}

export async function secondPassReview(
  id: ProjectId,
  verdict: "approved" | "changes_requested",
  feedback: string,
): Promise<boolean> {
  let nextStatus: ProjectStatus = "rejected";
  if (verdict === "approved") {
    nextStatus = "shipped";
  }

  const rows = await sql`
    update projects set
      status = ${nextStatus},
      reviewer_note = ${feedback},
      on_hold = false,
      hold_reason = null,
      updated_at = now()
    where id = ${id} and status = 'second_pass'
    returning id
  `;
  return rows.length > 0;
}

export async function setProjectHold(id: ProjectId, onHold: boolean, reason: string | null) {
  await sql`
    update projects set
      on_hold = ${onHold},
      hold_reason = ${onHold ? reason : null},
      updated_at = now()
    where id = ${id} and status in ('in_review', 'second_pass')
  `;
}

export async function adminUpdateProject(
  id: ProjectId,
  fields: {
    title: string;
    description: string;
    image_url: string | null;
    link_url: string | null;
    github_url: string | null;
  },
) {
  await sql`
    update projects set
      title = ${fields.title},
      description = ${fields.description},
      image_url = ${fields.image_url},
      link_url = ${fields.link_url},
      github_url = ${fields.github_url},
      updated_at = now()
    where id = ${id}
  `;
}

export async function startFulfillment(id: ProjectId): Promise<boolean> {
  const rows = await sql`
    update projects set status = 'fulfillment_started', updated_at = now()
    where id = ${id} and status = 'shipped'
    returning id
  `;
  return rows.length > 0;
}

export async function markRewardOrdered(id: ProjectId): Promise<boolean> {
  const rows = await sql`
    update projects set reward_ordered_at = now(), updated_at = now()
    where id = ${id}
      and status = 'fulfillment_started'
      and reward_ordered_at is null
    returning id
  `;
  return rows.length > 0;
}

export async function markRewardSent(id: ProjectId): Promise<boolean> {
  const rows = await sql`
    update projects set reward_sent_at = now(), updated_at = now()
    where id = ${id}
      and status = 'fulfillment_started'
      and reward_ordered_at is not null
      and reward_sent_at is null
    returning id
  `;
  return rows.length > 0;
}

export async function fulfillProject(
  id: ProjectId,
  adminSlackId: string,
): Promise<boolean> {
  const rows = await sql`
    update projects set
      status = 'fulfilled',
      fulfilled_at = now(),
      fulfilled_by = ${adminSlackId},
      updated_at = now()
    where id = ${id}
      and status = 'fulfillment_started'
      and reward is not null
    returning id
  `;
  return rows.length > 0;
}

export async function setProjectReward(id: ProjectId, reward: string | null) {
  await sql`
    update projects set reward = ${reward}, updated_at = now()
    where id = ${id} and status in ('shipped', 'fulfillment_started')
  `;
}
