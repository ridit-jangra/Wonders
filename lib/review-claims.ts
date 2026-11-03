import "server-only";
import { sql } from "@/lib/db";
import type { ProjectId } from "@/lib/projects";

export const CLAIM_TTL_SECONDS = 300;

export interface ReviewClaim {
  claimed_by: string;
  claimed_at: string;
  heartbeat_at: string;
}

export async function getActiveClaim(projectId: ProjectId): Promise<ReviewClaim | null> {
  const [claim] = await sql<ReviewClaim[]>`
    select claimed_by, claimed_at, heartbeat_at
    from review_claims
    where project_id = ${Number(projectId)}
      and heartbeat_at > now() - make_interval(secs => ${CLAIM_TTL_SECONDS})
  `;
  return claim ?? null;
}

export async function claimReview(
  projectId: ProjectId,
  slackId: string,
): Promise<{ held: boolean; holder: string }> {
  const rows = await sql<{ claimed_by: string }[]>`
    insert into review_claims (project_id, claimed_by)
    values (${Number(projectId)}, ${slackId})
    on conflict (project_id) do update set
      claimed_by = excluded.claimed_by,
      claimed_at = case
        when review_claims.claimed_by = excluded.claimed_by then review_claims.claimed_at
        else now()
      end,
      heartbeat_at = now()
    where review_claims.claimed_by = excluded.claimed_by
      or review_claims.heartbeat_at <= now() - make_interval(secs => ${CLAIM_TTL_SECONDS})
    returning claimed_by
  `;
  if (rows.length > 0) {
    return { held: true, holder: slackId };
  }
  const current = await getActiveClaim(projectId);
  return { held: false, holder: current?.claimed_by ?? "" };
}

export async function releaseReview(projectId: ProjectId, slackId: string) {
  await sql`
    delete from review_claims
    where project_id = ${Number(projectId)} and claimed_by = ${slackId}
  `;
}

export async function clearClaim(projectId: ProjectId) {
  await sql`delete from review_claims where project_id = ${Number(projectId)}`;
}

export async function claimBlockedBy(
  projectId: ProjectId,
  slackId: string,
): Promise<string | null> {
  const claim = await getActiveClaim(projectId);
  if (claim && claim.claimed_by !== slackId) {
    return claim.claimed_by;
  }
  return null;
}
