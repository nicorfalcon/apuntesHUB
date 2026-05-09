-- ============================================
-- Migración: Asistente IA de estudio (complemento)
-- Agrega ingestion_jobs y search_chunks_for_study.
-- No modifica document_chunks ni search_chunks existentes.
-- ============================================

-- 1. Tabla de jobs de ingesta
create table public.ingestion_jobs (
  id               uuid primary key default gen_random_uuid(),
  resume_id        uuid not null unique references public.resumes(id) on delete cascade,
  status           text not null default 'pending'
                     check (status in ('pending', 'processing', 'done', 'failed')),
  chunks_generated integer not null default 0,
  error_message    text,
  started_at       timestamptz,
  finished_at      timestamptz,
  created_at       timestamptz not null default now()
);

create index idx_ingestion_jobs_resume_id on public.ingestion_jobs(resume_id);

alter table public.ingestion_jobs enable row level security;

-- El seller puede ver el estado de ingesta de sus apuntes
create policy "ingestion_jobs: select por seller"
  on public.ingestion_jobs for select
  using (
    exists (
      select 1 from public.resumes r
      where r.id = ingestion_jobs.resume_id
        and r.seller_id = auth.uid()
    )
  );

-- El comprador puede ver el estado (para saber si el apunte ya está listo para el asistente)
create policy "ingestion_jobs: select por buyer"
  on public.ingestion_jobs for select
  using (
    exists (
      select 1 from public.purchases p
      where p.resume_id = ingestion_jobs.resume_id
        and p.buyer_id = auth.uid()
        and p.status = 'completed'
    )
  );

-- Escritura solo desde service_role (el handler de ingesta usa admin client)

-- 2. Función de búsqueda para el asistente de estudio (post-compra)
-- A diferencia de search_chunks (browse público), esta:
--   - Es security invoker → la RLS de document_chunks filtra por compras
--   - Devuelve el contenido del chunk para armar el contexto del LLM
--   - Filtra opcionalmente por resume_ids específicos
create or replace function public.search_chunks_for_study(
  query_embedding  vector(1536),
  match_count      int default 5,
  min_similarity   float default 0.3,
  resume_ids       uuid[] default null
)
returns table (
  resume_id    uuid,
  chunk_index  integer,
  content      text,
  similarity   float
)
language sql stable security invoker
set search_path = ''
as $$
  select
    dc.resume_id,
    dc.chunk_index,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  join public.purchases p
    on p.resume_id = dc.resume_id
   and p.buyer_id = auth.uid()
   and p.status = 'completed'
  where (resume_ids is null or dc.resume_id = any(resume_ids))
    and 1 - (dc.embedding <=> query_embedding) > min_similarity
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function public.search_chunks_for_study(vector, int, float, uuid[]) to authenticated;
