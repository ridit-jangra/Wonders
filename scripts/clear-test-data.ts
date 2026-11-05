import postgres from "postgres";
import { YSWS } from "../lib/ysws-config";

const apply = process.argv.includes("--apply");
const skipAirtable = process.argv.includes("--skip-airtable");
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL must be set");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 2 });

async function counts() {
  const [row] = await sql<Record<string, number>[]>`
    select
      (select count(*)::int from projects) as projects,
      (select count(*)::int from project_history) as history,
      (select count(*)::int from project_reviews) as reviews,
      (select count(*)::int from review_drafts) as drafts,
      (select count(*)::int from project_journal) as journal_entries,
      (select count(*)::int from project_collaborators) as collaborators,
      (select count(*)::int from review_claims) as claims,
      (select count(*)::int from thumbnails) as thumbnails
  `;
  return row;
}

async function airtableRecordIds(): Promise<string[]> {
  const rows = await sql<{ id: string }[]>`
    select unnest(airtable_record_ids) as id from projects
    union
    select unnest(airtable_record_ids) as id from project_collaborators
  `;
  return rows.map((row) => row.id).filter((id) => /^rec[A-Za-z0-9]{14}$/.test(id));
}

async function deleteAirtable(ids: string[]) {
  const token = process.env.AIRTABLE_PAT;
  if (!token) {
    console.log("AIRTABLE_PAT is not set, skipping the Airtable rows");
    return;
  }
  let deleted = 0;
  const failed: string[] = [];
  for (const id of ids) {
    const response = await fetch(
      `https://api.airtable.com/v0/${YSWS.airtable.baseId}/${YSWS.airtable.tableId}/${id}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) },
    ).catch(() => null);
    if (response && (response.ok || response.status === 404)) deleted += 1;
    else failed.push(id);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  console.log(`Airtable rows deleted: ${deleted}, failed: ${failed.length}`);
  if (failed.length > 0) console.log("Failed record ids:", failed.join(", "));
  console.log("Rows already forwarded to the Unified YSWS database must be removed by HQ.");
}

const before = await counts();
const recordIds = await airtableRecordIds();
console.log("Will delete:", before, `plus ${recordIds.length} Airtable staging rows`);
console.log("Staying: profiles, staff roles and settings, saved replies, dashboard access, budget estimate, audit log.");

if (!apply) {
  console.log("Dry run only. Add --apply to delete.");
  await sql.end();
  process.exit(0);
}

await sql.begin(async (tx) => {
  await tx`delete from project_history`;
  await tx`delete from projects`;
  await tx`delete from thumbnails`;
  await tx.unsafe("alter table projects alter column id restart with 1");
  await tx.unsafe("alter table project_collaborators alter column id restart with 1");
});

console.log("After:", await counts());

if (!skipAirtable && recordIds.length > 0) {
  await deleteAirtable(recordIds);
}

await sql.end();
