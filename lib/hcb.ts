import "server-only";

const HCB_BASE = "https://hcb.hackclub.com";

let cachedToken: { token: string; expiresAt: number } | null = null;

export function hcbOrgId(): string | null {
  return process.env.HCB_ORG_ID?.trim() || null;
}

export function hcbMaxGrantCents(): number {
  const parsed = parseInt(process.env.HCB_GRANT_MAX_CENTS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 50000;
}

export function isHcbConfigured(): boolean {
  if (!hcbOrgId()) return false;
  return Boolean(
    process.env.HCB_ACCESS_TOKEN || (process.env.HCB_CLIENT_ID && process.env.HCB_CLIENT_SECRET),
  );
}

async function accessToken(): Promise<string | null> {
  if (process.env.HCB_ACCESS_TOKEN) return process.env.HCB_ACCESS_TOKEN;
  const clientId = process.env.HCB_CLIENT_ID;
  const clientSecret = process.env.HCB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;

  const res = await fetch(`${HCB_BASE}/api/v4/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: process.env.HCB_SCOPE || "read write",
    }),
  });
  if (!res.ok) {
    console.error("HCB token request failed:", res.status);
    return null;
  }
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
  };
  return cachedToken.token;
}

export async function createCardGrant(input: {
  email: string;
  amountCents: number;
  purpose: string;
  inviteMessage: string | null;
  keywordLock: string | null;
  oneTimeUse: boolean;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const org = hcbOrgId();
  const token = await accessToken();
  if (!org || !token) return { ok: false, error: "not_configured" };

  try {
    const res = await fetch(
      `${HCB_BASE}/api/v4/organizations/${encodeURIComponent(org)}/card_grants`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: input.email,
          amount_cents: input.amountCents,
          purpose: input.purpose,
          one_time_use: input.oneTimeUse,
          ...(input.inviteMessage ? { invite_message: input.inviteMessage } : {}),
          ...(input.keywordLock ? { keyword_lock: input.keywordLock } : {}),
        }),
      },
    );
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string; error?: string };
    if (!res.ok || !data.id) {
      console.error("HCB card grant failed:", res.status, data.error ?? data.message);
      return { ok: false, error: data.error ?? `status_${res.status}` };
    }
    return { ok: true, id: data.id };
  } catch (err) {
    console.error("HCB card grant failed:", err);
    return { ok: false, error: "network" };
  }
}
