import "server-only";
import { sql } from "@/lib/db";
import type { ProjectId } from "@/lib/projects";
import {
  JOURNAL_MAX_CONTENT,
  JOURNAL_MAX_ENTRIES,
  JOURNAL_MAX_TITLE,
  stripDisallowedImages,
} from "@/lib/journal-shared";

export interface JournalEntry {
  id: string;
  title: string | null;
  content: string;
  createdAt: string;
  editedAt: string | null;
  mine?: boolean;
  authorName?: string;
  authorAvatar?: string | null;
}

const COLUMNS = () => sql`
  id, title, content, created_at as "createdAt", edited_at as "editedAt"
`;

export async function listJournal(projectId: ProjectId, profileId: string): Promise<JournalEntry[]> {
  return sql<JournalEntry[]>`
    select ${COLUMNS()} from project_journal
    where project_id = ${projectId} and profile_id = ${profileId}
    order by created_at desc, id desc
    limit ${JOURNAL_MAX_ENTRIES}
  `;
}

export async function listJournalForMember(
  projectId: ProjectId,
  viewerProfileId: string,
): Promise<JournalEntry[]> {
  return sql<JournalEntry[]>`
    select j.id, j.title, j.content, j.created_at as "createdAt", j.edited_at as "editedAt",
      (j.profile_id = ${viewerProfileId}) as mine,
      coalesce(a.slack_display_name, a.name) as "authorName",
      a.slack_avatar_url as "authorAvatar"
    from project_journal j
    join profiles a on a.id = j.profile_id
    where j.project_id = ${projectId}
    order by j.created_at desc, j.id desc
    limit ${JOURNAL_MAX_ENTRIES}
  `;
}

export async function listJournalAdmin(projectId: ProjectId): Promise<JournalEntry[]> {
  return sql<JournalEntry[]>`
    select ${COLUMNS()} from project_journal
    where project_id = ${projectId}
    order by created_at desc, id desc
    limit ${JOURNAL_MAX_ENTRIES}
  `;
}

export async function countJournalAdmin(projectId: ProjectId): Promise<number> {
  const [row] = await sql<{ total: number }[]>`
    select count(*)::int as total from project_journal where project_id = ${projectId}
  `;
  return row?.total ?? 0;
}

function clean(title: string, content: string) {
  return {
    title: title.trim().slice(0, JOURNAL_MAX_TITLE) || null,
    content: stripDisallowedImages(content.trim()).slice(0, JOURNAL_MAX_CONTENT),
  };
}

export async function addJournalEntry(
  projectId: ProjectId,
  profileId: string,
  input: { title: string; content: string },
): Promise<boolean> {
  const { title, content } = clean(input.title, input.content);
  if (!content) return false;
  const rows = await sql`
    insert into project_journal (project_id, profile_id, title, content)
    select p.id, ${profileId}, ${title}, ${content}
    from projects p
    where p.id = ${projectId}
      and (
        p.profile_id = ${profileId}
        or exists (
          select 1 from project_collaborators c
          where c.project_id = p.id and c.profile_id = ${profileId}
        )
      )
      and (select count(*) from project_journal j where j.project_id = p.id) < ${JOURNAL_MAX_ENTRIES}
    returning id
  `;
  return rows.length > 0;
}

export async function editJournalEntry(
  entryId: string,
  projectId: ProjectId,
  profileId: string,
  input: { title: string; content: string },
): Promise<boolean> {
  const { title, content } = clean(input.title, input.content);
  if (!content) return false;
  const rows = await sql`
    update project_journal set title = ${title}, content = ${content}, edited_at = now()
    where id = ${entryId} and project_id = ${projectId} and profile_id = ${profileId}
    returning id
  `;
  return rows.length > 0;
}

export async function deleteJournalEntry(
  entryId: string,
  projectId: ProjectId,
  profileId: string,
): Promise<boolean> {
  const rows = await sql`
    delete from project_journal
    where id = ${entryId} and project_id = ${projectId} and profile_id = ${profileId}
    returning id
  `;
  return rows.length > 0;
}
