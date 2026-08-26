-- Signature banners ("campaigns") — a banner image + link, optionally scoped to one domain and
-- a date range, appended below the rendered signature at send-time (see /api/render). Multiple
-- simultaneously-active campaigns rotate via weighted random selection per render.
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_url text not null,
  link_url text not null,
  domain_id uuid references domains(id) on delete cascade, -- null = all domains
  weight int not null default 1,
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Daily rollup rather than one row per send — keeps the analytics chart's source data small
-- while still giving real day-by-day trends (a single lifetime counter can't chart "over time").
create table if not exists campaign_daily_stats (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  date date not null,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  unique (campaign_id, date)
);

-- One row per click (low volume) — powers a "recent clicks" list and per-click staff
-- attribution, which the daily rollup alone can't give.
create table if not exists campaign_clicks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  staff_id uuid references staff(id) on delete set null,
  clicked_at timestamptz not null default now()
);

create index if not exists campaign_daily_stats_campaign_id_idx on campaign_daily_stats(campaign_id);
create index if not exists campaign_clicks_campaign_id_idx on campaign_clicks(campaign_id);
