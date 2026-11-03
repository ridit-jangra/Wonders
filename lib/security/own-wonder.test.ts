import { describe, expect, test } from "bun:test";
import { blocksOwnReview, isOwnWonder } from "./own-wonder";

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

  test("admins and owners may review their own, reviewers may not", () => {
    const own = "U1";
    expect(blocksOwnReview({ slackId: own, isOwner: false, roles: ["reviewer"] }, own)).toBe(true);
    expect(blocksOwnReview({ slackId: own, isOwner: false, roles: ["admin"] }, own)).toBe(false);
    expect(blocksOwnReview({ slackId: own, isOwner: true, roles: [] }, own)).toBe(false);
    expect(blocksOwnReview({ slackId: own, isOwner: false, roles: ["reviewer"] }, "U2")).toBe(false);
  });
});
