-- CoBoard schema. Run this once in the Supabase SQL editor for a fresh
-- project (Project → SQL Editor → New query → paste → Run).

create table if not exists boards (
  id          text primary key,
  snapshot    jsonb not null default '[]',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Anonymous-by-link model (PRD §14.4): RLS is intentionally open so
-- anyone with a board's URL can read and write it. There are no
-- accounts in v1 — this is a deliberate trade-off, not an oversight.
-- Locking this down is the Phase 6 Auth stretch goal.
alter table boards enable row level security;

drop policy if exists "Anyone can read boards" on boards;
create policy "Anyone can read boards"
  on boards for select
  to anon
  using (true);

drop policy if exists "Anyone can create boards" on boards;
create policy "Anyone can create boards"
  on boards for insert
  to anon
  with check (true);

drop policy if exists "Anyone can update boards" on boards;
create policy "Anyone can update boards"
  on boards for update
  to anon
  using (true)
  with check (true);
