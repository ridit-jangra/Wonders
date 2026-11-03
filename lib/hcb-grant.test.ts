import { describe, expect, test } from "bun:test";
import { formatDollars, parseGrantInput } from "./hcb-grant";

const base = { amount: "25", purpose: "Wonders reward", message: "", keyword: "", oneTime: false };

describe("parseGrantInput", () => {
  test("parses dollars into cents", () => {
    expect(parseGrantInput(base, 50000)?.amountCents).toBe(2500);
    expect(parseGrantInput({ ...base, amount: "$12.5" }, 50000)?.amountCents).toBe(1250);
  });

  test("rejects bad or too large amounts", () => {
    expect(parseGrantInput({ ...base, amount: "0" }, 50000)).toBeNull();
    expect(parseGrantInput({ ...base, amount: "-5" }, 50000)).toBeNull();
    expect(parseGrantInput({ ...base, amount: "abc" }, 50000)).toBeNull();
    expect(parseGrantInput({ ...base, amount: "501" }, 50000)).toBeNull();
  });

  test("needs a purpose", () => {
    expect(parseGrantInput({ ...base, purpose: "  " }, 50000)).toBeNull();
  });

  test("formats dollars", () => {
    expect(formatDollars(2500)).toBe("$25");
    expect(formatDollars(1250)).toBe("$12.50");
  });
});
