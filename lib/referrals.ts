import "server-only";
import crypto from "node:crypto";
import { sql } from "@/lib/db";
import { getStaffAccess } from "@/lib/admin";
import { canManagePlayers } from "@/lib/security/roles";
import { YSWS } from "@/lib/ysws-config";

export const REFERRAL_COOKIE = "wonders_ref";
export const REFERRAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
export const REFERRALS_FOR_PIN = 5;

const SLUG_PATTERN = /^[a-f0-9]{5,10}$/;

export function isReferralSlug(value: string | undefined | null): value is string {
  return Boolean(value && SLUG_PATTERN.test(value));
}

export function visitorHash(ip: string, userAgent: string) {
  const secret = process.env.SESSION_SECRET ?? "";
  return crypto
    .createHash("sha256")
    .update(`${secret}:${ip}:${userAgent}`)
    .digest("hex")
    .slice(0, 32);
}

export async function canUseReferrals(slackId: string) {
  if (YSWS.access.referralsOpen) return true;
  return canManagePlayers(await getStaffAccess(slackId));
}

export async function findReferrerBySlug(slug: string) {
  if (!isReferralSlug(slug)) return null;
  const [row] = await sql<{ id: string; slack_id: string; name: string }[]>`
    select id, slack_id, coalesce(nullif(slack_display_name, ''), nullif(first_name, ''), 'a friend') as name
    from profiles where referral_slug = ${slug}
  `;
  if (!row || !(await canUseReferrals(row.slack_id))) return null;
  return row;
}

export async function recordClick(referrerId: string, hash: string) {
  await sql`
    insert into referral_clicks (referrer_id, visitor_hash)
    select ${referrerId}, ${hash}
    where not exists (
      select 1 from referral_clicks
      where referrer_id = ${referrerId}
        and visitor_hash = ${hash}
        and created_at > now() - interval '24 hours'
    )
  `;
}

export async function profileExists(slackId: string) {
  const [row] = await sql`select 1 as found from profiles where slack_id = ${slackId}`;
  return Boolean(row);
}

export async function attachReferral(referrerId: string, referredSlackId: string) {
  await sql`
    insert into referrals (referrer_id, referred_id)
    select ${referrerId}, p.id
    from profiles p
    where p.slack_id = ${referredSlackId} and p.id <> ${referrerId}
    on conflict (referred_id) do nothing
  `;
}

export interface ReferralStats {
  slug: string;
  clicks: number;
  visitors: number;
  referred: {
    id: string;
    name: string;
    avatar: string | null;
    joinedAt: string;
    counted: boolean;
    verified: boolean;
  }[];
  recentClicks: string[];
  qualified: number;
  pinSentAt: string | null;
}

export async function getReferralStats(profileId: string): Promise<ReferralStats> {
  const [profile] = await sql<{ referral_slug: string; referral_pin_sent_at: string | null }[]>`
    select referral_slug, referral_pin_sent_at from profiles where id = ${profileId}
  `;
  const [counts] = await sql<{ clicks: number; visitors: number }[]>`
    select count(*)::int as clicks, count(distinct visitor_hash)::int as visitors
    from referral_clicks where referrer_id = ${profileId}
  `;
  const referred = await sql<
    { id: string; name: string; avatar: string | null; joined_at: string; counted: boolean; verified: boolean }[]
  >`
    select
      r.id,
      coalesce(nullif(p.slack_display_name, ''), nullif(p.first_name, ''), 'new player') as name,
      p.slack_avatar_url as avatar,
      r.created_at as joined_at,
      (p.interest is not null and p.hca_verification_status = 'verified' and p.hca_ysws_eligible is not false) as counted,
      (p.hca_verification_status = 'verified') as verified
    from referrals r
    join profiles p on p.id = r.referred_id
    where r.referrer_id = ${profileId}
    order by r.created_at desc
  `;
  const recent = await sql<{ created_at: string }[]>`
    select created_at from referral_clicks
    where referrer_id = ${profileId}
    order by created_at desc limit 8
  `;
  return {
    slug: profile.referral_slug,
    clicks: counts.clicks,
    visitors: counts.visitors,
    referred: referred.map((r) => ({
      id: r.id,
      name: r.name,
      avatar: r.avatar,
      joinedAt: r.joined_at,
      counted: r.counted,
      verified: r.verified,
    })),
    recentClicks: recent.map((r) => r.created_at),
    qualified: referred.filter((r) => r.counted).length,
    pinSentAt: profile.referral_pin_sent_at,
  };
}

export async function getReferredBy(profileId: string) {
  const [row] = await sql<{ name: string; sticker_sent_at: string | null }[]>`
    select
      coalesce(nullif(p.slack_display_name, ''), nullif(p.first_name, ''), 'a friend') as name,
      r.sticker_sent_at
    from referrals r
    join profiles p on p.id = r.referrer_id
    where r.referred_id = ${profileId}
  `;
  return row ?? null;
}

export interface PinDue {
  profile_id: string;
  name: string;
  email: string;
  slack_id: string;
  qualified: number;
}

export interface StickerDue {
  referral_id: string;
  profile_id: string;
  name: string;
  slack_id: string;
  referrer_name: string;
  created_at: string;
}

export async function listPinsDue(): Promise<PinDue[]> {
  return sql<PinDue[]>`
    select p.id as profile_id, p.name, p.email, p.slack_id, count(*)::int as qualified
    from profiles p
    join referrals r on r.referrer_id = p.id
    join profiles rp on rp.id = r.referred_id
    where p.referral_pin_sent_at is null
      and rp.interest is not null
      and rp.hca_verification_status = 'verified' and rp.hca_ysws_eligible is not false
    group by p.id
    having count(*) >= ${REFERRALS_FOR_PIN}
    order by min(r.created_at)
  `;
}

export async function listStickersDue(): Promise<StickerDue[]> {
  return sql<StickerDue[]>`
    select r.id as referral_id, rp.id as profile_id, rp.name, rp.slack_id,
      p.name as referrer_name, r.created_at
    from referrals r
    join profiles rp on rp.id = r.referred_id
    join profiles p on p.id = r.referrer_id
    where r.sticker_sent_at is null
      and rp.interest is not null
      and rp.hca_verification_status = 'verified' and rp.hca_ysws_eligible is not false
    order by r.created_at
  `;
}

export async function markPinSent(profileId: string) {
  await sql`
    update profiles set referral_pin_sent_at = now()
    where id = ${profileId} and referral_pin_sent_at is null
  `;
}

export async function markStickerSent(referralId: string) {
  await sql`
    update referrals set sticker_sent_at = now()
    where id = ${referralId} and sticker_sent_at is null
  `;
}

export async function referralTotals() {
  const [row] = await sql<{ referrals: number; clicks: number }[]>`
    select
      (select count(*)::int from referrals) as referrals,
      (select count(*)::int from referral_clicks) as clicks
  `;
  return row;
}

const CHECK_URL = "https://auth.hackclub.com/api/external/check";

const CHECK_RESULTS: Record<string, { status: string; eligible: boolean | null }> = {
  verified_eligible: { status: "verified", eligible: true },
  verified_but_over_18: { status: "verified", eligible: false },
  pending: { status: "pending", eligible: null },
  needs_submission: { status: "needs_submission", eligible: null },
  rejected: { status: "ineligible", eligible: false },
};

async function refreshVerification(profileId: string, slackId: string) {
  try {
    const res = await fetch(`${CHECK_URL}?slack_id=${encodeURIComponent(slackId)}`, {
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    if (!res.ok) return;
    const data = (await res.json()) as { result?: string };
    const mapped = data.result ? CHECK_RESULTS[data.result] : undefined;
    if (!mapped) return;
    await sql`
      update profiles
      set hca_verification_status = ${mapped.status}, hca_ysws_eligible = ${mapped.eligible}
      where id = ${profileId}
        and (hca_verification_status is distinct from ${mapped.status}
          or hca_ysws_eligible is distinct from ${mapped.eligible})
    `;
  } catch {
    return;
  }
}

export async function refreshPendingVerifications(referrerId?: string) {
  const rows = await sql<{ id: string; slack_id: string }[]>`
    select p.id, p.slack_id
    from referrals r
    join profiles p on p.id = r.referred_id
    where p.hca_verification_status is distinct from 'verified'
      and p.hca_verification_status is distinct from 'ineligible'
      and (${referrerId ?? null}::uuid is null or r.referrer_id = ${referrerId ?? null})
    order by r.created_at desc
    limit 25
  `;
  await Promise.all(rows.map((row) => refreshVerification(row.id, row.slack_id)));
}

export async function hasPinDue(profileId: string): Promise<boolean> {
  return (await listPinsDue()).some((pin) => pin.profile_id === profileId);
}
