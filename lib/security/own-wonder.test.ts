import { describe, expect, test } from "bun:test";
import { isOwnWonder } from "./own-wonder";

describe("own wonder", () => {
  test("matches the same slack id", () => {
    expect(isOwnWonder("U123", "U123")).toBe(true);
    expect(isOwnWonder(" u123 ", "U123")).toBe(true);
  });
  test("different or missing ids are not own", () => {
    expect(isOwnWonder("U123", "U456")).toBe(false);
    expect(isOwnWonder("U123", null)).toBe(false);
    expect(isOwnWonder("", "")).toBe(false);
  });
});
