-- A version captures what a template looked like at a point in time, so an admin can
-- roll back a bad edit. Written on every explicit (non-autosave) save, holding the
-- *previous* state being overwritten.
create table if not exists signature_template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references signature_templates(id) on delete cascade,
  name text not null,
  html text not null,
  blocks jsonb,
  builder_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists signature_template_versions_template_id_idx on signature_template_versions(template_id);
