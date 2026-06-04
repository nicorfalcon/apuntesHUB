import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateQueryEmbedding } from "@/lib/ai/embeddings";

const STUDY_MATCH_COUNT = 15;
const STUDY_MIN_SIMILARITY = 0.3;
const STUDY_FALLBACK_MIN_SIMILARITY = 0.24;
const STUDY_FALLBACK_MIN_RESULTS = 4;

type SearchChunk = {
  resume_id: string;
  chunk_index: number;
  content: string;
  score?: number | null;
  similarity?: number | null;
  vector_score?: number | null;
  chunk_text_score?: number | null;
};

function chunkKey(chunk: Pick<SearchChunk, "resume_id" | "chunk_index">): string {
  return `${chunk.resume_id}:${chunk.chunk_index}`;
}

function chunkSimilarity(chunk: SearchChunk): number {
  return Number(chunk.similarity ?? chunk.score ?? 0);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  return String(error);
}

function mergeSearchChunks(primary: SearchChunk[], fallback: SearchChunk[]): SearchChunk[] {
  const byKey = new Map<string, SearchChunk>();

  for (const chunk of [...primary, ...fallback]) {
    const key = chunkKey(chunk);
    const similarity = chunkSimilarity(chunk);
    const current = byKey.get(key);
    if (!current || similarity > chunkSimilarity(current)) {
      byKey.set(key, { ...chunk, similarity });
    }
  }

  return Array.from(byKey.values()).sort(
    (a, b) => chunkSimilarity(b) - chunkSimilarity(a)
  );
}

async function searchLegacyChunks(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  queryEmbedding: number[],
  resumeIds: string[] | null
): Promise<{ data: SearchChunk[]; error: { message: string } | null }> {
  const baseParams = {
    query_embedding: JSON.stringify(queryEmbedding),
    match_count: STUDY_MATCH_COUNT,
    resume_ids: resumeIds,
  };

  const { data: firstData, error } = await supabase.rpc("search_chunks_for_study", {
    ...baseParams,
    min_similarity: STUDY_MIN_SIMILARITY,
  });

  if (error) {
    return { data: [], error };
  }

  const firstRows = (firstData ?? []) as SearchChunk[];
  if (firstRows.length >= STUDY_FALLBACK_MIN_RESULTS) {
    return { data: mergeSearchChunks(firstRows, []), error: null };
  }

  const { data: fallbackData } = await supabase.rpc("search_chunks_for_study", {
    ...baseParams,
    min_similarity: STUDY_FALLBACK_MIN_SIMILARITY,
  });

  return {
    data: mergeSearchChunks(firstRows, (fallbackData ?? []) as SearchChunk[]),
    error: null,
  };
}

async function searchHybridChunks(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  query: string,
  queryEmbedding: number[],
  resumeIds: string[] | null
): Promise<{ data: SearchChunk[]; error: { message: string } | null }> {
  const baseParams = {
    query_text: query,
    query_embedding: JSON.stringify(queryEmbedding),
    resume_ids: resumeIds,
    match_count: STUDY_MATCH_COUNT,
  };

  let first: { data: unknown; error: { message: string } | null };
  try {
    first = await supabase.rpc("search_chunks_hybrid_for_study", {
      ...baseParams,
      min_vector_similarity: STUDY_MIN_SIMILARITY,
    });
  } catch (error) {
    console.warn(
      "[ai:search] search_chunks_hybrid_for_study failed; falling back to M1",
      { message: getErrorMessage(error) }
    );
    return searchLegacyChunks(supabase, queryEmbedding, resumeIds);
  }

  if (first.error) {
    console.warn(
      "[ai:search] search_chunks_hybrid_for_study failed; falling back to M1",
      { message: getErrorMessage(first.error) }
    );
    return searchLegacyChunks(supabase, queryEmbedding, resumeIds);
  }

  const firstRows = (first.data ?? []) as SearchChunk[];
  if (firstRows.length >= STUDY_FALLBACK_MIN_RESULTS) {
    return { data: mergeSearchChunks(firstRows, []), error: null };
  }

  let fallback: { data: unknown; error: { message: string } | null };
  try {
    fallback = await supabase.rpc("search_chunks_hybrid_for_study", {
      ...baseParams,
      min_vector_similarity: STUDY_FALLBACK_MIN_SIMILARITY,
    });
  } catch (error) {
    console.warn(
      "[ai:search] search_chunks_hybrid_for_study failed; falling back to M1",
      { message: getErrorMessage(error) }
    );
    return searchLegacyChunks(supabase, queryEmbedding, resumeIds);
  }

  if (fallback.error) {
    console.warn(
      "[ai:search] search_chunks_hybrid_for_study failed; falling back to M1",
      { message: getErrorMessage(fallback.error) }
    );
    return searchLegacyChunks(supabase, queryEmbedding, resumeIds);
  }

  return {
    data: mergeSearchChunks(firstRows, (fallback.data ?? []) as SearchChunk[]),
    error: null,
  };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: { query?: string; resumeIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const query = (body.query ?? "").trim();
  if (!query) {
    return NextResponse.json({ error: "El campo query es requerido" }, { status: 400 });
  }

  const resumeIds = body.resumeIds && body.resumeIds.length > 0 ? body.resumeIds : null;

  // 1. Generar embedding de la query
  let queryEmbedding: number[];
  try {
    queryEmbedding = await generateQueryEmbedding(query);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Error generando embedding", detail: message },
      { status: 500 }
    );
  }

  // 2. Búsqueda híbrida sobre apuntes comprados.
  // search_chunks_hybrid_for_study y el fallback M1 filtran compras internamente.
  const { data: results, error } = await searchHybridChunks(
    supabase,
    query,
    queryEmbedding,
    resumeIds
  );

  if (error) {
    return NextResponse.json(
      { error: "Error en la búsqueda", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ query, results });
}
