-- Temas del apunte declarados por el vendedor ("Temas del apunte").
--
-- Objetivo: permitir que el vendedor declare conceptos importantes que cubre el
-- material (p. ej. "Le Chatelier", "equilibrio quimico", "arboles binarios"),
-- para mejorar el recall de la busqueda publica (Meilisearch + fallback Postgres)
-- aunque el PDF no contenga literalmente esos terminos o la extraccion falle.
--
-- Idempotente: usa "add column if not exists". Default '{}' para no romper los
-- apuntes existentes (todos quedan con topics vacios). No toca search_tsv (M2)
-- ni la busqueda hibrida: el matching por topics se hace en la capa de
-- aplicacion (Meilisearch y scoring del browse).

set search_path = public, extensions;

alter table public.resumes
  add column if not exists topics text[] not null default '{}';

-- Indice GIN opcional: hoy el matching por topics se hace en la capa de
-- aplicacion (no por SQL), pero el indice deja preparado un futuro filtro/busqueda
-- por contiene-tema (topics @> array['...']) a costo despreciable.
create index if not exists idx_resumes_topics_gin
  on public.resumes using gin (topics);
