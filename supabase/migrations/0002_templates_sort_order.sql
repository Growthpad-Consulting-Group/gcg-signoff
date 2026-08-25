-- Manual drag-to-reorder ordering for the templates list page.
alter table signature_templates add column if not exists sort_order integer not null default 0;

update signature_templates set sort_order = sub.rn
from (
  select id, row_number() over (order by created_at) as rn
  from signature_templates
) sub
where signature_templates.id = sub.id;
