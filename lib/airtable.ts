import "server-only";
import { sql } from "@/lib/db";
import { decryptPII } from "@/lib/crypto";
import { listUnits } from "@/lib/units";
import { fetchHackatimeAirtableInfo } from "@/lib/hackatime";
import {
  absoluteImageUrl,
  buildAirtableFields,
  contributionLines,
  groupProjectNote,
  hoursFromSeconds,
  type AirtableInput,
} from "@/lib/airtable-fields";

const BASE_ID = "appNO48Yez9uXr3WO";
const TABLE_ID = "tblhePZpKLlIA3ZHh";
const TIMEOUT_MS = 10_000;

function normalizeBirthday(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

async function loadInput(projectId: number, profileId: string): Promise<AirtableInput | null> {
  const [row] = await sql`
    select
      p.github_url, p.link_url, p.description, p.image_url, p.hackatime_seconds,
      p.hackatime_projects, p.hackatime_seconds_prev, p.owner_seconds, p.owner_seconds_prev,
      p.profile_id as owner_profile_id,
      o.slack_id, o.email, o.first_name, o.last_name, o.birthday, o.address_line1,
      o.address_line2, o.address_city, o.address_state, o.address_country,
      o.address_postal,
      (
        select r.technical_notes from project_reviews r
        where r.project_id = p.id and r.pass = 'second' and r.verdict = 'approved'
        order by r.created_at desc limit 1
      ) as technical_notes,
      (
        select r.additional_notes from project_reviews r
        where r.project_id = p.id and r.pass = 'second' and r.verdict = 'approved'
        order by r.created_at desc limit 1
      ) as additional_notes
    from projects p join profiles o on o.id = ${profileId}
    where p.id = ${projectId}
  `;
  if (!row) {
    return null;
  }

  let linked: string[] = row.hackatime_projects ?? [];
  let seconds: number | null;
  let secondsPrev: number | null;
  if (row.owner_profile_id === profileId) {
    seconds = row.owner_seconds ?? row.hackatime_seconds;
    secondsPrev = row.owner_seconds === null ? row.hackatime_seconds_prev : row.owner_seconds_prev;
  } else {
    const [member] = await sql<
      { hackatime_projects: string[]; hackatime_seconds: number | null; hackatime_seconds_prev: number | null }[]
    >`
      select hackatime_projects, hackatime_seconds, hackatime_seconds_prev
      from project_collaborators where project_id = ${projectId} and profile_id = ${profileId}
    `;
    if (!member) {
      return null;
    }
    linked = member.hackatime_projects ?? [];
    seconds = member.hackatime_seconds;
    secondsPrev = member.hackatime_seconds_prev;
  }

  const hackatime = await fetchHackatimeAirtableInfo(row.slack_id, linked);
  const newSeconds =
    seconds === null || seconds === undefined
      ? null
      : Math.max(0, Number(seconds) - (Number(secondsPrev) || 0));

  const teamNames = await sql<{ name: string }[]>`
    select coalesce(nullif(o.first_name || ' ' || coalesce(o.last_name, ''), ' '), o.name) as name
    from projects p join profiles o on o.id = p.profile_id where p.id = ${projectId}
    union all
    select coalesce(nullif(o.first_name || ' ' || coalesce(o.last_name, ''), ' '), o.name)
    from project_collaborators c join profiles o on o.id = c.profile_id where c.project_id = ${projectId}
  `;
  const entries = await sql<{ title: string | null; content: string; created_at: string }[]>`
    select title, content, created_at from project_journal
    where project_id = ${projectId} and profile_id = ${profileId}
    order by created_at desc limit 10
  `;
  const contributions = teamNames.length > 1 ? contributionLines(entries) : "";
  const additionalNotes = [row.additional_notes ?? "", contributions ? `Work by this person:\n${contributions}` : ""]
    .filter(Boolean)
    .join("\n\n");

  return {
    repoUrl: row.github_url ?? "",
    demoUrl: row.link_url ?? "",
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    email: row.email ?? "",
    description: row.description ?? "",
    imageUrl: absoluteImageUrl(row.image_url),
    hours: hoursFromSeconds(newSeconds),
    hackatimeProjects: linked,
    hackatimeRanges: hackatime.ranges,
    submitterHackatimeId: hackatime.userId,
    groupNote: groupProjectNote(teamNames.map((member) => member.name)),
    technicalNotes: row.technical_notes ?? "",
    additionalNotes,
    birthday: normalizeBirthday(decryptPII(row.birthday)),
    addressLine1: decryptPII(row.address_line1),
    addressLine2: decryptPII(row.address_line2),
    city: decryptPII(row.address_city),
    state: decryptPII(row.address_state),
    country: decryptPII(row.address_country),
    zip: decryptPII(row.address_postal),
  };
}

export type PushResult = { ok: true; recordId: string } | { ok: false; error: string };

async function ownerProfileId(projectId: number): Promise<string | null> {
  const [row] = await sql<{ profile_id: string }[]>`select profile_id from projects where id = ${projectId}`;
  return row?.profile_id ?? null;
}

export async function pushWonderToAirtable(
  projectId: number,
  opts: { forceNew?: boolean; profileId?: string } = {},
): Promise<PushResult> {
  const owner = await ownerProfileId(projectId);
  const profileId = opts.profileId ?? owner;
  if (!owner || !profileId) {
    return { ok: false, error: "wonder not found" };
  }
  const isOwner = profileId === owner;

  const token = process.env.AIRTABLE_PAT;
  if (!token) {
    return recordFailure(projectId, profileId, isOwner, "AIRTABLE_PAT is not set");
  }

  try {
    const input = await loadInput(projectId, profileId);
    if (!input) {
      return { ok: false, error: "person not on this wonder" };
    }
    const [existing] = isOwner
      ? await sql<{ airtable_record_id: string | null }[]>`
          select airtable_record_id from projects where id = ${projectId}
        `
      : await sql<{ airtable_record_id: string | null }[]>`
          select airtable_record_id from project_collaborators
          where project_id = ${projectId} and profile_id = ${profileId}
        `;
    const recordId = opts.forceNew ? null : (existing?.airtable_record_id ?? null);
    const base = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;
    const res = await fetch(recordId ? `${base}/${recordId}` : base, {
      method: recordId ? "PATCH" : "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fields: buildAirtableFields(input), typecast: true }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const text = (await res.text()).slice(0, 300);
      return recordFailure(projectId, profileId, isOwner, `Airtable ${res.status}: ${text}`);
    }
    const body = (await res.json()) as { id?: string };
    if (!body.id) {
      return recordFailure(projectId, profileId, isOwner, "Airtable returned no record id");
    }
    if (isOwner) {
      await sql`
        update projects set
          airtable_record_id = ${body.id},
          airtable_record_ids = case
            when ${body.id} = any(airtable_record_ids) then airtable_record_ids
            else array_append(airtable_record_ids, ${body.id}::text)
          end,
          airtable_pushed_at = now(),
          airtable_error = null
        where id = ${projectId}
      `;
    } else {
      await sql`
        update project_collaborators set
          airtable_record_id = ${body.id},
          airtable_record_ids = case
            when ${body.id} = any(airtable_record_ids) then airtable_record_ids
            else array_append(airtable_record_ids, ${body.id}::text)
          end,
          airtable_pushed_at = now(),
          airtable_error = null
        where project_id = ${projectId} and profile_id = ${profileId}
      `;
    }
    return { ok: true, recordId: body.id };
  } catch (error) {
    return recordFailure(projectId, profileId, isOwner, (error as Error).message);
  }
}

async function recordFailure(
  projectId: number,
  profileId: string,
  isOwner: boolean,
  message: string,
): Promise<PushResult> {
  const error = message.slice(0, 500);
  try {
    if (isOwner) {
      await sql`update projects set airtable_error = ${error} where id = ${projectId}`;
    } else {
      await sql`
        update project_collaborators set airtable_error = ${error}
        where project_id = ${projectId} and profile_id = ${profileId}
      `;
    }
  } catch {}
  return { ok: false, error };
}

export async function pushWonderUnits(
  projectId: number,
  opts: { onlyMissing?: boolean } = {},
): Promise<{ profileId: string; name: string; result: PushResult }[]> {
  const units = (await listUnits([projectId])).get(projectId) ?? [];
  const out: { profileId: string; name: string; result: PushResult }[] = [];
  for (const unit of units) {
    if (opts.onlyMissing && unit.airtableRecordId) continue;
    const result = await pushWonderToAirtable(projectId, {
      profileId: unit.profileId,
      forceNew: !opts.onlyMissing && unit.secondsPrev !== null,
    });
    out.push({ profileId: unit.profileId, name: unit.name, result });
  }
  return out;
}

export interface AirtableUnitState {
  profileId: string;
  name: string;
  kind: "owner" | "collaborator";
  recordId: string | null;
  pushedAt: string | null;
  error: string | null;
}

export async function getAirtableState(projectId: number): Promise<AirtableUnitState[]> {
  const units = (await listUnits([projectId])).get(projectId) ?? [];
  return units.map((unit) => ({
    profileId: unit.profileId,
    name: unit.name,
    kind: unit.kind,
    recordId: unit.airtableRecordId,
    pushedAt: unit.airtablePushedAt,
    error: unit.airtableError,
  }));
}

export const AIRTABLE_STATUS_FIELD = "Automation - Status";
export const AIRTABLE_SUBMITTED_STATUS = "2\u2013Submitted";
const UNIFIED_ID_FIELD = "Automation - YSWS Record ID";
const RECORD_ID_PATTERN = /^rec[A-Za-z0-9]{14}$/;
const LOOKUP_CHUNK = 40;

export type RecordLookup =
  | { kind: "found"; submitted: boolean; unifiedId: string | null }
  | { kind: "missing" }
  | { kind: "error"; error: string };

export function airtableRecordUrl(recordId: string): string | null {
  return RECORD_ID_PATTERN.test(recordId)
    ? `https://airtable.com/${BASE_ID}/${TABLE_ID}/${recordId}`
    : null;
}

async function lookupChunk(token: string, ids: string[], out: Map<string, RecordLookup>) {
  const formula = `OR(${ids.map((id) => `RECORD_ID()='${id}'`).join(",")})`;
  const query = new URLSearchParams({ filterByFormula: formula, pageSize: "100" });
  query.append("fields[]", AIRTABLE_STATUS_FIELD);
  query.append("fields[]", UNIFIED_ID_FIELD);
  try {
    const res = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?${query}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const body = (await res.json().catch(() => null)) as {
      records?: { id: string; fields?: Record<string, unknown> }[];
      error?: { message?: string };
    } | null;
    if (!res.ok || !body?.records) {
      const error = body?.error?.message ?? `Airtable returned ${res.status}`;
      for (const id of ids) out.set(id, { kind: "error", error });
      return;
    }
    const seen = new Set<string>();
    for (const record of body.records) {
      seen.add(record.id);
      const fields = record.fields ?? {};
      const unified = fields[UNIFIED_ID_FIELD];
      out.set(record.id, {
        kind: "found",
        submitted: fields[AIRTABLE_STATUS_FIELD] === AIRTABLE_SUBMITTED_STATUS,
        unifiedId: typeof unified === "string" && RECORD_ID_PATTERN.test(unified.trim()) ? unified.trim() : null,
      });
    }
    for (const id of ids) {
      if (!seen.has(id)) out.set(id, { kind: "missing" });
    }
  } catch (err) {
    const error = `Airtable request failed: ${(err as Error).message}`;
    for (const id of ids) out.set(id, { kind: "error", error });
  }
}

export async function fetchSubmissionStates(recordIds: string[]): Promise<Map<string, RecordLookup>> {
  const out = new Map<string, RecordLookup>();
  const token = process.env.AIRTABLE_PAT;
  const valid: string[] = [];
  for (const id of new Set(recordIds)) {
    if (!RECORD_ID_PATTERN.test(id)) out.set(id, { kind: "missing" });
    else if (!token) out.set(id, { kind: "error", error: "AIRTABLE_PAT is not set" });
    else valid.push(id);
  }
  if (!token) return out;
  for (let i = 0; i < valid.length; i += LOOKUP_CHUNK) {
    await lookupChunk(token, valid.slice(i, i + LOOKUP_CHUNK), out);
  }
  return out;
}

export type UnifiedSummary =
  | { state: "unified" }
  | { state: "waiting" }
  | { state: "not_pushed" }
  | { state: "error"; error: string };

export function summarizeUnified(recordIds: string[], states: Map<string, RecordLookup>): UnifiedSummary {
  if (recordIds.length === 0) return { state: "not_pushed" };
  let error: string | null = null;
  for (const id of recordIds) {
    const lookup = states.get(id);
    if (lookup?.kind === "found" && lookup.submitted) return { state: "unified" };
    if (lookup?.kind === "error") error = lookup.error;
  }
  return error ? { state: "error", error } : { state: "waiting" };
}

export async function isUnitInUnified(projectId: number, profileId: string): Promise<boolean> {
  const units = (await listUnits([projectId])).get(projectId) ?? [];
  const unit = units.find((item) => item.profileId === profileId);
  if (!unit || unit.airtableIds.length === 0) return false;
  const states = await fetchSubmissionStates(unit.airtableIds);
  return summarizeUnified(unit.airtableIds, states).state === "unified";
}

export async function pushAllMissingToAirtable(): Promise<{ pushed: number; failed: number }> {
  const rows = await sql<{ id: number }[]>`
    select id from projects
    where status in ('shipped', 'fulfillment_started', 'fulfilled') and banned_at is null
    order by id
  `;
  const units = await listUnits(rows.map((row) => row.id));
  let pushed = 0;
  let failed = 0;
  for (const [projectId, list] of units) {
    for (const unit of list) {
      if (unit.airtableRecordId) continue;
      const result = await pushWonderToAirtable(projectId, { profileId: unit.profileId });
      if (result.ok) pushed += 1;
      else failed += 1;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  return { pushed, failed };
}
