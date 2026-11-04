import "server-only";
import { sql } from "@/lib/db";
import { YSWS } from "@/lib/ysws-config";
import { summarizeCash, type CashLedger, type CashTransaction } from "@/lib/budget-math";

const HCB_ORG = YSWS.hcbOrg;
const API = `https://hcb.hackclub.com/api/v3/organizations/${HCB_ORG}`;
export const HCB_TRANSACTIONS_URL = `${YSWS.hcbUrl}/transactions`;

async function loadCash(): Promise<CashLedger> {
  const signal = AbortSignal.timeout(12_000);
  const read = async (url: string): Promise<unknown> => {
    const response = await fetch(url, { cache: "no-store", signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("HCB is unavailable");
    return response.json();
  };
  const org = (await read(API)) as { slug?: string; balances?: { balance_cents?: number } };
  const balance = org.balances?.balance_cents;
  if (org.slug !== HCB_ORG || !Number.isSafeInteger(balance)) {
    throw new Error("HCB balance is unavailable");
  }
  const rows: CashTransaction[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= 20; page++) {
    const batch = await read(`${API}/transactions?per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error("Invalid HCB ledger");
    for (const row of batch) {
      if (
        typeof row.id !== "string" ||
        seen.has(row.id) ||
        !Number.isSafeInteger(row.amount_cents) ||
        typeof row.memo !== "string" ||
        typeof row.date !== "string" ||
        typeof row.pending !== "boolean"
      ) {
        throw new Error("Incomplete HCB ledger");
      }
      seen.add(row.id);
      rows.push(row);
    }
    if (batch.length < 100) return summarizeCash(balance as number, rows, new Date().toISOString());
  }
  throw new Error("HCB ledger exceeds the page limit");
}

let cached: { at: number; value: CashLedger } | null = null;

export async function getBudgetCash(): Promise<CashLedger | null> {
  if (cached && Date.now() - cached.at < 60_000) return cached.value;
  try {
    const value = await loadCash();
    cached = { at: Date.now(), value };
    return value;
  } catch {
    return null;
  }
}

export interface BudgetPosition {
  waiting: number;
  inProgress: number;
  fulfilled: number;
  inReview: number;
  grants: number;
  grantedCents: number;
  shippedSeconds: number;
  perPersonCents: number;
  readAt: string;
}

export async function getBudgetPosition(): Promise<BudgetPosition> {
  const [row] = await sql<
    {
      waiting: number;
      in_progress: number;
      fulfilled: number;
      in_review: number;
      grants: number;
      granted_cents: string;
      shipped_seconds: string;
      read_at: string;
    }[]
  >`
    with units as (
      select p.status, p.fulfilled_at, p.hcb_grant_cents, p.hcb_grant_sent_at,
        coalesce(p.owner_seconds, p.hackatime_seconds, 0) as seconds
      from projects p where p.banned_at is null
      union all
      select p.status, c.fulfilled_at, c.hcb_grant_cents, c.hcb_grant_sent_at,
        coalesce(c.hackatime_seconds, 0) as seconds
      from project_collaborators c join projects p on p.id = c.project_id
      where p.banned_at is null
    )
    select now() as read_at,
      count(*) filter (where status = 'shipped' and fulfilled_at is null and hcb_grant_sent_at is null)::int as waiting,
      count(*) filter (where status = 'fulfillment_started' and fulfilled_at is null and hcb_grant_sent_at is null)::int as in_progress,
      count(*) filter (where fulfilled_at is not null)::int as fulfilled,
      count(*) filter (where status in ('in_review', 'second_pass'))::int as in_review,
      count(*) filter (where hcb_grant_sent_at is not null)::int as grants,
      coalesce(sum(hcb_grant_cents) filter (where hcb_grant_sent_at is not null), 0)::text as granted_cents,
      coalesce(sum(seconds) filter (where status in ('shipped', 'fulfillment_started', 'fulfilled')), 0)::text as shipped_seconds
    from units
  `;
  const [settings] = await sql<{ per_person_cents: number }[]>`
    select per_person_cents from budget_settings where id = true
  `;
  return {
    waiting: row.waiting,
    inProgress: row.in_progress,
    fulfilled: row.fulfilled,
    inReview: row.in_review,
    grants: row.grants,
    grantedCents: Number(row.granted_cents),
    shippedSeconds: Number(row.shipped_seconds),
    perPersonCents: settings?.per_person_cents ?? 0,
    readAt: new Date(row.read_at).toISOString(),
  };
}

export async function saveBudgetEstimate(perPersonCents: number, updatedBy: string) {
  await sql`
    insert into budget_settings (id, per_person_cents, updated_by, updated_at)
    values (true, ${perPersonCents}, ${updatedBy}, now())
    on conflict (id) do update set
      per_person_cents = excluded.per_person_cents,
      updated_by = excluded.updated_by,
      updated_at = now()
  `;
}
