-- GrapesJS project export (component tree + styles), so re-opening a template restores the
-- exact visual layout rather than just re-parsing stored HTML. `html` remains the actual
-- rendered/sent signature (fully CSS-inlined server-side before being stored).
alter table signature_templates add column if not exists builder_data jsonb;
