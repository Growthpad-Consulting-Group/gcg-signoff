-- GCG Signoff — signature builder & deployment platform.
-- Fresh Supabase project for this app (not shared with the scraper's database).

create extension if not exists pgcrypto;

-- Admin users of this app (people who log in to build/manage signatures),
-- distinct from `staff`, who are the mail-sending employees signatures get assigned to.
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  password_hash text,
  created_at timestamptz not null default now()
);

create table if not exists magic_tokens (
  email text not null,
  token text not null,
  expires_at timestamptz not null
);
create index if not exists magic_tokens_email_idx on magic_tokens(email);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sessions_user_id_idx on sessions(user_id);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null, -- matches users.email, per existing notifications API convention
  message text not null,
  read boolean not null default false,
  job_id text,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_id_idx on notifications(user_id);

-- A mail domain this workspace manages signatures for (e.g. growthpad.co.ke).
-- `platform` determines how signatures actually get delivered for that domain:
--   'google_workspace' -> Outbound Gateway routes mail through our relay, which stamps it
--   'microsoft_365'     -> Exchange transport rule / Graph connector stamps it
--   'other'             -> generic SMTP relay (MX/DNS changes required, case by case)
create table if not exists domains (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  platform text not null default 'google_workspace' check (platform in ('google_workspace', 'microsoft_365', 'other')),
  gateway_status text not null default 'not_configured' check (gateway_status in ('not_configured', 'pending_dns', 'active', 'error')),
  spf_verified boolean not null default false,
  dkim_verified boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reusable signature designs. `html` is the fully-inlined, table-based email HTML with
-- {{merge_tag}} placeholders (see src/features/signatures/lib/mergeTags.ts for the supported set).
create table if not exists signature_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  html text not null default '',
  thumbnail_url text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Staff whose outgoing mail should carry a signature. One row per person; the merge-tag
-- fields here are what templates draw on when rendering.
create table if not exists staff (
  id uuid primary key default gen_random_uuid(),
  domain_id uuid not null references domains(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role_title text,
  department text,
  phone text,
  mobile text,
  photo_url text,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists staff_domain_id_idx on staff(domain_id);

-- Which template is assigned to which staff member, plus optional per-person HTML overrides
-- (e.g. someone needs a one-off banner) layered on top of the template at render time.
create table if not exists signature_assignments (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade unique,
  template_id uuid not null references signature_templates(id) on delete restrict,
  overrides jsonb not null default '{}'::jsonb,
  last_deployed_at timestamptz,
  deploy_status text not null default 'pending' check (deploy_status in ('pending', 'deployed', 'error')),
  deploy_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
