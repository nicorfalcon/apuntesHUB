-- M2: busqueda hibrida real con Postgres FTS + pgvector.
-- Mantiene compatibilidad con las RPCs M1 y no expone contenido de chunks en browse.

create extension if not exists unaccent;
create extension if not exists vector;

set search_path = public, extensions;

-- unaccent() es STABLE; para columnas generadas e indices necesitamos una
-- envoltura IMMUTABLE con diccionario fijo.
create or replace function public.apunteshub_unaccent(input text)
returns text
language sql
immutable
parallel safe
strict
set search_path = public, extensions
as $$
  select unaccent('unaccent'::regdictionary, input);
$$;

alter table public.resumes
  add column if not exists search_tsv tsvector generated always as (
    setweight(to_tsvector('spanish', public.apunteshub_unaccent(coalesce(title, ''))), 'A') ||
    setweight(to_tsvector('spanish', public.apunteshub_unaccent(coalesce(subject, ''))), 'A') ||
    setweight(to_tsvector('spanish', public.apunteshub_unaccent(coalesce(file_url, ''))), 'B') ||
    setweight(to_tsvector('spanish', public.apunteshub_unaccent(coalesce(description, ''))), 'B') ||
    setweight(to_tsvector('spanish', public.apunteshub_unaccent(coalesce(career, ''))), 'C') ||
    setweight(to_tsvector('spanish', public.apunteshub_unaccent(coalesce(university, ''))), 'C')
  ) stored;

alter table public.document_chunks
  add column if not exists search_tsv tsvector generated always as (
    to_tsvector('spanish', public.apunteshub_unaccent(coalesce(content, '')))
  ) stored;

create index if not exists idx_resumes_search_tsv
  on public.resumes
  using gin (search_tsv);

create index if not exists idx_document_chunks_search_tsv
  on public.document_chunks
  using gin (search_tsv);

create index if not exists idx_document_chunks_resume_chunk
  on public.document_chunks (resume_id, chunk_index);

create index if not exists idx_resumes_published_not_deleted
  on public.resumes (id)
  where status = 'published' and deleted_at is null;

do $$
declare
  created_vector_index boolean := false;
begin
  if exists (select 1 from pg_am where amname = 'hnsw') then
    begin
      create index if not exists idx_document_chunks_embedding_hnsw
        on public.document_chunks
        using hnsw (embedding vector_cosine_ops)
        where embedding is not null;
      created_vector_index := true;
    exception
      when undefined_object or undefined_function or feature_not_supported then
        raise notice 'No se pudo crear indice HNSW para document_chunks.embedding: %', sqlerrm;
    end;
  end if;

  if not created_vector_index and exists (select 1 from pg_am where amname = 'ivfflat') then
    begin
      create index if not exists idx_document_chunks_embedding_ivfflat
        on public.document_chunks
        using ivfflat (embedding vector_cosine_ops)
        with (lists = 100)
        where embedding is not null;
    exception
      when undefined_object or undefined_function or feature_not_supported then
        raise notice 'No se pudo crear indice IVFFLAT para document_chunks.embedding: %', sqlerrm;
    end;
  end if;
end $$;

create or replace function public.search_resumes_hybrid_browse(
  query_text             text,
  query_embedding        vector(1024),
  match_count            int   default 50,
  vector_weight          float default 0.55,
  chunk_text_weight      float default 0.25,
  metadata_weight        float default 0.20,
  min_vector_similarity  float default 0.25
)
returns table (
  resume_id          uuid,
  score              double precision,
  vector_score       double precision,
  chunk_text_score   double precision,
  metadata_score     double precision,
  best_chunk_index   int,
  match_reason       text
)
language sql
stable
security definer
set search_path = public
as $$
  with params as (
    select
      websearch_to_tsquery(
        'spanish',
        public.apunteshub_unaccent(coalesce(query_text, ''))
      ) as tsq,
      greatest(coalesce(match_count, 50), 1) as limit_count,
      least(greatest(coalesce(match_count, 50) * 10, 100), 1000) as vector_pool,
      least(greatest(coalesce(match_count, 50) * 20, 200), 1500) as text_pool,
      coalesce(vector_weight, 0.55)::double precision as vector_weight,
      coalesce(chunk_text_weight, 0.25)::double precision as chunk_text_weight,
      coalesce(metadata_weight, 0.20)::double precision as metadata_weight,
      coalesce(min_vector_similarity, 0.25)::double precision as min_vector_similarity
  ),
  vector_ranked as (
    select
      dc.resume_id,
      dc.chunk_index,
      greatest(0.0, 1 - (dc.embedding <=> query_embedding))::double precision as vector_score,
      (dc.embedding <=> query_embedding) as distance
    from public.document_chunks dc
    join public.resumes r on r.id = dc.resume_id
    cross join params p
    where r.status = 'published'
      and r.deleted_at is null
      and dc.embedding is not null
      and 1 - (dc.embedding <=> query_embedding) >= p.min_vector_similarity
    order by dc.embedding <=> query_embedding
    limit (select vector_pool from params)
  ),
  vector_best as (
    select distinct on (resume_id)
      resume_id,
      chunk_index,
      vector_score
    from vector_ranked
    order by resume_id, vector_score desc, distance asc
  ),
  chunk_text_ranked as (
    select
      dc.resume_id,
      dc.chunk_index,
      least(1.0, ts_rank_cd(dc.search_tsv, p.tsq, 32) * 6.0)::double precision
        as chunk_text_score
    from public.document_chunks dc
    join public.resumes r on r.id = dc.resume_id
    cross join params p
    where r.status = 'published'
      and r.deleted_at is null
      and numnode(p.tsq) > 0
      and dc.search_tsv @@ p.tsq
    order by ts_rank_cd(dc.search_tsv, p.tsq, 32) desc, dc.chunk_index asc
    limit (select text_pool from params)
  ),
  chunk_text_best as (
    select distinct on (resume_id)
      resume_id,
      chunk_index,
      chunk_text_score
    from chunk_text_ranked
    order by resume_id, chunk_text_score desc, chunk_index asc
  ),
  metadata_ranked as (
    select
      r.id as resume_id,
      least(1.0, ts_rank_cd(r.search_tsv, p.tsq, 32) * 5.0)::double precision
        as raw_metadata_score
    from public.resumes r
    cross join params p
    where r.status = 'published'
      and r.deleted_at is null
      and numnode(p.tsq) > 0
      and r.search_tsv @@ p.tsq
    order by ts_rank_cd(r.search_tsv, p.tsq, 32) desc
    limit (select text_pool from params)
  ),
  candidate_resumes as (
    select resume_id from vector_best
    union
    select resume_id from chunk_text_best
    union
    select resume_id from metadata_ranked
  ),
  scored as (
    select
      c.resume_id,
      coalesce(v.vector_score, 0.0)::double precision as vector_score,
      coalesce(ct.chunk_text_score, 0.0)::double precision as chunk_text_score,
      case
        when coalesce(v.vector_score, 0.0) = 0.0
         and coalesce(ct.chunk_text_score, 0.0) = 0.0
          then least(coalesce(m.raw_metadata_score, 0.0), 0.65)
        else coalesce(m.raw_metadata_score, 0.0)
      end::double precision as metadata_score,
      v.chunk_index as vector_chunk_index,
      ct.chunk_index as text_chunk_index
    from candidate_resumes c
    left join vector_best v on v.resume_id = c.resume_id
    left join chunk_text_best ct on ct.resume_id = c.resume_id
    left join metadata_ranked m on m.resume_id = c.resume_id
  ),
  final_scores as (
    select
      s.resume_id,
      (
        p.vector_weight * s.vector_score +
        p.chunk_text_weight * s.chunk_text_score +
        p.metadata_weight * s.metadata_score
      )::double precision as score,
      s.vector_score,
      s.chunk_text_score,
      s.metadata_score,
      case
        when s.vector_score >= s.chunk_text_score and s.vector_score > 0
          then s.vector_chunk_index
        when s.chunk_text_score > 0
          then s.text_chunk_index
        else null
      end as best_chunk_index,
      coalesce(
        nullif(
          concat_ws(
            '+',
            case when s.vector_score > 0 then 'vector' end,
            case when s.chunk_text_score > 0 then 'chunk_text' end,
            case when s.metadata_score > 0 then 'metadata' end
          ),
          ''
        ),
        'none'
      ) as match_reason
    from scored s
    cross join params p
  )
  select
    fs.resume_id,
    fs.score,
    fs.vector_score,
    fs.chunk_text_score,
    fs.metadata_score,
    fs.best_chunk_index,
    fs.match_reason
  from final_scores fs
  where fs.score > 0
  order by fs.score desc, fs.resume_id
  limit (select limit_count from params);
$$;

grant execute on function public.search_resumes_hybrid_browse(
  text, vector, int, float, float, float, float
) to anon, authenticated;

create or replace function public.search_chunks_hybrid_for_study(
  query_text             text,
  query_embedding        vector(1024),
  resume_ids             uuid[] default null,
  match_count            int    default 15,
  min_vector_similarity  float  default 0.24,
  vector_weight          float  default 0.65,
  chunk_text_weight      float  default 0.35
)
returns table (
  resume_id          uuid,
  chunk_index        int,
  content            text,
  score              double precision,
  vector_score       double precision,
  chunk_text_score   double precision
)
language sql
stable
security invoker
set search_path = public
as $$
  with params as (
    select
      websearch_to_tsquery(
        'spanish',
        public.apunteshub_unaccent(coalesce(query_text, ''))
      ) as tsq,
      greatest(coalesce(match_count, 15), 1) as limit_count,
      least(greatest(coalesce(match_count, 15) * 8, 80), 500) as vector_pool,
      least(greatest(coalesce(match_count, 15) * 12, 120), 700) as text_pool,
      coalesce(min_vector_similarity, 0.24)::double precision as min_vector_similarity,
      coalesce(vector_weight, 0.65)::double precision as vector_weight,
      coalesce(chunk_text_weight, 0.35)::double precision as chunk_text_weight
  ),
  authorized_chunks as (
    select
      dc.id,
      dc.resume_id,
      dc.chunk_index,
      dc.content,
      dc.embedding,
      dc.search_tsv
    from public.document_chunks dc
    where (resume_ids is null or dc.resume_id = any(resume_ids))
      and exists (
        select 1
        from public.purchases p
        where p.resume_id = dc.resume_id
          and p.buyer_id = auth.uid()
          and p.status = 'completed'
      )
  ),
  vector_ranked as (
    select
      ac.resume_id,
      ac.chunk_index,
      ac.content,
      greatest(0.0, 1 - (ac.embedding <=> query_embedding))::double precision
        as vector_score
    from authorized_chunks ac
    cross join params p
    where ac.embedding is not null
      and 1 - (ac.embedding <=> query_embedding) >= p.min_vector_similarity
    order by ac.embedding <=> query_embedding
    limit (select vector_pool from params)
  ),
  text_ranked as (
    select
      ac.resume_id,
      ac.chunk_index,
      ac.content,
      least(1.0, ts_rank_cd(ac.search_tsv, p.tsq, 32) * 6.0)::double precision
        as chunk_text_score
    from authorized_chunks ac
    cross join params p
    where numnode(p.tsq) > 0
      and ac.search_tsv @@ p.tsq
    order by ts_rank_cd(ac.search_tsv, p.tsq, 32) desc, ac.chunk_index asc
    limit (select text_pool from params)
  ),
  candidate_chunks as (
    select resume_id, chunk_index from vector_ranked
    union
    select resume_id, chunk_index from text_ranked
  ),
  scored as (
    select
      c.resume_id,
      c.chunk_index,
      coalesce(v.content, t.content) as content,
      coalesce(v.vector_score, 0.0)::double precision as vector_score,
      coalesce(t.chunk_text_score, 0.0)::double precision as chunk_text_score
    from candidate_chunks c
    left join vector_ranked v
      on v.resume_id = c.resume_id and v.chunk_index = c.chunk_index
    left join text_ranked t
      on t.resume_id = c.resume_id and t.chunk_index = c.chunk_index
  ),
  final_scores as (
    select
      s.resume_id,
      s.chunk_index,
      s.content,
      (
        p.vector_weight * s.vector_score +
        p.chunk_text_weight * s.chunk_text_score
      )::double precision as score,
      s.vector_score,
      s.chunk_text_score
    from scored s
    cross join params p
  )
  select
    fs.resume_id,
    fs.chunk_index,
    fs.content,
    fs.score,
    fs.vector_score,
    fs.chunk_text_score
  from final_scores fs
  where fs.score > 0
  order by fs.score desc, fs.resume_id, fs.chunk_index
  limit (select limit_count from params);
$$;

grant execute on function public.search_chunks_hybrid_for_study(
  text, vector, uuid[], int, float, float, float
) to authenticated;
