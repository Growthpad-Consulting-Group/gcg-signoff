-- Public bucket for images inserted via the template editor's asset manager (logos, inline
-- images dropped into blocks). Public buckets serve objects unauthenticated, so no extra
-- read policy is needed; uploads go through the service-role client, which bypasses RLS.
insert into storage.buckets (id, name, public)
values ('signature-assets', 'signature-assets', true)
on conflict (id) do nothing;
