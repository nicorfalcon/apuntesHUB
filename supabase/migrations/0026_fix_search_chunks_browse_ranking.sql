-- Corrige el ranking de la busqueda semantica publica.
-- Primero toma el mejor chunk por apunte y recien despues ordena globalmente.

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
  WITH ranked_chunks AS (
    SELECT
      dc.resume_id,
      1 - (dc.embedding <=> query_embedding) AS similarity,
      dc.embedding <=> query_embedding AS distance
    FROM document_chunks dc
    JOIN resumes r ON r.id = dc.resume_id
    WHERE r.status = 'published'
      AND r.deleted_at IS NULL
      AND dc.embedding IS NOT NULL
      AND 1 - (dc.embedding <=> query_embedding) >= min_similarity
  ),
  best_per_resume AS (
    SELECT DISTINCT ON (resume_id)
      resume_id,
      similarity,
      distance
    FROM ranked_chunks
    ORDER BY resume_id, distance ASC
  )
  SELECT
    resume_id,
    similarity
  FROM best_per_resume
  ORDER BY similarity DESC
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.search_chunks_browse(vector, int, float)
  TO anon, authenticated;
