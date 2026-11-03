import { describe, expect, test } from "bun:test";
import { generateInviteCode, normalizeInviteCode } from "./collab-code";

describe("invite codes", () => {
  test("generated codes look like XXXX-XXXX and normalize to themselves", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCode();
      expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      expect(normalizeInviteCode(code)).toBe(code);
    }
  });

  test("normalizes casing and separators", () => {
    expect(normalizeInviteCode("abcd efgh")).toBe("ABCD-EFGH");
    expect(normalizeInviteCode("a2b3-c4d5")).toBe("A2B3-C4D5");
  });

  test("rejects wrong length and confusing characters", () => {
    expect(normalizeInviteCode("ABC-DEF")).toBeNull();
    expect(normalizeInviteCode("ABCD-EFG0")).toBeNull();
    expect(normalizeInviteCode("ABCD-EFGO")).toBeNull();
  });
});
