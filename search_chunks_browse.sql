-- Búsqueda semántica para el catálogo público (sin requerir compra).
-- SECURITY DEFINER bypassea la RLS de document_chunks que requiere purchase,
-- pero SOLO devuelve resume_id y similarity — nunca el contenido del chunk.
-- Dimensión 1024 = Cohere embed-multilingual-v3.0.
--
-- Ejecutar en Supabase SQL Editor antes de usar la búsqueda por tema en /browse.
-- Requiere que la extensión pgvector esté habilitada y que la tabla document_chunks
-- tenga la columna embedding de tipo vector(1024).

CREATE OR REPLACE FUNCTION public.search_chunks_browse(
  query_embedding  vector(1024),
  match_count      int    DEFAULT 20,
  min_similarity   float  DEFAULT 0.25
)
RETURNS TABLE (
  resume_id   uuid,
  similarity  float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (dc.resume_id)
    dc.resume_id,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  JOIN resumes r ON r.id = dc.resume_id
  WHERE r.status = 'published'
    AND 1 - (dc.embedding <=> query_embedding) >= min_similarity
  ORDER BY dc.resume_id, dc.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.search_chunks_browse(vector, int, float)
  TO anon, authenticated;
