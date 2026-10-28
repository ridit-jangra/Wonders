import "server-only";
import { sql } from "@/lib/db";

export interface AccountBan {
  id: string;
  slack_id: string;
  reason: string;
  banned_by: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
}

const COLUMNS = () => sql`
  id, slack_id, reason, banned_by, created_at, expires_at, revoked_at, revoked_by
`;

export async function getActiveBan(slackId: string): Promise<AccountBan | null> {
  const [ban] = await sql<AccountBan[]>`
    select ${COLUMNS()} from account_bans
    where slack_id = ${slackId}
      and revoked_at is null
      and (expires_at is null or expires_at > now())
    order by created_at desc
    limit 1
  `;
  return ban ?? null;
}

export async function listBans(slackId: string): Promise<AccountBan[]> {
  return sql<AccountBan[]>`
    select ${COLUMNS()} from account_bans
    where slack_id = ${slackId}
    order by created_at desc
  `;
}

export async function banPlayer(opts: {
  slackId: string;
  reason: string;
  bannedBy: string;
  days: number | null;
}) {
  await sql`
    insert into account_bans (slack_id, reason, banned_by, expires_at)
    values (
      ${opts.slackId},
      ${opts.reason},
      ${opts.bannedBy},
      ${opts.days ? new Date(Date.now() + opts.days * 86_400_000).toISOString() : null}
    )
  `;
}

export async function unbanPlayer(slackId: string, revokedBy: string) {
  await sql`
    update account_bans
    set revoked_at = now(), revoked_by = ${revokedBy}
    where slack_id = ${slackId}
      and revoked_at is null
      and (expires_at is null or expires_at > now())
  `;
}
