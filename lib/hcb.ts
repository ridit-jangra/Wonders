import "server-only";
import { YSWS } from "@/lib/ysws-config";

const HCB_BASE = "https://hcb.hackclub.com";

export function hcbOrgId(): string | null {
  return process.env.HCB_ORG_ID?.trim() || YSWS.hcbOrg;
}

export function hcbMaxGrantCents(): number {
  const parsed = parseInt(process.env.HCB_GRANT_MAX_CENTS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : YSWS.rates.grantMaxCents;
}

export function isHcbConfigured(): boolean {
  return Boolean(hcbOrgId() && process.env.HCB_ACCESS_TOKEN);
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
  const token = process.env.HCB_ACCESS_TOKEN;
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
