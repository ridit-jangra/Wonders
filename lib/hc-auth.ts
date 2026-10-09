import crypto from "node:crypto";

export const HC_AUTH_SITE = "https://auth.hackclub.com";
export const HC_AUTH_AUTHORIZE_URL = `${HC_AUTH_SITE}/oauth/authorize`;
export const HC_AUTH_TOKEN_URL = `${HC_AUTH_SITE}/oauth/token`;
export const HC_AUTH_ME_URL = `${HC_AUTH_SITE}/api/v1/me`;
export const HC_AUTH_SCOPE =
  "openid profile slack_id phone birthdate address basic_info";

export const SESSION_COOKIE = "wonders_session";
export const STATE_COOKIE = "wonders_hc_auth_state";

const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

interface SessionPayload {
  email: string;
  name: string;
  slackId: string;
  exp: number;
}

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET env var is not set");
  }
  return secret;
}

function sign(payload: string) {
  return crypto
    .createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url");
}

export function createSessionCookie(data: {
  email: string;
  name: string;
  slackId: string;
}) {
  const payload: SessionPayload = {
    email: data.email,
    name: data.name,
    slackId: data.slackId,
    exp: Date.now() + SESSION_MAX_AGE * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encoded);
  return { value: `${encoded}.${signature}`, maxAge: SESSION_MAX_AGE };
}

export function verifySessionCookie(
  value: string | undefined,
): SessionPayload | null {
  if (!value) return null;
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString(),
    ) as SessionPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export interface HcaAddress {
  line_1?: string;
  line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  phone_number?: string;
  primary?: boolean;
}

export interface HcaIdentity {
  id: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  primary_email?: string;
  slack_id?: string;
  phone_number?: string;
  birthday?: string;
  addresses?: HcaAddress[];
  verification_status?: string;
  ysws_eligible?: boolean;
}

export interface HcaMailingAddress {
  line1: string;
  line2: string;
  city: string;
  state: string;
  country: string;
  postal: string;
}

export function hcaFullName(identity: HcaIdentity): string {
  const joined = [identity.first_name, identity.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return joined || identity.name?.trim() || "";
}

export function extractBirthday(identity: HcaIdentity): string | null {
  const raw = identity.birthday;
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime()) || date > new Date() || date.getFullYear() < 1900) {
    console.warn("HCA birthday didn't parse as a date");
    return null;
  }
  return raw.slice(0, 10);
}

function primaryAddress(identity: HcaIdentity): HcaAddress | null {
  const addresses = identity.addresses;
  if (!Array.isArray(addresses) || addresses.length === 0) return null;
  return addresses.find((a) => a.primary) ?? addresses[0];
}

export function extractAddress(identity: HcaIdentity): HcaMailingAddress | null {
  const addr = primaryAddress(identity);
  if (!addr) return null;
  const line1 = String(addr.line_1 ?? "").trim();
  const city = String(addr.city ?? "").trim();
  const country = String(addr.country ?? "").trim();
  const postal = String(addr.postal_code ?? "").trim();
  if (!line1 || !city || !country || !postal) {
    console.warn("HCA address missing expected fields, keys:", Object.keys(addr));
    return null;
  }
  return {
    line1,
    line2: String(addr.line_2 ?? "").trim(),
    city,
    state: String(addr.state ?? "").trim(),
    country,
    postal,
  };
}

export function extractPhone(identity: HcaIdentity): string | null {
  const phone = identity.phone_number ?? primaryAddress(identity)?.phone_number;
  return phone?.trim() || null;
}
