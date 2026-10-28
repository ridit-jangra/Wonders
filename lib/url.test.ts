import { describe, expect, test } from "bun:test";
import { normalizeUrl } from "./url";

describe("normalizeUrl", () => {
  test("adds https when the scheme is missing", () => {
    expect(normalizeUrl("github.com/a/b")).toBe("https://github.com/a/b");
    expect(normalizeUrl("  ysws-handbook.ridit.space ")).toBe("https://ysws-handbook.ridit.space");
  });

  test("keeps links that already have http or https", () => {
    expect(normalizeUrl("http://x.dev/a")).toBe("http://x.dev/a");
    expect(normalizeUrl("https://x.dev")).toBe("https://x.dev");
  });

  test("empty, odd schemes and non-links become null", () => {
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl(null)).toBeNull();
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("data://text/html,hi")).toBeNull();
    expect(normalizeUrl("ftp://x.dev/file")).toBeNull();
    expect(normalizeUrl("not a link")).toBeNull();
    expect(normalizeUrl("localhost")).toBeNull();
  });
});
