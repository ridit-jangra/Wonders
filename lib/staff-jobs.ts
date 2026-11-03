import "server-only";
import { sql } from "@/lib/db";
import { PRECHECK_HIDE_MINUTES } from "@/lib/precheck/store";
import { postChannelMessage } from "@/lib/slack";
import {
  formatDigest,
  formatStaleMessage,
  type StaleWonder,
  type WeeklyDigest,
} from "@/lib/staff-messages";

const DEFAULT_CHANNEL = "C0C6E5XN45C";
const STALE_PING = ["U0ARC79GEAV"];
const DIGEST_PING = ["U0ARC79GEAV", "U07UK4S94KC"];
const TICK_MS = 15 * 60 * 1000;
const DIGEST_HOUR_UTC = 4;

function channel(): string {
  return process.env.STAFF_ALERT_CHANNEL_ID?.trim() || DEFAULT_CHANNEL;
}

function baseUrl(): string {
  return (process.env.APP_URL?.trim() || "https://wonders.hackclub.com").replace(/\/$/, "");
}

function staleHours(): number {
  const parsed = parseInt(process.env.QUEUE_STALE_HOURS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 72;
}

const queuedAt = () => sql`
  coalesce(
    (select min(h.created_at) from project_history h
      where h.project_id = p.id and h.to_status = 'in_review'
        and h.created_at > coalesce(
          (select max(a.created_at) from project_history a
            where a.project_id = p.id and a.to_status in ('shipped', 'fulfillment_started')),
          '-infinity'::timestamptz
        )),
    p.created_at
  )
`;

interface QueueRow {
  id: number;
  title: string;
  status: "in_review" | "second_pass";
  on_hold: boolean;
  waiting_hours: number;
}

async function loadQueue(): Promise<QueueRow[]> {
  return sql<QueueRow[]>`
    select p.id, p.title, p.status, p.on_hold,
      extract(epoch from (now() - ${queuedAt()})) / 3600.0 as waiting_hours
    from projects p
    where p.status in ('in_review', 'second_pass')
      and p.banned_at is null
      and not (
        p.ai_review_status = 'pending'
        and p.ai_review_started_at > now() - make_interval(mins => ${PRECHECK_HIDE_MINUTES})
      )
  `;
}

async function claim(key: string): Promise<boolean> {
  const rows = await sql`
    insert into staff_notices (key) values (${key})
    on conflict (key) do nothing
    returning key
  `;
  return rows.length > 0;
}

async function unclaim(keys: string[]) {
  if (keys.length === 0) return;
  await sql`delete from staff_notices where key = any(${keys})`;
}

function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export async function pingStaleWonders(now = new Date()): Promise<number> {
  const threshold = staleHours();
  const queue = await loadQueue();
  const stale = queue
    .filter((row) => !row.on_hold && Number(row.waiting_hours) >= threshold)
    .sort((a, b) => Number(b.waiting_hours) - Number(a.waiting_hours));

  const claimed: { key: string; item: StaleWonder }[] = [];
  for (const row of stale) {
    const key = `stale:${row.id}:${dayKey(now)}`;
    if (await claim(key)) {
      claimed.push({
        key,
        item: {
          id: row.id,
          title: row.title,
          status: row.status,
          waitingHours: Number(row.waiting_hours),
        },
      });
    }
  }
  if (claimed.length === 0) return 0;

  const sent = await postChannelMessage(
    channel(),
    formatStaleMessage(
      claimed.map((c) => c.item),
      baseUrl(),
      STALE_PING,
    ),
  );
  if (!sent) {
    await unclaim(claimed.map((c) => c.key));
    return 0;
  }
  return claimed.length;
}

async function buildDigest(): Promise<WeeklyDigest> {
  const queue = await loadQueue();
  const active = queue.filter((row) => !row.on_hold);
  const oldest = [...active].sort((a, b) => Number(b.waiting_hours) - Number(a.waiting_hours))[0];

  const [week] = await sql<
    {
      submitted: number;
      passed_first: number;
      approved: number;
      sent_back: number;
      fulfilled: number;
    }[]
  >`
    select
      count(*) filter (where to_status = 'in_review')::int as submitted,
      count(*) filter (where to_status = 'second_pass')::int as passed_first,
      count(*) filter (where to_status = 'shipped')::int as approved,
      count(*) filter (where to_status = 'rejected')::int as sent_back,
      count(*) filter (where to_status = 'fulfilled')::int as fulfilled
    from project_history
    where created_at > now() - interval '7 days'
  `;
  const [fulfillment] = await sql<{ waiting: number; started: number }[]>`
    select
      count(*) filter (where status = 'shipped')::int as waiting,
      count(*) filter (where status = 'fulfillment_started')::int as started
    from projects where banned_at is null
  `;

  return {
    firstPass: queue.filter((row) => row.status === "in_review").length,
    secondPass: queue.filter((row) => row.status === "second_pass").length,
    onHold: queue.filter((row) => row.on_hold).length,
    oldestHours: oldest ? Number(oldest.waiting_hours) : null,
    oldestTitle: oldest?.title ?? null,
    submitted: week.submitted,
    passedFirst: week.passed_first,
    approved: week.approved,
    sentBack: week.sent_back,
    fulfilled: week.fulfilled,
    awaitingFulfillment: fulfillment.waiting,
    inFulfillment: fulfillment.started,
  };
}

export async function sendWeeklyDigest(now = new Date()): Promise<boolean> {
  if (now.getUTCDay() !== 1 || now.getUTCHours() < DIGEST_HOUR_UTC) return false;
  const key = `digest:${dayKey(now)}`;
  if (!(await claim(key))) return false;

  const sent = await postChannelMessage(
    channel(),
    formatDigest(await buildDigest(), baseUrl(), DIGEST_PING),
  );
  if (!sent) {
    await unclaim([key]);
    return false;
  }
  return true;
}

async function tick() {
  try {
    await pingStaleWonders();
    await sendWeeklyDigest();
  } catch (err) {
    console.error("Staff jobs failed:", err);
  }
}

const globalForJobs = globalThis as unknown as { wondersStaffJobs?: boolean };

export function startStaffJobs() {
  if (globalForJobs.wondersStaffJobs) return;
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.STAFF_JOBS === "off") return;
  if (!process.env.DATABASE_URL || !process.env.SLACK_BOT_TOKEN) return;
  globalForJobs.wondersStaffJobs = true;

  setTimeout(tick, 60_000).unref?.();
  setInterval(tick, TICK_MS).unref?.();
}
