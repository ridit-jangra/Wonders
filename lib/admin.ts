import "server-only";
import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export const ADMIN_SESSION_COOKIE = "wonders_admin_session";
export const ADMIN_STATE_COOKIE = "wonders_admin_auth_state";
export const ADMIN_HC_AUTH_SCOPE = "openid profile slack_id";

const ADMIN_SESSION_MAX_AGE = 60 * 60 * 12;

export interface AdminSession {
  slackId: string;
  name: string;
  email: string;
  exp: number;
}

function adminSlackIds(): string[] {
  return (process.env.ADMIN_SLACK_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isAdminSlackId(slackId: string): boolean {
  return adminSlackIds().includes(slackId);
}

function getAdminSigningKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET env var is not set");
  }
  return `${secret}:admin`;
}

function signAdmin(payload: string) {
  return crypto.createHmac("sha256", getAdminSigningKey()).update(payload).digest("base64url");
}

export function createAdminSessionCookie(data: { slackId: string; name: string; email: string }) {
  const payload: AdminSession = {
    slackId: data.slackId,
    name: data.name,
    email: data.email,
    exp: Date.now() + ADMIN_SESSION_MAX_AGE * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signAdmin(encoded);
  return { value: `${encoded}.${signature}`, maxAge: ADMIN_SESSION_MAX_AGE };
}

export function verifyAdminSessionCookie(value: string | undefined): AdminSession | null {
  if (!value) {
    return null;
  }

  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) {
    return null;
  }

  const expected = signAdmin(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as AdminSession;
    if (payload.exp < Date.now()) {
      return null;
    }
    if (!isAdminSlackId(payload.slackId)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  return verifyAdminSessionCookie(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
}

export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    redirect("/api/admin-auth/login");
  }
  return session;
}
