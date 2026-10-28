import "server-only";
import { sql } from "@/lib/db";

export interface AuditEntry {
  id: string;
  actor_slack_id: string;
  action: string;
  target: string | null;
  detail: Record<string, unknown>;
  sensitive: boolean;
  created_at: string;
}

export async function writeAudit(entry: {
  actor: string;
  action: string;
  target?: string | null;
  detail?: Record<string, unknown>;
  sensitive?: boolean;
}) {
  try {
    await sql`
      insert into audit_logs (actor_slack_id, action, target, detail, sensitive)
      values (
        ${entry.actor},
        ${entry.action},
        ${entry.target ?? null},
        ${sql.json((entry.detail ?? {}) as Parameters<typeof sql.json>[0])},
        ${entry.sensitive ?? false}
      )
    `;
  } catch (error) {
    console.error("audit write failed:", (error as Error).message);
  }
}

export async function listAudit(opts: {
  limit: number;
  offset: number;
}): Promise<{ entries: AuditEntry[]; total: number }> {
  const [entries, [{ total }]] = await Promise.all([
    sql<AuditEntry[]>`
      select id, actor_slack_id, action, target, detail, sensitive, created_at
      from audit_logs
      order by created_at desc
      limit ${opts.limit} offset ${opts.offset}
    `,
    sql<{ total: number }[]>`select count(*)::int as total from audit_logs`,
  ]);
  return { entries, total };
}
