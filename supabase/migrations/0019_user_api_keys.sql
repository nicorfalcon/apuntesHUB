-- ============================================
-- Migración: user_api_keys
-- Almacena API keys cifradas de proveedores externos (OpenAI, Gemini, custom).
-- ============================================

create table public.user_api_keys (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  provider      text not null check (provider in ('openai', 'gemini', 'custom')),
  display_name  text not null,
  model_id      text,
  key_encrypted text not null,
  key_iv        text not null,
  key_hint      text,           -- últimos 4 chars visibles, ej: "...a8f2"
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index idx_user_api_keys_user_id on public.user_api_keys(user_id);

alter table public.user_api_keys enable row level security;

-- El usuario solo ve sus propias keys activas
create policy "user_api_keys: select propio"
  on public.user_api_keys for select
  using (user_id = auth.uid() and is_active = true);

-- El usuario puede insertar sus propias keys (máximo 5 lo controla la app)
create policy "user_api_keys: insert propio"
  on public.user_api_keys for insert
  with check (user_id = auth.uid());

-- El usuario puede desactivar (soft-delete) sus propias keys
create policy "user_api_keys: update propio"
  on public.user_api_keys for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Trigger para updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_user_api_keys_updated_at
  before update on public.user_api_keys
  for each row execute function public.set_updated_at();
