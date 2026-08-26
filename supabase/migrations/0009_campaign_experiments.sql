-- A/B testing for campaign banners: group 2+ campaigns as variants of one experiment. Purely
-- reporting metadata — selection still runs through the existing weighted-random pick in
-- selectCampaign.ts, unaffected by this grouping.
create table if not exists campaign_experiments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

alter table campaigns add column if not exists experiment_id uuid references campaign_experiments(id) on delete set null;
alter table campaigns add column if not exists variant_label text;

create index if not exists campaigns_experiment_id_idx on campaigns(experiment_id);
