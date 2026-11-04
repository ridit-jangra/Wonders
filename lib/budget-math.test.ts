import { describe, expect, test } from "bun:test";
import { money, parseDollarsToCents, reservedCents, spendingLabel, summarizeCash } from "./budget-math";

const rows = [
  { id: "1", amount_cents: 20000, memo: "Transfer from YSWS - Coral", date: "2026-10-24", pending: false },
  { id: "2", amount_cents: -2500, memo: "Grant to a@b.co", date: "2026-11-02", pending: false },
  { id: "3", amount_cents: -1000, memo: "Hoodies", date: "2026-11-03", pending: true, tags: [{ label: "Fulfillment" }] },
];

describe("budget math", () => {
  test("summarizes the ledger", () => {
    const ledger = summarizeCash(16500, rows, "now");
    expect(ledger.incomingCents).toBe(20000);
    expect(ledger.outgoingCents).toBe(3500);
    expect(ledger.pendingCents).toBe(-1000);
    expect(ledger.reconciled).toBe(true);
    expect(ledger.spending[0]).toEqual({ label: "Grants & top-ups", cents: 2500 });
    expect(ledger.months[0].month).toBe("2026-11");
  });

  test("labels spending", () => {
    expect(spendingLabel(rows[1])).toBe("Grants & top-ups");
    expect(spendingLabel(rows[2])).toBe("Fulfillment");
    expect(spendingLabel({ ...rows[0], amount_cents: -5 })).toBe("Transfers");
  });

  test("reserves and formats", () => {
    expect(reservedCents(4, 2500)).toBe(10000);
    expect(reservedCents(-1, 2500)).toBe(0);
    expect(money(-1234)).toBe("−$12.34");
    expect(parseDollarsToCents("$25.5")).toBe(2550);
    expect(parseDollarsToCents("abc")).toBeNull();
  });
});
