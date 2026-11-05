import "server-only";
import { sql } from "@/lib/db";
import { generateInviteCode, MAX_COLLABORATORS } from "@/lib/collab-code";
import { fetchHackatimeProjects } from "@/lib/hackatime";
import { getHackatimeToken } from "@/lib/profiles";
import type { Project, ProjectId } from "@/lib/projects";

export type Role = "owner" | "collaborator";

export interface Member {
  role: Role;
  profileId: string;
  slackId: string;
  name: string;
  avatarUrl: string | null;
  journalCount: number;
}

export async function getRole(projectId: ProjectId, profileId: string): Promise<Role | null> {
  const [row] = await sql<{ role: Role }[]>`
    select case when p.profile_id = ${profileId} then 'owner' else 'collaborator' end as role
    from projects p
    where p.id = ${projectId}
      and (
        p.profile_id = ${profileId}
        or exists (
          select 1 from project_collaborators c
          where c.project_id = p.id and c.profile_id = ${profileId}
        )
      )
  `;
  return row?.role ?? null;
}

export async function listMembers(projectId: ProjectId): Promise<Member[]> {
  const rows = await sql<
    {
      role: Role;
      profile_id: string;
      slack_id: string;
      name: string;
      slack_display_name: string | null;
      slack_avatar_url: string | null;
      journal_count: number;
    }[]
  >`
    select 'owner' as role, o.id as profile_id, o.slack_id, o.name, o.slack_display_name,
      o.slack_avatar_url,
      (select count(*)::int from project_journal j where j.project_id = p.id and j.profile_id = o.id) as journal_count,
      0 as sort, null::timestamptz as joined_at
    from projects p join profiles o on o.id = p.profile_id
    where p.id = ${projectId}
    union all
    select 'collaborator', o.id, o.slack_id, o.name, o.slack_display_name,
      o.slack_avatar_url,
      (select count(*)::int from project_journal j where j.project_id = c.project_id and j.profile_id = o.id),
      1, c.joined_at
    from project_collaborators c join profiles o on o.id = c.profile_id
    where c.project_id = ${projectId}
    order by sort, joined_at
  `;
  return rows.map((row) => ({
    role: row.role,
    profileId: row.profile_id,
    slackId: row.slack_id,
    name: row.slack_display_name || row.name,
    avatarUrl: row.slack_avatar_url,
    journalCount: row.journal_count,
  }));
}

export async function listCollaboratorSlackIds(projectId: ProjectId): Promise<string[]> {
  const rows = await sql<{ slack_id: string }[]>`
    select o.slack_id from project_collaborators c
    join profiles o on o.id = c.profile_id
    where c.project_id = ${projectId}
  `;
  return rows.map((row) => row.slack_id);
}

export async function getInviteCode(projectId: ProjectId, ownerProfileId: string): Promise<string | null> {
  const [row] = await sql<{ invite_code: string | null }[]>`
    select invite_code from projects where id = ${projectId} and profile_id = ${ownerProfileId}
  `;
  return row?.invite_code ?? null;
}

export async function resetInviteCode(
  projectId: ProjectId,
  ownerProfileId: string,
  mode: "create" | "revoke",
): Promise<string | null> {
  if (mode === "revoke") {
    await sql`update projects set invite_code = null where id = ${projectId} and profile_id = ${ownerProfileId}`;
    return null;
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateInviteCode();
    try {
      const rows = await sql`
        update projects set invite_code = ${code}
        where id = ${projectId} and profile_id = ${ownerProfileId} and banned_at is null
        returning id
      `;
      return rows.length > 0 ? code : null;
    } catch {
      continue;
    }
  }
  return null;
}

export type JoinResult =
  | { ok: true; projectId: number; isNew: boolean }
  | { ok: false; error: "invalid" | "own" | "full" | "banned" | "closed" };

export async function joinByCode(profileId: string, code: string): Promise<JoinResult> {
  const [project] = await sql<
    { id: number; profile_id: string; banned_at: string | null; status: string }[]
  >`
    select id, profile_id, banned_at, status from projects where invite_code = ${code}
  `;
  if (!project) return { ok: false, error: "invalid" };
  if (project.status === "fulfilled") return { ok: false, error: "closed" };
  if (project.banned_at) return { ok: false, error: "banned" };
  if (project.profile_id === profileId) return { ok: false, error: "own" };

  const rows = await sql`
    insert into project_collaborators (project_id, profile_id)
    select ${project.id}, ${profileId}
    where (select count(*) from project_collaborators where project_id = ${project.id}) < ${MAX_COLLABORATORS}
    on conflict (project_id, profile_id) do nothing
    returning project_id
  `;
  if (rows.length === 0) {
    const [existing] = await sql`
      select 1 from project_collaborators where project_id = ${project.id} and profile_id = ${profileId}
    `;
    if (!existing) return { ok: false, error: "full" };
  }
  return { ok: true, projectId: project.id, isNew: rows.length > 0 };
}

export async function removeCollaborator(
  projectId: ProjectId,
  actorProfileId: string,
  targetProfileId: string,
): Promise<boolean> {
  const rows = await sql`
    delete from project_collaborators c
    using projects p
    where c.project_id = p.id
      and p.id = ${projectId}
      and c.profile_id = ${targetProfileId}
      and (p.profile_id = ${actorProfileId} or c.profile_id = ${actorProfileId})
    returning c.project_id
  `;
  return rows.length > 0;
}

export async function getCollaboratorLinks(projectId: ProjectId, profileId: string): Promise<string[]> {
  const [row] = await sql<{ hackatime_projects: string[] }[]>`
    select hackatime_projects from project_collaborators
    where project_id = ${projectId} and profile_id = ${profileId}
  `;
  return row?.hackatime_projects ?? [];
}

export async function setCollaboratorLinks(projectId: ProjectId, profileId: string, links: string[]) {
  await sql`
    update project_collaborators set hackatime_projects = ${links}
    where project_id = ${projectId} and profile_id = ${profileId}
  `;
}

export async function listCollaboratedProjectIds(profileId: string): Promise<number[]> {
  const rows = await sql<{ project_id: number }[]>`
    select project_id from project_collaborators where profile_id = ${profileId}
  `;
  return rows.map((row) => row.project_id);
}

async function memberSeconds(profileId: string, links: string[]): Promise<number | null> {
  if (links.length === 0) return 0;
  const token = await getHackatimeToken(profileId);
  if (!token) return 0;
  const tracked = await fetchHackatimeProjects(token);
  if (!tracked) return null;
  return tracked.filter((p) => links.includes(p.name)).reduce((sum, p) => sum + p.seconds, 0);
}

export interface TeamSeconds {
  total: number;
  owner: number;
  collaborators: { profileId: string; seconds: number }[];
}

export async function computeTeamSeconds(project: Project): Promise<TeamSeconds | null> {
  const collaborators = await sql<{ profile_id: string; hackatime_projects: string[] }[]>`
    select profile_id, hackatime_projects from project_collaborators where project_id = ${project.id}
  `;
  const [owner, ...others] = await Promise.all([
    memberSeconds(project.profile_id, project.hackatime_projects),
    ...collaborators.map((c) => memberSeconds(c.profile_id, c.hackatime_projects)),
  ]);
  if (owner === null || others.some((part) => part === null)) return null;
  const list = collaborators.map((c, index) => ({
    profileId: c.profile_id,
    seconds: others[index] ?? 0,
  }));
  return {
    total: owner + list.reduce((sum, item) => sum + item.seconds, 0),
    owner,
    collaborators: list,
  };
}

export async function computeWonderSeconds(project: Project): Promise<number | null> {
  return (await computeTeamSeconds(project))?.total ?? null;
}

export async function saveCollaboratorSeconds(
  projectId: ProjectId,
  wasLive: boolean,
  list: { profileId: string; seconds: number }[],
) {
  for (const item of list) {
    await sql`
      update project_collaborators set
        hackatime_seconds_prev = case when ${wasLive} then hackatime_seconds else hackatime_seconds_prev end,
        hackatime_seconds = ${item.seconds}
      where project_id = ${projectId} and profile_id = ${item.profileId}
    `;
  }
}

export async function listTeammatePhoneStatus(
  projectId: ProjectId,
  viewerProfileId: string,
): Promise<{ profileId: string; name: string; hasPhone: boolean }[]> {
  const rows = await sql<{ profile_id: string; name: string; has_phone: boolean }[]>`
    select o.id as profile_id, coalesce(nullif(o.slack_display_name, ''), o.name) as name,
      (o.shipping_phone is not null) as has_phone
    from projects p join profiles o on o.id = p.profile_id
    where p.id = ${projectId} and o.id <> ${viewerProfileId}
    union all
    select o.id, coalesce(nullif(o.slack_display_name, ''), o.name), (o.shipping_phone is not null)
    from project_collaborators c join profiles o on o.id = c.profile_id
    where c.project_id = ${projectId} and o.id <> ${viewerProfileId}
  `;
  return rows.map((row) => ({ profileId: row.profile_id, name: row.name, hasPhone: row.has_phone }));
}
