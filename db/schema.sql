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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_profile_id_idx on projects (profile_id);
create index if not exists projects_status_idx on projects (status);

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
