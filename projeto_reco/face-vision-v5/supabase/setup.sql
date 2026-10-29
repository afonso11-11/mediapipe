-- Rode no Supabase: SQL Editor > New query > Run
-- Tabela de rostos cadastrados (assinaturas numéricas dos landmarks, sem imagens)
create table if not exists public.face_registry (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 40),
  signature   jsonb not null,
  samples     integer not null default 1,
  consent     boolean not null default false check (consent = true),
  consent_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  constraint signature_is_array check (jsonb_typeof(signature) = 'array' and jsonb_array_length(signature) = 306)
);

create index if not exists face_registry_owner_idx on public.face_registry (owner_id);

-- Cada usuário logado só enxerga e altera os próprios cadastros
alter table public.face_registry enable row level security;

create policy "ler os proprios cadastros"
  on public.face_registry for select to authenticated
  using (owner_id = auth.uid());

create policy "criar os proprios cadastros"
  on public.face_registry for insert to authenticated
  with check (owner_id = auth.uid());

create policy "apagar os proprios cadastros"
  on public.face_registry for delete to authenticated
  using (owner_id = auth.uid());
