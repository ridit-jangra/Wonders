import { describe, expect, test } from "bun:test";
import { formatDigest, formatStaleMessage, formatWait } from "./staff-messages";

describe("staff messages", () => {
  test("formats waits", () => {
    expect(formatWait(5.4)).toBe("5h");
    expect(formatWait(72)).toBe("3d");
  });

  test("stale message lists each wonder and pings", () => {
    const text = formatStaleMessage(
      [{ id: 4, title: "cool app", status: "in_review", waitingHours: 80 }],
      "https://x.test",
      ["U1"],
    );
    expect(text).toContain("<@U1>");
    expect(text).toContain("https://x.test/admin/wonders/4");
    expect(text).toContain("3d");
  });

  test("digest pings everyone", () => {
    const text = formatDigest(
      {
        firstPass: 2,
        secondPass: 1,
        onHold: 0,
        oldestHours: null,
        oldestTitle: null,
        submitted: 5,
        passedFirst: 3,
        approved: 2,
        sentBack: 1,
        fulfilled: 0,
        awaitingFulfillment: 4,
        inFulfillment: 1,
      },
      "https://x.test",
      ["U1", "U2"],
    );
    expect(text).toContain("<@U1> <@U2>");
    expect(text).toContain("nothing is waiting");
  });
});
