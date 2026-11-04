create or replace function gen_referral_slug() returns text language plpgsql as $$
declare
  candidate text;
  digits int := 5;
  tries int := 0;
begin
  loop
    candidate := lpad((floor(random() * power(10, digits)))::bigint::text, digits, '0');
    exit when not exists (select 1 from profiles where referral_slug = candidate);
    tries := tries + 1;
    if tries >= 20 then
      digits := digits + 1;
      tries := 0;
    end if;
  end loop;
  return candidate;
end $$;

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  slack_id text not null unique,
  email text not null,
  name text not null default '',
  interest text,
  hca_id text,
  first_name text,
  last_name text,
  slack_display_name text,
  slack_avatar_url text,
  birthday text,
  phone text,
  address_line1 text,
  address_line2 text,
  address_city text,
  address_state text,
  address_country text,
  address_postal text,
  hca_verification_status text,
  hca_ysws_eligible boolean,
  hackatime_token text,
  hackatime_connected_at timestamptz,
  sessions_valid_after timestamptz,
  referral_slug text not null unique default gen_referral_slug(),
  referral_pin_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists projects (
  id integer generated always as identity primary key,
  profile_id uuid not null references profiles (id) on delete cascade,
  title text not null,
  description text not null,
  image_url text,
  link_url text,
  github_url text,
  status text not null default 'building'
    constraint projects_status_check check (status in (
      'building', 'in_review', 'second_pass', 'rejected', 'approved',
      'shipped', 'fulfillment_started', 'fulfilled'
    )),
  reviewer_note text,
  reward text,
  on_hold boolean not null default false,
  hold_reason text,
  reward_ordered_at timestamptz,
  reward_sent_at timestamptz,
  fulfilled_at timestamptz,
  fulfilled_by text,
  hackatime_projects text[] not null default '{}',
  hackatime_seconds integer,
  hackatime_seconds_prev integer,
  airtable_record_ids text[] not null default '{}',
  hcb_grant_id text,
  hcb_grant_cents integer,
  hcb_grant_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_profile_id_idx on projects (profile_id);
create index if not exists projects_status_idx on projects (status);

alter table projects add column if not exists ai_review_status text not null default 'none'
  constraint projects_ai_review_status_check check (ai_review_status in (
    'none', 'pending', 'clear', 'flagged', 'sent_back', 'error'
  ));
alter table projects add column if not exists ai_review_token text;
alter table projects add column if not exists ai_review_started_at timestamptz;
alter table projects add column if not exists ai_reviewed_at timestamptz;
alter table projects add column if not exists ai_review_model text;
alter table projects add column if not exists ai_review_summary text;
alter table projects add column if not exists ai_review_findings jsonb;
alter table projects add column if not exists ai_review_error text;
alter table projects add column if not exists ai_precheck_sendbacks integer not null default 0;

create table if not exists project_history (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null,
  profile_id uuid not null,
  from_status text,
  to_status text not null,
  reviewer_note text,
  reward text,
  reviewed_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists project_history_project_id_idx on project_history (project_id);
create index if not exists project_history_profile_id_idx on project_history (profile_id);

create table if not exists project_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references projects (id) on delete cascade,
  pass text not null check (pass in ('first', 'second')),
  verdict text not null check (verdict in ('approved', 'changes_requested')),
  feedback text not null,
  technical_notes text,
  additional_notes text,
  checks text[] not null default '{}',
  reviewed_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists project_reviews_project_id_idx on project_reviews (project_id);

create table if not exists review_drafts (
  project_id integer not null references projects (id) on delete cascade,
  pass text not null check (pass in ('first', 'second')),
  technical_notes text not null default '',
  additional_notes text not null default '',
  feedback text not null default '',
  checks text[] not null default '{}',
  updated_by text not null,
  updated_at timestamptz not null default now(),
  primary key (project_id, pass)
);

create table if not exists thumbnails (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  content_type text not null,
  data bytea not null,
  created_at timestamptz not null default now()
);

create table if not exists staff_settings (
  slack_id text primary key,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists staff_roles (
  slack_id text primary key,
  roles text[] not null default '{}',
  updated_by text,
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_slack_id text not null,
  action text not null,
  target text,
  detail jsonb not null default '{}'::jsonb,
  sensitive boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_idx on audit_logs (created_at desc);
create index if not exists audit_logs_actor_idx on audit_logs (actor_slack_id, created_at desc);

create table if not exists account_bans (
  id uuid primary key default gen_random_uuid(),
  slack_id text not null,
  reason text not null,
  banned_by text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by text
);

create index if not exists account_bans_slack_idx on account_bans (slack_id);

create table if not exists rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (bucket, window_start)
);

create table if not exists project_journal (
  id uuid primary key default gen_random_uuid(),
  project_id integer not null references projects (id) on delete cascade,
  profile_id uuid not null,
  title text,
  content text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create index if not exists project_journal_project_id_idx on project_journal (project_id, created_at desc);

alter table profiles add column if not exists referral_slug text not null unique
  default gen_referral_slug();
alter table profiles add column if not exists referral_pin_sent_at timestamptz;

create table if not exists referral_clicks (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references profiles (id) on delete cascade,
  visitor_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists referral_clicks_referrer_idx
  on referral_clicks (referrer_id, created_at desc);

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references profiles (id) on delete cascade,
  referred_id uuid not null unique references profiles (id) on delete cascade,
  sticker_sent_at timestamptz,
  created_at timestamptz not null default now(),
  check (referrer_id <> referred_id)
);

create index if not exists referrals_referrer_idx on referrals (referrer_id);

create table if not exists review_claims (
  project_id integer primary key references projects (id) on delete cascade,
  claimed_by text not null,
  claimed_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now()
);

alter table projects add column if not exists airtable_record_id text;
alter table projects add column if not exists airtable_pushed_at timestamptz;
alter table projects add column if not exists airtable_error text;

alter table projects add column if not exists banned_at timestamptz;
alter table projects add column if not exists ban_reason text;
alter table projects add column if not exists banned_by text;
alter table projects add column if not exists unship_reason text;

alter table profiles add column if not exists shipping_phone text;
alter table profiles add column if not exists shipping_phone_at timestamptz;

alter table projects add column if not exists fulfillment_started_at timestamptz;
update projects set fulfillment_started_at = coalesce(updated_at, now())
  where status in ('fulfillment_started', 'fulfilled') and fulfillment_started_at is null;

alter table projects add column if not exists hackatime_seconds_prev integer;
alter table projects add column if not exists hcb_grant_id text;
alter table projects add column if not exists hcb_grant_cents integer;
alter table projects add column if not exists hcb_grant_sent_at timestamptz;

create table if not exists review_macros (
  id bigint generated always as identity primary key,
  title text not null,
  body text not null,
  created_by text not null,
  created_at timestamptz not null default now()
);

create table if not exists staff_notices (
  key text primary key,
  sent_at timestamptz not null default now()
);

alter table projects add column if not exists airtable_record_ids text[] not null default '{}';
update projects set airtable_record_ids = array[airtable_record_id]
  where airtable_record_id is not null and airtable_record_ids = '{}';

alter table projects add column if not exists invite_code text;
create unique index if not exists projects_invite_code_idx on projects (invite_code) where invite_code is not null;

create table if not exists project_collaborators (
  project_id integer not null references projects (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  hackatime_projects text[] not null default '{}',
  joined_at timestamptz not null default now(),
  primary key (project_id, profile_id)
);
create index if not exists project_collaborators_profile_idx on project_collaborators (profile_id);

create table if not exists dashboard_access (
  slack_id text primary key,
  added_by text not null,
  created_at timestamptz not null default now()
);

alter table project_collaborators add column if not exists id bigint generated always as identity;
create unique index if not exists project_collaborators_id_idx on project_collaborators (id);
alter table project_collaborators add column if not exists hackatime_seconds integer;
alter table project_collaborators add column if not exists hackatime_seconds_prev integer;
alter table project_collaborators add column if not exists reward text;
alter table project_collaborators add column if not exists reward_ordered_at timestamptz;
alter table project_collaborators add column if not exists reward_sent_at timestamptz;
alter table project_collaborators add column if not exists fulfilled_at timestamptz;
alter table project_collaborators add column if not exists fulfilled_by text;
alter table project_collaborators add column if not exists hcb_grant_id text;
alter table project_collaborators add column if not exists hcb_grant_cents integer;
alter table project_collaborators add column if not exists hcb_grant_sent_at timestamptz;
alter table project_collaborators add column if not exists airtable_record_id text;
alter table project_collaborators add column if not exists airtable_record_ids text[] not null default '{}';
alter table project_collaborators add column if not exists airtable_pushed_at timestamptz;
alter table project_collaborators add column if not exists airtable_error text;

alter table projects add column if not exists owner_seconds integer;
alter table projects add column if not exists owner_seconds_prev integer;

create table if not exists budget_settings (
  id boolean primary key default true check (id),
  per_person_cents integer not null default 0,
  updated_by text,
  updated_at timestamptz not null default now()
);
