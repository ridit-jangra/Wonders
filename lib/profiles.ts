import "server-only";
import { sql } from "@/lib/db";
import { decryptPII, encryptPII } from "@/lib/crypto";
import {
  extractAddress,
  extractBirthday,
  extractPhone,
  hcaFullName,
  type HcaIdentity,
} from "@/lib/hc-auth";

export interface Profile {
  id: string;
  slack_id: string;
  email: string;
  name: string;
  interest: string | null;
}

export interface ProfileIdentity {
  hca_id: string | null;
  first_name: string | null;
  last_name: string | null;
  slack_display_name: string | null;
  slack_avatar_url: string | null;
  birthday: string;
  phone: string;
  address: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    country: string;
    postal: string;
  };
  hca_verification_status: string | null;
  hca_ysws_eligible: boolean | null;
}

export interface ProfileWithStats extends Profile {
  created_at: string;
  wonder_count: number;
}

export async function getProfile(slackId: string): Promise<Profile | null> {
  const [profile] = await sql<Profile[]>`
    select id, slack_id, email, name, interest
    from profiles where slack_id = ${slackId}
  `;
  return profile ?? null;
}

export async function saveInterest(session: {
  slackId: string;
  email: string;
  name: string;
}, interest: string) {
  await sql`
    insert into profiles (slack_id, email, name, interest)
    values (${session.slackId}, ${session.email}, ${session.name}, ${interest})
    on conflict (slack_id) do update set
      email = excluded.email,
      name = excluded.name,
      interest = excluded.interest,
      updated_at = now()
  `;
}

export async function syncHcaIdentity(
  identity: HcaIdentity,
  slack: { displayName: string | null; avatarUrl: string | null },
) {
  if (!identity.slack_id || !identity.primary_email) return;

  const row: Record<string, string | boolean | null> = {
    slack_id: identity.slack_id,
    email: identity.primary_email,
    name: hcaFullName(identity),
    hca_id: identity.id,
  };
  if (identity.first_name) row.first_name = identity.first_name;
  if (identity.last_name) row.last_name = identity.last_name;
  if (slack.displayName) row.slack_display_name = slack.displayName;
  if (slack.avatarUrl) row.slack_avatar_url = slack.avatarUrl;
  if (identity.verification_status) {
    row.hca_verification_status = identity.verification_status;
    row.hca_ysws_eligible =
      typeof identity.ysws_eligible === "boolean" ? identity.ysws_eligible : null;
  }

  const birthday = extractBirthday(identity);
  if (birthday) row.birthday = encryptPII(birthday);
  const phone = extractPhone(identity);
  if (phone) row.phone = encryptPII(phone);
  const address = extractAddress(identity);
  if (address) {
    row.address_line1 = encryptPII(address.line1);
    row.address_line2 = encryptPII(address.line2);
    row.address_city = encryptPII(address.city);
    row.address_state = encryptPII(address.state);
    row.address_country = encryptPII(address.country);
    row.address_postal = encryptPII(address.postal);
  }

  const columns = Object.keys(row);
  await sql`
    insert into profiles ${sql(row, columns)}
    on conflict (slack_id) do update set
      ${sql(row, columns.filter((c) => c !== "slack_id"))},
      updated_at = now()
  `;
}


export async function listAllProfiles(opts: {
  search?: string;
  limit: number;
  offset: number;
}): Promise<{ profiles: ProfileWithStats[]; total: number }> {
  const pattern = opts.search ? `%${opts.search}%` : null;
  const where = pattern
    ? sql`where pr.name ilike ${pattern} or pr.email ilike ${pattern}`
    : sql``;

  const [profiles, [{ total }]] = await Promise.all([
    sql<ProfileWithStats[]>`
      select
        pr.id, pr.slack_id, pr.email, pr.name, pr.interest, pr.created_at,
        (select count(*)::int from projects p where p.profile_id = pr.id) as wonder_count
      from profiles pr
      ${where}
      order by pr.created_at desc
      limit ${opts.limit} offset ${opts.offset}
    `,
    sql<{ total: number }[]>`
      select count(*)::int as total from profiles pr ${where}
    `,
  ]);

  return { profiles, total };
}

export async function getProfileByIdAdmin(
  id: string,
): Promise<(Profile & { created_at: string }) | null> {
  const [profile] = await sql<(Profile & { created_at: string })[]>`
    select id, slack_id, email, name, interest, created_at
    from profiles where id = ${id}
  `;
  return profile ?? null;
}

export async function getProfileIdentityAdmin(
  id: string,
): Promise<ProfileIdentity | null> {
  const [data] = await sql`
    select
      hca_id, first_name, last_name, slack_display_name, slack_avatar_url,
      birthday, phone, address_line1, address_line2, address_city,
      address_state, address_country, address_postal,
      hca_verification_status, hca_ysws_eligible
    from profiles where id = ${id}
  `;
  if (!data) return null;

  return {
    hca_id: data.hca_id,
    first_name: data.first_name,
    last_name: data.last_name,
    slack_display_name: data.slack_display_name,
    slack_avatar_url: data.slack_avatar_url,
    birthday: decryptPII(data.birthday),
    phone: decryptPII(data.phone),
    address: {
      line1: decryptPII(data.address_line1),
      line2: decryptPII(data.address_line2),
      city: decryptPII(data.address_city),
      state: decryptPII(data.address_state),
      country: decryptPII(data.address_country),
      postal: decryptPII(data.address_postal),
    },
    hca_verification_status: data.hca_verification_status,
    hca_ysws_eligible: data.hca_ysws_eligible,
  };
}
