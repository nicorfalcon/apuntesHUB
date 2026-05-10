-- Migrar de OpenAI ada-002 (1536 dims) a Cohere embed-multilingual-v3.0 (1024 dims)
-- Los chunks existentes se eliminan porque los embeddings son incompatibles entre modelos

DELETE FROM public.document_chunks;

ALTER TABLE public.document_chunks
  ALTER COLUMN embedding TYPE vector(1024);

DROP FUNCTION IF EXISTS public.search_chunks_for_study(vector, integer, double precision, uuid[]);

CREATE OR REPLACE FUNCTION public.search_chunks_for_study(
  query_embedding  vector(1024),
  match_count      int     DEFAULT 5,
  min_similarity   float   DEFAULT 0.3,
  resume_ids       uuid[]  DEFAULT NULL
)
RETURNS TABLE (
  id           uuid,
  resume_id    uuid,
  chunk_index  int,
  content      text,
  similarity   float
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.resume_id,
    dc.chunk_index,
    dc.content,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM document_chunks dc
  WHERE
    (resume_ids IS NULL OR dc.resume_id = ANY(resume_ids))
    AND EXISTS (
      SELECT 1 FROM purchases p
      WHERE p.resume_id = dc.resume_id
        AND p.buyer_id  = auth.uid()
        AND p.status    = 'completed'
    )
    AND 1 - (dc.embedding <=> query_embedding) >= min_similarity
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
