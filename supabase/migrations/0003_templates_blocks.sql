-- Structured block list backing the visual drag-and-drop template editor. `html` remains the
-- source of truth for actually rendering/sending signatures; `blocks` is the authoring layer
-- that regenerates it.
alter table signature_templates add column if not exists blocks jsonb;

-- Back-fill existing templates as a single opaque "Advanced HTML" block so nothing breaks.
update signature_templates
set blocks = jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text, 'type', 'html', 'html', html))
where blocks is null;
