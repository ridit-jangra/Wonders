import "server-only";
import { sql } from "@/lib/db";
import type { ProjectId } from "@/lib/projects";

export interface FulfillmentUnit {
  kind: "owner" | "collaborator";
  unitId: number | null;
  projectId: number;
  profileId: string;
  slackId: string;
  name: string;
  email: string;
  reward: string | null;
  orderedAt: string | null;
  sentAt: string | null;
  hcbUrl: string | null;
  costCents: number | null;
  sourceUrl: string | null;
  fulfilledAt: string | null;
  grantId: string | null;
  grantCents: number | null;
  grantSentAt: string | null;
  airtableIds: string[];
  airtableRecordId: string | null;
  airtableError: string | null;
  airtablePushedAt: string | null;
  seconds: number | null;
  secondsPrev: number | null;
}

interface UnitRow {
  kind: "owner" | "collaborator";
  unit_id: string | null;
  project_id: number;
  profile_id: string;
  slack_id: string;
  name: string;
  email: string;
  reward: string | null;
  reward_ordered_at: string | null;
  reward_sent_at: string | null;
  reward_hcb_url: string | null;
  reward_cost_cents: number | null;
  reward_source_url: string | null;
  fulfilled_at: string | null;
  hcb_grant_id: string | null;
  hcb_grant_cents: number | null;
  hcb_grant_sent_at: string | null;
  airtable_record_ids: string[];
  airtable_record_id: string | null;
  airtable_error: string | null;
  airtable_pushed_at: string | null;
  seconds: number | null;
  seconds_prev: number | null;
}

export async function listUnits(projectIds: number[]): Promise<Map<number, FulfillmentUnit[]>> {
  const out = new Map<number, FulfillmentUnit[]>();
  if (projectIds.length === 0) return out;
  const rows = await sql<UnitRow[]>`
    select 'owner' as kind, null::bigint as unit_id, p.id as project_id, o.id as profile_id,
      o.slack_id, coalesce(nullif(o.slack_display_name, ''), o.name) as name, o.email,
      p.reward, p.reward_ordered_at, p.reward_sent_at,
      p.reward_hcb_url, p.reward_cost_cents, p.reward_source_url, p.fulfilled_at,
      p.hcb_grant_id, p.hcb_grant_cents, p.hcb_grant_sent_at,
      p.airtable_record_ids, p.airtable_record_id, p.airtable_error, p.airtable_pushed_at,
      coalesce(p.owner_seconds, p.hackatime_seconds) as seconds,
      case when p.owner_seconds is null then p.hackatime_seconds_prev else p.owner_seconds_prev end as seconds_prev,
      0 as sort, null::timestamptz as joined_at
    from projects p join profiles o on o.id = p.profile_id
    where p.id = any(${projectIds}::int[])
    union all
    select 'collaborator', c.id, c.project_id, o.id,
      o.slack_id, coalesce(nullif(o.slack_display_name, ''), o.name), o.email,
      c.reward, c.reward_ordered_at, c.reward_sent_at,
      c.reward_hcb_url, c.reward_cost_cents, c.reward_source_url, c.fulfilled_at,
      c.hcb_grant_id, c.hcb_grant_cents, c.hcb_grant_sent_at,
      c.airtable_record_ids, c.airtable_record_id, c.airtable_error, c.airtable_pushed_at,
      c.hackatime_seconds, c.hackatime_seconds_prev,
      1, c.joined_at
    from project_collaborators c join profiles o on o.id = c.profile_id
    where c.project_id = any(${projectIds}::int[])
    order by project_id, sort, joined_at
  `;
  for (const row of rows) {
    const unit: FulfillmentUnit = {
      kind: row.kind,
      unitId: row.unit_id === null ? null : Number(row.unit_id),
      projectId: row.project_id,
      profileId: row.profile_id,
      slackId: row.slack_id,
      name: row.name,
      email: row.email,
      reward: row.reward,
      orderedAt: row.reward_ordered_at,
      sentAt: row.reward_sent_at,
      hcbUrl: row.reward_hcb_url,
      costCents: row.reward_cost_cents,
      sourceUrl: row.reward_source_url,
      fulfilledAt: row.fulfilled_at,
      grantId: row.hcb_grant_id,
      grantCents: row.hcb_grant_cents,
      grantSentAt: row.hcb_grant_sent_at,
      airtableIds: row.airtable_record_ids ?? [],
      airtableRecordId: row.airtable_record_id,
      airtableError: row.airtable_error,
      airtablePushedAt: row.airtable_pushed_at,
      seconds: row.seconds === null ? null : Number(row.seconds),
      secondsPrev: row.seconds_prev === null ? null : Number(row.seconds_prev),
    };
    const list = out.get(unit.projectId) ?? [];
    list.push(unit);
    out.set(unit.projectId, list);
  }
  return out;
}

export async function getUnit(projectId: ProjectId, profileId: string): Promise<FulfillmentUnit | null> {
  const units = await listUnits([Number(projectId)]);
  return (units.get(Number(projectId)) ?? []).find((unit) => unit.profileId === profileId) ?? null;
}

export async function setUnitReward(unit: FulfillmentUnit, reward: string | null) {
  if (unit.kind === "owner") {
    await sql`
      update projects set reward = ${reward}, updated_at = now()
      where id = ${unit.projectId} and status in ('shipped', 'fulfillment_started')
    `;
    return;
  }
  await sql`
    update project_collaborators c set reward = ${reward}
    from projects p
    where c.project_id = p.id and p.id = ${unit.projectId} and c.profile_id = ${unit.profileId}
      and p.status in ('shipped', 'fulfillment_started')
  `;
}

export async function setUnitOrderDetails(
  unit: FulfillmentUnit,
  details: { hcbUrl: string | null; costCents: number | null; sourceUrl: string | null },
) {
  if (unit.kind === "owner") {
    await sql`
      update projects set reward_hcb_url = ${details.hcbUrl}, reward_cost_cents = ${details.costCents},
        reward_source_url = ${details.sourceUrl}, updated_at = now()
      where id = ${unit.projectId} and status in ('shipped', 'fulfillment_started')
    `;
    return;
  }
  await sql`
    update project_collaborators c set reward_hcb_url = ${details.hcbUrl},
      reward_cost_cents = ${details.costCents}, reward_source_url = ${details.sourceUrl}
    from projects p
    where c.project_id = p.id and p.id = ${unit.projectId} and c.profile_id = ${unit.profileId}
      and p.status in ('shipped', 'fulfillment_started')
  `;
}

export async function markUnitOrdered(unit: FulfillmentUnit): Promise<boolean> {
  const rows =
    unit.kind === "owner"
      ? await sql`
          update projects set reward_ordered_at = now(), updated_at = now()
          where id = ${unit.projectId} and status = 'fulfillment_started' and reward_ordered_at is null
          returning id
        `
      : await sql`
          update project_collaborators c set reward_ordered_at = now()
          from projects p
          where c.project_id = p.id and p.id = ${unit.projectId} and c.profile_id = ${unit.profileId}
            and p.status = 'fulfillment_started' and c.reward_ordered_at is null
          returning c.project_id
        `;
  return rows.length > 0;
}

export async function markUnitSent(unit: FulfillmentUnit): Promise<boolean> {
  const rows =
    unit.kind === "owner"
      ? await sql`
          update projects set reward_sent_at = now(), updated_at = now()
          where id = ${unit.projectId} and status = 'fulfillment_started'
            and reward_ordered_at is not null and reward_sent_at is null
          returning id
        `
      : await sql`
          update project_collaborators c set reward_sent_at = now()
          from projects p
          where c.project_id = p.id and p.id = ${unit.projectId} and c.profile_id = ${unit.profileId}
            and p.status = 'fulfillment_started'
            and c.reward_ordered_at is not null and c.reward_sent_at is null
          returning c.project_id
        `;
  return rows.length > 0;
}

export async function fulfillUnit(unit: FulfillmentUnit, adminSlackId: string): Promise<boolean> {
  const rows =
    unit.kind === "owner"
      ? await sql`
          update projects set fulfilled_at = now(), fulfilled_by = ${adminSlackId}, updated_at = now()
          where id = ${unit.projectId} and status = 'fulfillment_started'
            and reward is not null and fulfilled_at is null and banned_at is null
          returning id
        `
      : await sql`
          update project_collaborators c set fulfilled_at = now(), fulfilled_by = ${adminSlackId}
          from projects p
          where c.project_id = p.id and p.id = ${unit.projectId} and c.profile_id = ${unit.profileId}
            and p.status = 'fulfillment_started' and p.banned_at is null
            and c.reward is not null and c.fulfilled_at is null
          returning c.project_id
        `;
  return rows.length > 0;
}

export async function completeProjectIfDone(projectId: ProjectId): Promise<boolean> {
  const rows = await sql`
    update projects set status = 'fulfilled', updated_at = now()
    where id = ${projectId}
      and status = 'fulfillment_started'
      and fulfilled_at is not null
      and not exists (
        select 1 from project_collaborators c
        where c.project_id = projects.id and c.fulfilled_at is null
      )
    returning id
  `;
  return rows.length > 0;
}

export async function claimUnitGrant(unit: FulfillmentUnit, cents: number): Promise<boolean> {
  const rows =
    unit.kind === "owner"
      ? await sql`
          update projects set hcb_grant_sent_at = now(), hcb_grant_cents = ${cents}
          where id = ${unit.projectId} and hcb_grant_sent_at is null
            and status in ('shipped', 'fulfillment_started') and banned_at is null
          returning id
        `
      : await sql`
          update project_collaborators c set hcb_grant_sent_at = now(), hcb_grant_cents = ${cents}
          from projects p
          where c.project_id = p.id and p.id = ${unit.projectId} and c.profile_id = ${unit.profileId}
            and c.hcb_grant_sent_at is null
            and p.status in ('shipped', 'fulfillment_started') and p.banned_at is null
          returning c.project_id
        `;
  return rows.length > 0;
}

export async function finishUnitGrant(unit: FulfillmentUnit, grantId: string) {
  if (unit.kind === "owner") {
    await sql`update projects set hcb_grant_id = ${grantId} where id = ${unit.projectId}`;
  } else {
    await sql`
      update project_collaborators set hcb_grant_id = ${grantId}
      where project_id = ${unit.projectId} and profile_id = ${unit.profileId}
    `;
  }
}

export async function releaseUnitGrant(unit: FulfillmentUnit) {
  if (unit.kind === "owner") {
    await sql`
      update projects set hcb_grant_sent_at = null, hcb_grant_cents = null
      where id = ${unit.projectId} and hcb_grant_id is null
    `;
  } else {
    await sql`
      update project_collaborators set hcb_grant_sent_at = null, hcb_grant_cents = null
      where project_id = ${unit.projectId} and profile_id = ${unit.profileId} and hcb_grant_id is null
    `;
  }
}

export async function hasFulfillableUnit(profileId: string): Promise<boolean> {
  const [row] = await sql<{ found: boolean }[]>`
    select exists (
      select 1 from projects p
      where p.status in ('shipped', 'fulfillment_started') and p.banned_at is null
        and (
          p.profile_id = ${profileId}
          or exists (
            select 1 from project_collaborators c
            where c.project_id = p.id and c.profile_id = ${profileId}
          )
        )
    ) as found
  `;
  return row?.found ?? false;
}
