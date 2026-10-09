import "server-only";
import { supabase } from "@/lib/supabase";
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
  const { data, error } = await supabase
    .from("profiles")
    .select("id, slack_id, email, name, interest")
    .eq("slack_id", slackId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

export async function saveInterest(session: {
  slackId: string;
  email: string;
  name: string;
}, interest: string) {
  const { error } = await supabase.from("profiles").upsert(
    {
      slack_id: session.slackId,
      email: session.email,
      name: session.name,
      interest,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "slack_id" },
  );

  if (error) {
    throw error;
  }
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
    updated_at: new Date().toISOString(),
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

  const { error } = await supabase
    .from("profiles")
    .upsert(row, { onConflict: "slack_id" });
  if (error) {
    throw error;
  }
}


export async function listAllProfiles(opts: {
  search?: string;
  limit: number;
  offset: number;
}): Promise<{ profiles: ProfileWithStats[]; total: number }> {
  let query = supabase
    .from("profiles")
    .select("id, slack_id, email, name, interest, created_at, projects(count)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(opts.offset, opts.offset + opts.limit - 1);

  if (opts.search) {
    query = query.or(`name.ilike.%${opts.search}%,email.ilike.%${opts.search}%`);
  }

  const { data, error, count } = await query;
  if (error) {
    throw error;
  }

  const profiles = (data as unknown as (Profile & {
    created_at: string;
    projects: { count: number }[];
  })[]).map((row) => ({
    ...row,
    wonder_count: row.projects[0]?.count ?? 0,
  }));

  return { profiles, total: count ?? 0 };
}

export async function getProfileByIdAdmin(
  id: string,
): Promise<(Profile & { created_at: string }) | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, slack_id, email, name, interest, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data;
}

export async function getProfileIdentityAdmin(
  id: string,
): Promise<ProfileIdentity | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "hca_id, first_name, last_name, slack_display_name, slack_avatar_url, birthday, phone, address_line1, address_line2, address_city, address_state, address_country, address_postal, hca_verification_status, hca_ysws_eligible",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }
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
