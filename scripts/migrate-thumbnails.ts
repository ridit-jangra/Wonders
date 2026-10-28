import postgres from "postgres";

const apply = process.argv.includes("--apply");
const databaseUrl = process.env.DATABASE_URL;
const key = process.env.HACKCLUB_CDN_API_KEY;

if (!databaseUrl || !key) {
  console.error("DATABASE_URL and HACKCLUB_CDN_API_KEY must be set");
  process.exit(1);
}

const sql = postgres(databaseUrl, { max: 2 });

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

async function upload(id: string, contentType: string, data: Buffer): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(data)], { type: contentType }), `thumbnail-${id}.${EXTENSIONS[contentType] ?? "png"}`);
  const response = await fetch("https://cdn.hackclub.com/api/v4/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  const json = (await response.json().catch(() => null)) as { url?: string } | null;
  if (!response.ok || !json?.url?.startsWith("https://cdn.hackclub.com/")) {
    throw new Error(`upload failed (${response.status})`);
  }
  return json.url;
}

const rows = await sql<{ id: string; content_type: string; bytes: number }[]>`
  select t.id, t.content_type, octet_length(t.data) as bytes
  from thumbnails t
  where exists (select 1 from projects p where p.image_url = '/api/thumbnails/' || t.id)
     or exists (select 1 from project_journal j where position('/api/thumbnails/' || t.id in j.content) > 0)
  order by t.created_at
`;

const total = rows.reduce((sum, row) => sum + row.bytes, 0);
console.log(`${rows.length} referenced thumbnails, ${(total / 1024 / 1024).toFixed(2)} MB`);

if (!apply) {
  console.log("dry run, pass --apply to upload and rewrite links");
  await sql.end();
  process.exit(0);
}

let moved = 0;
let failed = 0;
for (const row of rows) {
  try {
    const [file] = await sql<{ data: Buffer }[]>`select data from thumbnails where id = ${row.id}`;
    const url = await upload(row.id, row.content_type, file.data);
    const old = `/api/thumbnails/${row.id}`;
    const [projects, journal] = await sql.begin(async (tx) => [
      await tx`update projects set image_url = ${url} where image_url = ${old} returning id`,
      await tx`
        update project_journal set content = replace(content, ${old}, ${url})
        where position(${old} in content) > 0
        returning id
      `,
    ]);
    moved += 1;
    console.log(`ok ${row.id} -> ${url} (${projects.length} wonders, ${journal.length} journal entries)`);
  } catch (error) {
    failed += 1;
    console.error(`FAILED ${row.id}: ${(error as Error).message}`);
  }
}

console.log(`done: ${moved} moved, ${failed} failed. the thumbnails rows are kept as a backup.`);
await sql.end();
