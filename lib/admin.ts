import "server-only";
import crypto from "node:crypto";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { sql } from "@/lib/db";
import { REAUTH_TTL_MS, createReauthValue, verifyReauthValue } from "@/lib/security/reauth";
import { safeAdminReturnTo } from "@/lib/security/return-to";
import { isStaff, parseRoles, type StaffAccess, type StaffRole } from "@/lib/security/roles";
import {
  DEFAULT_STAFF_SETTINGS,
  parseStaffSettings,
  type StaffSettings,
} from "@/lib/staff-settings";

export const ADMIN_SESSION_COOKIE = "wonders_admin_session";
export const ADMIN_STATE_COOKIE = "wonders_admin_auth_state";
export const ADMIN_HC_AUTH_SCOPE = "openid profile slack_id";
export const ADMIN_REAUTH_COOKIE = "wonders_admin_reauth";
export const ADMIN_REAUTH_RETURN_COOKIE = "wonders_admin_reauth_to";
export const ADMIN_REAUTH_FLOW_COOKIE = "wonders_admin_reauth_flow";
export const ADMIN_REAUTH_MAX_AGE = REAUTH_TTL_MS / 1000;

const ADMIN_SESSION_MAX_AGE = 60 * 60 * 12;

export interface AdminSession {
  slackId: string;
  name: string;
  email: string;
  exp: number;
}

export type AdminUser = AdminSession & StaffAccess;

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
    return payload;
  } catch {
    return null;
  }
}

const loadRoles = cache(async (slackId: string): Promise<StaffRole[]> => {
  const [row] = await sql<{ roles: string[] }[]>`
    select roles from staff_roles where slack_id = ${slackId}
  `;
  return parseRoles(row?.roles);
});

export async function getStaffAccess(slackId: string): Promise<StaffAccess> {
  return { isOwner: isAdminSlackId(slackId), roles: await loadRoles(slackId) };
}

export async function getAdminSession(): Promise<AdminUser | null> {
  const cookieStore = await cookies();
  const session = verifyAdminSessionCookie(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return null;
  }
  const access = await getStaffAccess(session.slackId);
  if (!isStaff(access)) {
    return null;
  }
  return { ...session, ...access };
}

export async function requireAdmin(): Promise<AdminUser> {
  const session = await getAdminSession();
  if (!session) {
    redirect("/api/admin-auth/login");
  }
  return session;
}

export async function requireAccess(allowed: (access: StaffAccess) => boolean): Promise<AdminUser> {
  const admin = await requireAdmin();
  if (!allowed(admin)) {
    notFound();
  }
  return admin;
}

function reauthSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET env var is not set");
  }
  return secret;
}

export function createAdminReauthCookie(slackId: string) {
  return createReauthValue(reauthSecret(), slackId).value;
}

export async function hasRecentAuth(slackId: string): Promise<boolean> {
  if (process.env.NODE_ENV === "development") {
    return true;
  }
  const cookieStore = await cookies();
  return verifyReauthValue(reauthSecret(), cookieStore.get(ADMIN_REAUTH_COOKIE)?.value, slackId);
}

export function reauthUrl(returnTo: string) {
  return `/api/admin-auth/login?reauth=1&return_to=${encodeURIComponent(safeAdminReturnTo(returnTo))}`;
}

export interface StaffMember {
  slack_id: string;
  roles: StaffRole[];
  updated_by: string | null;
  updated_at: string;
}

export async function listStaff(): Promise<StaffMember[]> {
  const rows = await sql<
    { slack_id: string; roles: string[]; updated_by: string | null; updated_at: string }[]
  >`
    select slack_id, roles, updated_by, updated_at from staff_roles
    order by updated_at desc
  `;
  return rows.map((row) => ({ ...row, roles: parseRoles(row.roles) }));
}

export async function setStaffRoles(slackId: string, roles: StaffRole[], updatedBy: string) {
  if (roles.length === 0) {
    await sql`delete from staff_roles where slack_id = ${slackId}`;
    return;
  }
  await sql`
    insert into staff_roles (slack_id, roles, updated_by, updated_at)
    values (${slackId}, ${roles}, ${updatedBy}, now())
    on conflict (slack_id) do update set
      roles = excluded.roles,
      updated_by = excluded.updated_by,
      updated_at = now()
  `;
}

export async function getStaffSettings(slackId: string): Promise<StaffSettings> {
  try {
    const [row] = await sql<{ settings: unknown }[]>`
      select settings from staff_settings where slack_id = ${slackId}
    `;
    return parseStaffSettings(row?.settings);
  } catch (error) {
    console.error("getStaffSettings", (error as Error).message);
    return DEFAULT_STAFF_SETTINGS;
  }
}

export async function saveStaffSettings(slackId: string, settings: StaffSettings): Promise<boolean> {
  try {
    await sql`
      insert into staff_settings (slack_id, settings, updated_at)
      values (${slackId}, ${sql.json({ ...settings })}, now())
      on conflict (slack_id) do update set
        settings = excluded.settings,
        updated_at = now()
    `;
    return true;
  } catch (error) {
    console.error("saveStaffSettings", (error as Error).message);
    return false;
  }
}
