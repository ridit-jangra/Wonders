import { describe, expect, test } from "bun:test";
import { COUNTRIES, countryName, normalizePhone, splitPhone } from "./phone";

describe("phone", () => {
  test("normalizes to e164", () => {
    expect(normalizePhone("US", "(415) 555-2671")).toBe("+14155552671");
    expect(normalizePhone("IN", "098765 43210")).toBe("+919876543210");
  });
  test("rejects junk", () => {
    expect(normalizePhone("US", "12")).toBeNull();
    expect(normalizePhone("ZZ", "4155552671")).toBeNull();
    expect(normalizePhone("US", "1".repeat(20))).toBeNull();
    expect(normalizePhone("US", "abc")).toBeNull();
  });
  test("splits back", () => {
    expect(splitPhone("+14155552671")).toEqual({ iso: "US", number: "4155552671" });
    expect(splitPhone("+919876543210")).toEqual({ iso: "IN", number: "9876543210" });
    expect(splitPhone("+447911123456")).toEqual({ iso: "GB", number: "7911123456" });
    expect(splitPhone("4155552671")).toBeNull();
  });
  test("country list is unique and flagged", () => {
    const isos = COUNTRIES.map((c) => c.iso);
    expect(new Set(isos).size).toBe(isos.length);
    expect(COUNTRIES[0].flag).toBe("🇺🇸");
  });

  test("country names from codes", () => {
    expect(countryName("IN")).toBe("India");
    expect(countryName("us")).toBe("United States");
    expect(countryName("Germany")).toBe("Germany");
    expect(countryName("")).toBe("");
  });
});
