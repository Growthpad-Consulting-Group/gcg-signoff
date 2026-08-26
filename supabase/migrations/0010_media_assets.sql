-- Tracks every file uploaded via /api/uploads so it can be browsed and reused (media library)
-- instead of forcing a brand-new upload every time.
create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  public_url text not null,
  filename text,
  created_at timestamptz not null default now()
);
