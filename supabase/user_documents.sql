-- AnyChess user documents (Supabase free plan).
-- Run in the Supabase SQL editor. Translation API keys stay on the API server, not here.

create table if not exists public.user_documents (
  user_id uuid not null references auth.users (id) on delete cascade,
  doc_key text not null,
  payload jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  revision bigint not null default 1,
  primary key (user_id, doc_key)
);

alter table public.user_documents enable row level security;

drop policy if exists user_documents_owner_all on public.user_documents;
create policy user_documents_owner_all
  on public.user_documents
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on public.user_documents from anon, public;
grant select, insert, update, delete on public.user_documents to authenticated;
