import "server-only";
import { sql } from "@/lib/db";
import { getStaffAccess, isStaffSlackId } from "@/lib/admin";
import { canManagePlayers } from "@/lib/security/roles";

export const SLACK_ID_PATTERN = /^[UW][A-Z0-9]{6,}$/;

export interface DashboardAccessRow {
  slack_id: string;
  added_by: string;
  created_at: string;
  name: string | null;
}

export async function hasDashboardAccess(slackId: string): Promise<boolean> {
  if (await isStaffSlackId(slackId)) return true;
  const [row] = await sql`select 1 from dashboard_access where slack_id = ${slackId}`;
  return Boolean(row);
}

export async function canSeeAdminButton(slackId: string): Promise<boolean> {
  return canManagePlayers(await getStaffAccess(slackId));
}

export async function listDashboardAccess(): Promise<DashboardAccessRow[]> {
  return sql<DashboardAccessRow[]>`
    select d.slack_id, d.added_by, d.created_at,
      coalesce(p.slack_display_name, p.name) as name
    from dashboard_access d left join profiles p on p.slack_id = d.slack_id
    order by d.created_at desc
  `;
}

export function parseSlackIds(input: string): string[] {
  const found = new Set<string>();
  for (const part of input.split(/[\s,;]+/)) {
    const id = part.trim().toUpperCase();
    if (SLACK_ID_PATTERN.test(id)) found.add(id);
  }
  return [...found].slice(0, 50);
}

export async function grantDashboardAccess(slackIds: string[], addedBy: string): Promise<number> {
  if (slackIds.length === 0) return 0;
  const rows = await sql`
    insert into dashboard_access (slack_id, added_by)
    select unnest(${slackIds}::text[]), ${addedBy}
    on conflict (slack_id) do nothing
    returning slack_id
  `;
  return rows.length;
}

export async function revokeDashboardAccess(slackId: string): Promise<boolean> {
  const rows = await sql`delete from dashboard_access where slack_id = ${slackId} returning slack_id`;
  return rows.length > 0;
}
