-- The block editor's canvas/export width, in px — the "master" width every element is meant to
-- fit inside (a real email-signature width, e.g. 600, not the wide editing canvas shown while
-- working on it). Nullable: unset means "use the default" (600, applied in code, not baked in
-- here so the default can change later without a migration).
alter table signature_templates add column if not exists canvas_width integer;
