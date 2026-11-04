export interface CashTransaction {
  id: string;
  amount_cents: number;
  memo: string;
  date: string;
  pending: boolean;
  tags?: { label?: string }[];
}

export interface CashLedger {
  balanceCents: number;
  incomingCents: number;
  outgoingCents: number;
  pendingCents: number;
  reconciled: boolean;
  transactionCount: number;
  fetchedAt: string;
  spending: { label: string; cents: number }[];
  months: { month: string; incomingCents: number; outgoingCents: number }[];
}

export function spendingLabel(row: CashTransaction): string {
  const tags = (row.tags ?? []).map((tag) => (tag.label ?? "").toLowerCase());
  if (/^(Grant to|Topup of grant)/i.test(row.memo)) return "Grants & top-ups";
  if (/fulfil+ment/i.test(row.memo) || tags.some((tag) => /fulfil+ment/.test(tag))) return "Fulfillment";
  if (/^Transfer (to|from)/i.test(row.memo)) return "Transfers";
  if (tags.includes("contractors")) return "Contractors";
  return "Other expenses";
}

export function summarizeCash(
  balanceCents: number,
  rows: CashTransaction[],
  fetchedAt: string,
): CashLedger {
  const groups = new Map<string, number>();
  const months = new Map<string, { incomingCents: number; outgoingCents: number }>();
  let incomingCents = 0;
  let outgoingCents = 0;
  let pendingCents = 0;
  for (const row of rows) {
    if (row.pending) pendingCents += row.amount_cents;
    const month = row.date.slice(0, 7);
    const bucket = months.get(month) ?? { incomingCents: 0, outgoingCents: 0 };
    if (row.amount_cents >= 0) {
      incomingCents += row.amount_cents;
      bucket.incomingCents += row.amount_cents;
    } else {
      outgoingCents -= row.amount_cents;
      bucket.outgoingCents -= row.amount_cents;
      const label = spendingLabel(row);
      groups.set(label, (groups.get(label) ?? 0) - row.amount_cents);
    }
    months.set(month, bucket);
  }
  return {
    balanceCents,
    incomingCents,
    outgoingCents,
    pendingCents,
    reconciled: incomingCents - outgoingCents === balanceCents,
    transactionCount: rows.length,
    fetchedAt,
    spending: [...groups].map(([label, cents]) => ({ label, cents })).sort((a, b) => b.cents - a.cents),
    months: [...months]
      .map(([month, value]) => ({ month, ...value }))
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, 12),
  };
}

export function reservedCents(owedPeople: number, perPersonCents: number): number {
  return Math.max(0, owedPeople) * Math.max(0, perPersonCents);
}

export function money(cents: number): string {
  const sign = cents < 0 ? "−" : "";
  return `${sign}$${(Math.abs(cents) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function parseDollarsToCents(input: string): number | null {
  const text = input.trim().replace(/^\$/, "");
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(text)) return null;
  return Math.round(parseFloat(text) * 100);
}
