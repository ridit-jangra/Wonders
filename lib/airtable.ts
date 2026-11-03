import "server-only";
import { sql } from "@/lib/db";
import { decryptPII } from "@/lib/crypto";
import type { Project } from "@/lib/projects";
import { absoluteImageUrl, buildAirtableFields, hoursFromSeconds, type AirtableInput } from "@/lib/airtable-fields";

const BASE_ID = "appNO48Yez9uXr3WO";
const TABLE_ID = "tblhePZpKLlIA3ZHh";
const TIMEOUT_MS = 10_000;

function normalizeBirthday(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

async function loadInput(projectId: number): Promise<AirtableInput | null> {
  const [row] = await sql`
    select
      p.github_url, p.link_url, p.description, p.image_url, p.hackatime_seconds,
      p.hackatime_projects,
      o.email, o.first_name, o.last_name, o.birthday, o.address_line1,
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
    from projects p join profiles o on o.id = p.profile_id
    where p.id = ${projectId}
  `;
  if (!row) {
    return null;
  }
  return {
    repoUrl: row.github_url ?? "",
    demoUrl: row.link_url ?? "",
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    email: row.email ?? "",
    description: row.description ?? "",
    imageUrl: absoluteImageUrl(row.image_url),
    hours: hoursFromSeconds(row.hackatime_seconds),
    hackatimeProjects: row.hackatime_projects ?? [],
    technicalNotes: row.technical_notes ?? "",
    additionalNotes: row.additional_notes ?? "",
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

export async function pushWonderToAirtable(projectId: number): Promise<PushResult> {
  const token = process.env.AIRTABLE_PAT;
  if (!token) {
    return recordFailure(projectId, "AIRTABLE_PAT is not set");
  }

  try {
    const input = await loadInput(projectId);
    if (!input) {
      return { ok: false, error: "wonder not found" };
    }
    const [existing] = await sql<{ airtable_record_id: string | null }[]>`
      select airtable_record_id from projects where id = ${projectId}
    `;
    const recordId = existing?.airtable_record_id ?? null;
    const base = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;
    const res = await fetch(recordId ? `${base}/${recordId}` : base, {
      method: recordId ? "PATCH" : "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fields: buildAirtableFields(input), typecast: true }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      const text = (await res.text()).slice(0, 300);
      return recordFailure(projectId, `Airtable ${res.status}: ${text}`);
    }
    const body = (await res.json()) as { id?: string };
    if (!body.id) {
      return recordFailure(projectId, "Airtable returned no record id");
    }
    await sql`
      update projects set
        airtable_record_id = ${body.id},
        airtable_pushed_at = now(),
        airtable_error = null
      where id = ${projectId}
    `;
    return { ok: true, recordId: body.id };
  } catch (error) {
    return recordFailure(projectId, (error as Error).message);
  }
}

async function recordFailure(projectId: number, message: string): Promise<PushResult> {
  const error = message.slice(0, 500);
  try {
    await sql`update projects set airtable_error = ${error} where id = ${projectId}`;
  } catch {}
  return { ok: false, error };
}

export type AirtableState = Pick<Project, "id"> & {
  airtable_record_id: string | null;
  airtable_pushed_at: string | null;
  airtable_error: string | null;
};

export async function getAirtableState(projectId: number): Promise<AirtableState | null> {
  const [row] = await sql<AirtableState[]>`
    select id, airtable_record_id, airtable_pushed_at, airtable_error
    from projects where id = ${projectId}
  `;
  return row ?? null;
}
