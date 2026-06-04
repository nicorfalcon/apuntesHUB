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
  similarity?: number | null;
};

function chunkKey(chunk: Pick<SearchChunk, "resume_id" | "chunk_index">): string {
  return `${chunk.resume_id}:${chunk.chunk_index}`;
}

function mergeSearchChunks(primary: SearchChunk[], fallback: SearchChunk[]): SearchChunk[] {
  const byKey = new Map<string, SearchChunk>();

  for (const chunk of [...primary, ...fallback]) {
    const key = chunkKey(chunk);
    const similarity = Number(chunk.similarity ?? 0);
    const current = byKey.get(key);
    if (!current || similarity > Number(current.similarity ?? 0)) {
      byKey.set(key, { ...chunk, similarity });
    }
  }

  return Array.from(byKey.values()).sort(
    (a, b) => Number(b.similarity ?? 0) - Number(a.similarity ?? 0)
  );
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

  // 2. Búsqueda semántica sobre apuntes comprados
  // search_chunks_for_study filtra internamente por purchases.status = 'completed'
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
    return NextResponse.json(
      { error: "Error en la búsqueda", detail: error.message },
      { status: 500 }
    );
  }

  let results = (firstData ?? []) as SearchChunk[];
  if (results.length < STUDY_FALLBACK_MIN_RESULTS) {
    const { data: fallbackData } = await supabase.rpc("search_chunks_for_study", {
      ...baseParams,
      min_similarity: STUDY_FALLBACK_MIN_SIMILARITY,
    });

    results = mergeSearchChunks(results, (fallbackData ?? []) as SearchChunk[]);
  }

  return NextResponse.json({ query, results });
}
