-- Tracks clicks on links embedded directly in a signature template (not the separate campaign
-- banner system) — e.g. a CTA sentence added via the editor's "Insert tracked link" button.
create table if not exists template_link_clicks (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references signature_templates(id) on delete cascade,
  staff_id uuid references staff(id) on delete set null,
  destination text not null,
  label text,
  clicked_at timestamptz not null default now()
);

create index if not exists template_link_clicks_template_id_idx on template_link_clicks(template_id);
