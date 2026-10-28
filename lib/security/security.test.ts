import { describe, expect, test } from "bun:test";
import {
  canFulfill,
  canManagePlayers,
  canManageTeam,
  canReview,
  isStaff,
  parseRoles,
} from "./roles";
import { isMutatingMethod, isSameOriginRequest, parseAllowedOrigins } from "./origin";
import { clientIp } from "./client-ip";
import { retryAfterSeconds, windowStartMs } from "./rate-window";
import { REAUTH_TTL_MS, createReauthValue, verifyReauthValue } from "./reauth";
import { safeAdminReturnTo } from "./return-to";

const headers = (map: Record<string, string>) => ({
  get: (name: string) => map[name.toLowerCase()] ?? null,
});

describe("roles", () => {
  test("parseRoles keeps only known roles, in a stable order, without duplicates", () => {
    expect(parseRoles(["reviewer", "bogus", "admin", "reviewer", 4])).toEqual(["admin", "reviewer"]);
    expect(parseRoles("admin")).toEqual([]);
    expect(parseRoles(null)).toEqual([]);
  });

  test("owners can do everything", () => {
    const owner = { isOwner: true, roles: [] };
    expect(isStaff(owner)).toBe(true);
    expect(canReview(owner) && canFulfill(owner) && canManagePlayers(owner) && canManageTeam(owner)).toBe(true);
  });

  test("a reviewer reviews but can't fulfill, manage players or the team", () => {
    const reviewer = { isOwner: false, roles: ["reviewer" as const] };
    expect(canReview(reviewer)).toBe(true);
    expect(canFulfill(reviewer)).toBe(false);
    expect(canManagePlayers(reviewer)).toBe(false);
    expect(canManageTeam(reviewer)).toBe(false);
  });

  test("an admin role never grants team management", () => {
    const admin = { isOwner: false, roles: ["admin" as const] };
    expect(canReview(admin) && canFulfill(admin) && canManagePlayers(admin)).toBe(true);
    expect(canManageTeam(admin)).toBe(false);
  });

  test("nobody without a role is staff", () => {
    expect(isStaff({ isOwner: false, roles: [] })).toBe(false);
  });
});

describe("origin check", () => {
  const allowed = parseAllowedOrigins("https://wonders.hackclub.com/", []);

  test("trailing slashes in the allowlist are ignored", () => {
    expect(allowed.has("https://wonders.hackclub.com")).toBe(true);
  });

  test("same-origin request with a matching Origin passes", () => {
    expect(isSameOriginRequest({ origin: "https://wonders.hackclub.com", secFetchSite: "same-origin" }, allowed)).toBe(true);
  });

  test("a foreign Origin is rejected", () => {
    expect(isSameOriginRequest({ origin: "https://evil.example", secFetchSite: "same-origin" }, allowed)).toBe(false);
  });

  test("cross-site and same-site Sec-Fetch-Site are rejected", () => {
    expect(isSameOriginRequest({ origin: "https://wonders.hackclub.com", secFetchSite: "cross-site" }, allowed)).toBe(false);
    expect(isSameOriginRequest({ origin: null, secFetchSite: "same-site" }, allowed)).toBe(false);
  });

  test("no Origin and no Sec-Fetch-Site is rejected", () => {
    expect(isSameOriginRequest({ origin: null, secFetchSite: null }, allowed)).toBe(false);
  });

  test("only safe methods are exempt", () => {
    expect(isMutatingMethod("get")).toBe(false);
    expect(isMutatingMethod("POST")).toBe(true);
    expect(isMutatingMethod("delete")).toBe(true);
  });

  test("falls back when the env list is empty", () => {
    expect([...parseAllowedOrigins("", ["http://localhost:3000"])]).toEqual(["http://localhost:3000"]);
  });
});

describe("client ip", () => {
  test("uses the entry added by our own proxy, not the first one a client can spoof", () => {
    expect(clientIp(headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" }), 1)).toBe("203.0.113.9");
  });

  test("a spoofed leading entry can't change the result", () => {
    const a = clientIp(headers({ "x-forwarded-for": "1.1.1.1, 203.0.113.9" }), 1);
    const b = clientIp(headers({ "x-forwarded-for": "2.2.2.2, 203.0.113.9" }), 1);
    expect(a).toBe(b);
  });

  test("two trusted hops reads one further in", () => {
    expect(clientIp(headers({ "x-forwarded-for": "198.51.100.4, 203.0.113.9" }), 2)).toBe("198.51.100.4");
  });

  test("garbage is not trusted", () => {
    expect(clientIp(headers({ "x-forwarded-for": "<script>" }))).toBe("unknown");
    expect(clientIp(headers({}))).toBe("unknown");
  });

  test("falls back to x-real-ip", () => {
    expect(clientIp(headers({ "x-real-ip": "203.0.113.7" }))).toBe("203.0.113.7");
  });
});

describe("rate window", () => {
  test("rounds down to the window and reports the time left", () => {
    expect(windowStartMs(125_000, 60)).toBe(120_000);
    expect(retryAfterSeconds(125_000, 60)).toBe(55);
  });
});

describe("step-up cookie", () => {
  const secret = "test-secret";

  test("a fresh value verifies for the same admin", () => {
    const { value } = createReauthValue(secret, "U1", 1_000);
    expect(verifyReauthValue(secret, value, "U1", 2_000)).toBe(true);
  });

  test("it expires", () => {
    const { value } = createReauthValue(secret, "U1", 1_000);
    expect(verifyReauthValue(secret, value, "U1", 1_000 + REAUTH_TTL_MS + 1)).toBe(false);
  });

  test("it is bound to the admin it was issued for", () => {
    const { value } = createReauthValue(secret, "U1", 1_000);
    expect(verifyReauthValue(secret, value, "U2", 2_000)).toBe(false);
  });

  test("a tampered signature or different secret fails", () => {
    const { value } = createReauthValue(secret, "U1", 1_000);
    expect(verifyReauthValue(secret, `${value}x`, "U1", 2_000)).toBe(false);
    expect(verifyReauthValue("other-secret", value, "U1", 2_000)).toBe(false);
  });

  test("garbage and empty values fail", () => {
    expect(verifyReauthValue(secret, "", "U1")).toBe(false);
    expect(verifyReauthValue(secret, "a.b", "U1")).toBe(false);
    expect(verifyReauthValue(secret, undefined, "U1")).toBe(false);
  });
});

describe("admin return_to", () => {
  test("keeps admin paths", () => {
    expect(safeAdminReturnTo("/admin/users/abc?x=1")).toBe("/admin/users/abc?x=1");
    expect(safeAdminReturnTo("/admin")).toBe("/admin");
  });

  test("rejects everything that could leave the admin area", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/admin//evil.example", "/administrator", "/dashboard", "/admin\\evil", "javascript:alert(1)", "", null, undefined]) {
      expect(safeAdminReturnTo(bad as string | null | undefined)).toBe("/admin");
    }
  });
});
