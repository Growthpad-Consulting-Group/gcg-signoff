-- Tracks the Gmail API signature push (src/features/signatures/lib/gmailSync.ts) separately
-- from the gateway's deploy_status/deploy_error — these are two independent delivery
-- mechanisms (see docs/ARCHITECTURE.md) and a staff member can have either, both, or neither
-- active at a given time.
alter table signature_assignments
  add column if not exists gmail_sync_status text not null default 'pending'
    check (gmail_sync_status in ('pending', 'synced', 'error', 'not_applicable')),
  add column if not exists gmail_sync_error text,
  add column if not exists last_gmail_synced_at timestamptz;
