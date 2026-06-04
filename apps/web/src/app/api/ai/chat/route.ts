import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateQueryEmbedding } from "@/lib/ai/embeddings";
import { answerFromContext } from "@/lib/ai/llm";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { validateChatRequest } from "@/lib/ai/chat-request";
import { decryptApiKey } from "@/lib/crypto/api-key-encryption";
import { searchWeb } from "@/lib/search/web-search";
import { buildEnrichedPrompt, parseSourcesFromResponse } from "@/lib/ai/prompt-builder";
import { callUserModel } from "@/lib/ai/model-router";

export const maxDuration = 60;

const STUDY_MATCH_COUNT = 15;
const STUDY_MIN_SIMILARITY = 0.3;
const STUDY_FALLBACK_MIN_SIMILARITY = 0.24;
const STUDY_FALLBACK_MIN_RESULTS = 4;
const MAX_CONTEXT_CHUNKS = 18;
const MAX_CONTEXT_CHARS = 12_000;

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type StudyChunk = {
  id?: string;
  resume_id: string;
  chunk_index: number;
  content: string;
  score?: number | null;
  similarity?: number | null;
  vector_score?: number | null;
  chunk_text_score?: number | null;
  seedRank?: number;
};

function chunkKey(chunk: Pick<StudyChunk, "resume_id" | "chunk_index">): string {
  return `${chunk.resume_id}:${chunk.chunk_index}`;
}

function chunkSimilarity(chunk: StudyChunk): number {
  return Number(chunk.similarity ?? chunk.score ?? 0);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  return String(error);
}

function mergeSearchChunks(primary: StudyChunk[], fallback: StudyChunk[]): StudyChunk[] {
  const byKey = new Map<string, StudyChunk>();

  for (const chunk of [...primary, ...fallback]) {
    const key = chunkKey(chunk);
    const similarity = chunkSimilarity(chunk);
    const current = byKey.get(key);
    if (!current || similarity > chunkSimilarity(current)) {
      byKey.set(key, { ...chunk, similarity });
    }
  }

  return Array.from(byKey.values())
    .sort((a, b) => chunkSimilarity(b) - chunkSimilarity(a))
    .map((chunk, index) => ({ ...chunk, seedRank: index }));
}

async function searchLegacyStudyChunks(
  supabase: SupabaseClient,
  queryEmbedding: number[],
  resumeIds: string[] | null
): Promise<{ data: StudyChunk[]; error: { message: string } | null }> {
  const baseParams = {
    query_embedding: JSON.stringify(queryEmbedding),
    match_count: STUDY_MATCH_COUNT,
    resume_ids: resumeIds,
  };

  const first = await supabase.rpc("search_chunks_for_study", {
    ...baseParams,
    min_similarity: STUDY_MIN_SIMILARITY,
  });

  if (first.error) {
    return { data: [], error: first.error };
  }

  const firstRows = (first.data ?? []) as StudyChunk[];
  if (firstRows.length >= STUDY_FALLBACK_MIN_RESULTS) {
    return { data: mergeSearchChunks(firstRows, []), error: null };
  }

  const fallback = await supabase.rpc("search_chunks_for_study", {
    ...baseParams,
    min_similarity: STUDY_FALLBACK_MIN_SIMILARITY,
  });

  if (fallback.error) {
    return { data: mergeSearchChunks(firstRows, []), error: null };
  }

  return {
    data: mergeSearchChunks(firstRows, (fallback.data ?? []) as StudyChunk[]),
    error: null,
  };
}

async function searchStudyChunks(
  supabase: SupabaseClient,
  query: string,
  queryEmbedding: number[],
  resumeIds: string[] | null
): Promise<{ data: StudyChunk[]; error: { message: string } | null }> {
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
      "[ai:chat] search_chunks_hybrid_for_study failed; falling back to M1",
      { message: getErrorMessage(error) }
    );
    return searchLegacyStudyChunks(supabase, queryEmbedding, resumeIds);
  }

  if (first.error) {
    console.warn(
      "[ai:chat] search_chunks_hybrid_for_study failed; falling back to M1",
      { message: getErrorMessage(first.error) }
    );
    return searchLegacyStudyChunks(supabase, queryEmbedding, resumeIds);
  }

  const firstRows = (first.data ?? []) as StudyChunk[];
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
      "[ai:chat] search_chunks_hybrid_for_study failed; falling back to M1",
      { message: getErrorMessage(error) }
    );
    return searchLegacyStudyChunks(supabase, queryEmbedding, resumeIds);
  }

  if (fallback.error) {
    console.warn(
      "[ai:chat] search_chunks_hybrid_for_study failed; falling back to M1",
      { message: getErrorMessage(fallback.error) }
    );
    return searchLegacyStudyChunks(supabase, queryEmbedding, resumeIds);
  }

  return {
    data: mergeSearchChunks(firstRows, (fallback.data ?? []) as StudyChunk[]),
    error: null,
  };
}

async function fetchNeighborChunks(
  supabase: SupabaseClient,
  chunks: StudyChunk[]
): Promise<StudyChunk[]> {
  const wantedByResume = new Map<string, Set<number>>();

  for (const chunk of chunks) {
    const wanted = wantedByResume.get(chunk.resume_id) ?? new Set<number>();
    if (chunk.chunk_index > 0) wanted.add(chunk.chunk_index - 1);
    wanted.add(chunk.chunk_index + 1);
    wantedByResume.set(chunk.resume_id, wanted);
  }

  const rows: StudyChunk[] = [];

  for (const [resumeId, wantedIndexes] of Array.from(wantedByResume.entries())) {
    const indexes = Array.from(wantedIndexes);
    if (indexes.length === 0) continue;

    const { data, error } = await supabase
      .from("document_chunks")
      .select("id, resume_id, chunk_index, content")
      .eq("resume_id", resumeId)
      .in("chunk_index", indexes);

    if (error) continue;

    rows.push(
      ...((data ?? []) as Array<{
        id: string;
        resume_id: string;
        chunk_index: number;
        content: string;
      }>).map((row) => ({ ...row, similarity: 0 }))
    );
  }

  return rows;
}

function mergeChunksWithNeighbors(
  chunks: StudyChunk[],
  neighbors: StudyChunk[]
): StudyChunk[] {
  const neighborSeedRanks = new Map<string, number>();

  for (const chunk of chunks) {
    const rank = chunk.seedRank ?? 0;
    for (const index of [chunk.chunk_index - 1, chunk.chunk_index + 1]) {
      if (index < 0) continue;
      const key = `${chunk.resume_id}:${index}`;
      neighborSeedRanks.set(
        key,
        Math.min(neighborSeedRanks.get(key) ?? Number.MAX_SAFE_INTEGER, rank)
      );
    }
  }

  const byKey = new Map<string, StudyChunk>();
  for (const chunk of chunks) {
    byKey.set(chunkKey(chunk), chunk);
  }

  for (const neighbor of neighbors) {
    const key = chunkKey(neighbor);
    if (!byKey.has(key)) {
      byKey.set(key, {
        ...neighbor,
        seedRank: neighborSeedRanks.get(key) ?? Number.MAX_SAFE_INTEGER,
      });
    }
  }

  return Array.from(byKey.values());
}

function limitContext(chunks: StudyChunk[]): StudyChunk[] {
  const selected: StudyChunk[] = [];
  let totalChars = 0;

  const priorityOrder = [...chunks].sort((a, b) => {
    const rankDiff = (a.seedRank ?? Number.MAX_SAFE_INTEGER) -
      (b.seedRank ?? Number.MAX_SAFE_INTEGER);
    if (rankDiff !== 0) return rankDiff;
    if (a.resume_id !== b.resume_id) return a.resume_id.localeCompare(b.resume_id);
    return a.chunk_index - b.chunk_index;
  });

  for (const chunk of priorityOrder) {
    if (selected.length >= MAX_CONTEXT_CHUNKS) break;
    const nextChars = totalChars + chunk.content.length;
    if (selected.length > 0 && nextChars > MAX_CONTEXT_CHARS) continue;
    selected.push(chunk);
    totalChars = nextChars;
  }

  return selected.sort((a, b) => {
    if (a.resume_id !== b.resume_id) return a.resume_id.localeCompare(b.resume_id);
    return a.chunk_index - b.chunk_index;
  });
}

async function expandChunksWithNeighbors(
  supabase: SupabaseClient,
  chunks: StudyChunk[]
): Promise<StudyChunk[]> {
  if (chunks.length === 0) return [];
  const neighbors = await fetchNeighborChunks(supabase, chunks);
  return limitContext(mergeChunksWithNeighbors(chunks, neighbors));
}

function toLlmChunks(chunks: StudyChunk[]) {
  return chunks.map((chunk) => ({
    content: chunk.content,
    chunkIndex: chunk.chunk_index,
    resumeId: chunk.resume_id,
  }));
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const rl = checkRateLimit(`chat:${user.id}`, 20, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Esperá un momento antes de seguir." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  let body: { query?: string; resumeIds?: string[]; apiKeyId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const validation = validateChatRequest(body);
  if ("error" in validation) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }
  const { query, resumeIds, apiKeyId } = validation;

  // 1. Generar embedding de la pregunta (siempre, para ambas rutas)
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

  // 2. Recuperar chunks relevantes de los apuntes comprados
  const { data: chunks, error: searchError } = await searchStudyChunks(
    supabase,
    query,
    queryEmbedding,
    resumeIds
  );

  if (searchError) {
    return NextResponse.json(
      { error: "Error en la búsqueda", detail: searchError.message },
      { status: 500 }
    );
  }

  const contextChunks = await expandChunksWithNeighbors(supabase, chunks);

  // --- MODELO PLATAFORMA (comportamiento original) ---
  if (!apiKeyId || apiKeyId === "platform") {
    if (contextChunks.length === 0) {
      return NextResponse.json({
        query,
        answer: "No encontré información relevante en tus apuntes para responder esa pregunta.",
        sources: [],
        model: "platform",
      });
    }

    let answer: string;
    try {
      answer = await answerFromContext(query, toLlmChunks(contextChunks));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: "Error generando respuesta", detail: message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      query,
      answer,
      sources: [{ type: "note", label: "Tu apunte" }],
      model: "platform",
      rawSources: contextChunks.map((c) => ({
        resumeId: c.resume_id,
        chunkIndex: c.chunk_index,
        similarity: chunkSimilarity(c),
      })),
    });
  }

  // --- MODELO PROPIO DEL USUARIO ---
  const admin = createAdminClient();
  const { data: userKey } = await admin
    .from("user_api_keys")
    .select("id, provider, model_id, key_encrypted, key_iv")
    .eq("id", apiKeyId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (!userKey) {
    return NextResponse.json({ error: "API key no encontrada" }, { status: 404 });
  }

  let plainApiKey: string;
  try {
    plainApiKey = decryptApiKey(userKey.key_encrypted, userKey.key_iv);
  } catch {
    return NextResponse.json({ error: "Error al procesar la API key" }, { status: 500 });
  }

  // Construir contexto del apunte a partir de los chunks encontrados
  const noteContext = contextChunks.length > 0
    ? contextChunks.map((c, i) => `[Fragmento ${i + 1}]\n${c.content}`).join("\n\n")
    : "No se encontró contenido relevante en el apunte para esta pregunta.";

  // Buscar en internet en paralelo
  const webResults = await searchWeb(query);

  // Construir prompt enriquecido
  const prompt = buildEnrichedPrompt(query, noteContext, webResults);

  let rawText: string;
  try {
    const response = await callUserModel({
      provider: userKey.provider,
      modelId: userKey.model_id,
      apiKey: plainApiKey,
      prompt,
    });
    rawText = response.text;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("timeout") || message.includes("AbortError")) {
      return NextResponse.json(
        { error: "El modelo tardó demasiado en responder. Intentá de nuevo." },
        { status: 504 }
      );
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const { cleanText, sources } = parseSourcesFromResponse(rawText);

  return NextResponse.json({
    query,
    answer: cleanText,
    sources,
    model: userKey.provider,
    modelId: userKey.model_id,
  });
}
