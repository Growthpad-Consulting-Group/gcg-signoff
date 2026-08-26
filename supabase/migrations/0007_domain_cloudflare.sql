-- Cloudflare DNS auto-apply: the API token is stored encrypted at rest (AES-256-GCM,
-- src/shared/lib/crypto.ts) and never returned to the client after being saved.
alter table domains add column if not exists cloudflare_api_token_encrypted text;
alter table domains add column if not exists cloudflare_zone_id text;
