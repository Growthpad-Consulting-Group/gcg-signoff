-- Version snapshots need to carry canvas_width too (added in 0013), or restoring an old version
-- silently leaves whatever width the template currently has instead of rolling it back with the
-- rest of the content.
alter table signature_template_versions add column if not exists canvas_width integer;
