import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateQueryEmbedding } from "@/lib/ai/embeddings";
import { answerFromContext } from "@/lib/ai/llm";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { validateChatRequest } from "@/lib/ai/chat-request";
import type { ChatRequestBody } from "@/lib/ai/chat-request";
import { rewriteStudyChatQuery } from "@/lib/ai/study-chat-query";
import { decryptApiKey } from "@/lib/crypto/api-key-encryption";
import { searchWeb } from "@/lib/search/web-search";
import { buildEnrichedPrompt, parseSourcesFromResponse } from "@/lib/ai/prompt-builder";
import { callUserModel } from "@/lib/ai/model-router";
import {
  appendConversationMessage,
  buildConversationTitle,
  conversationBelongsToUser,
  createConversation,
  getConversationWithMessages,
} from "@/lib/ai/conversations";
import { getPrimaryResumeId, recordAiUsageEvent } from "@/lib/ai/usage-events";
import {
  STRUCTURED_ACTIVITY_FALLBACK_TEXT,
  isStructuredActivityMode,
  looksLikeJsonResponse,
  parseStudyActivity,
} from "@/lib/ai/study-activity";
import type { StudyActivity } from "@/lib/ai/study-activity";

export const maxDuration = 60;

const STUDY_MATCH_COUNT = 15;
const STUDY_MIN_SIMILARITY = 0.3;
const STUDY_FALLBACK_MIN_SIMILARITY = 0.24;
const STUDY_FALLBACK_MIN_RESULTS = 4;
const MAX_CONTEXT_CHUNKS = 18;
const MAX_CONTEXT_CHARS = 12_000;
const MAX_STUDY_METADATA_RESUMES = 10;
const MAX_STUDY_METADATA_TOPICS = 12;
const MAX_STUDY_METADATA_TOPIC_LENGTH = 80;

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
  // Metadata M3 (puede faltar en chunks viejos -> null).
  page_start?: number | null;
  page_end?: number | null;
  section_title?: string | null;
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type StudyMetadata = {
  resumeTitle: string | null;
  subject: string | null;
  topics: string[];
};

/**
 * Construye el texto de respuesta para un modo estructurado cuando NO se pudo
 * parsear una actividad: si el modelo devolvió prosa útil la mostramos tal cual;
 * si devolvió JSON inválido (que sería feo de mostrar), usamos un fallback con
 * preguntas genéricas para practicar. Nunca expone JSON crudo.
 */
function structuredFallbackText(rawText: string, cleanProse: string): string {
  if (looksLikeJsonResponse(rawText)) return STRUCTURED_ACTIVITY_FALLBACK_TEXT;
  const prose = cleanProse.trim();
  return prose.length > 0 ? prose : STRUCTURED_ACTIVITY_FALLBACK_TEXT;
}

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

function cleanMetadataText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim().slice(0, maxLength);
  return text.length > 0 ? text : null;
}

function normalizeMetadataTopics(topics: unknown): string[] {
  if (!Array.isArray(topics)) return [];
  return Array.from(
    new Set(
      topics
        .map((topic) => cleanMetadataText(topic, MAX_STUDY_METADATA_TOPIC_LENGTH))
        .filter((topic): topic is string => Boolean(topic))
    )
  );
}

function firstResumeRelation(row: { resumes?: unknown }): {
  title?: unknown;
  subject?: unknown;
  topics?: unknown;
} | null {
  const resume = row.resumes;
  if (Array.isArray(resume)) return (resume[0] as Record<string, unknown> | undefined) ?? null;
  if (typeof resume === "object" && resume !== null) {
    return resume as Record<string, unknown>;
  }
  return null;
}

async function getStudyMetadataForChat({
  supabase,
  userId,
  resumeIds,
  fallback,
}: {
  supabase: SupabaseClient;
  userId: string;
  resumeIds: string[] | null;
  fallback: { resumeTitle: string | null; subject: string | null };
}): Promise<StudyMetadata> {
  try {
    let query = supabase
      .from("purchases")
      .select("resume_id, resumes(title, subject, topics)")
      .eq("buyer_id", userId)
      .eq("status", "completed");

    if (resumeIds && resumeIds.length > 0) {
      query = query.in("resume_id", resumeIds);
    }

    const { data, error } = await query.limit(MAX_STUDY_METADATA_RESUMES);
    if (error) {
      console.warn("[ai:chat] study metadata load failed", {
        message: getErrorMessage(error),
        requestedResumeCount: resumeIds?.length ?? null,
      });
      return { resumeTitle: fallback.resumeTitle, subject: fallback.subject, topics: [] };
    }

    const titles: string[] = [];
    const subjects: string[] = [];
    const topics: string[] = [];

    for (const row of (data ?? []) as Array<{ resumes?: unknown }>) {
      const resume = firstResumeRelation(row);
      if (!resume) continue;

      const title = cleanMetadataText(resume.title, 120);
      const subject = cleanMetadataText(resume.subject, 120);
      if (title && !titles.includes(title)) titles.push(title);
      if (subject && !subjects.includes(subject)) subjects.push(subject);

      for (const topic of normalizeMetadataTopics(resume.topics)) {
        if (!topics.includes(topic) && topics.length < MAX_STUDY_METADATA_TOPICS) {
          topics.push(topic);
        }
      }
    }

    return {
      resumeTitle: titles.slice(0, 3).join(" | ") || fallback.resumeTitle,
      subject: subjects.slice(0, 3).join(", ") || fallback.subject,
      topics,
    };
  } catch (error) {
    console.warn("[ai:chat] study metadata load failed", {
      message: getErrorMessage(error),
      requestedResumeCount: resumeIds?.length ?? null,
    });
    return { resumeTitle: fallback.resumeTitle, subject: fallback.subject, topics: [] };
  }
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

  const orderedSeeds = [...chunks].sort((a, b) => {
    const rankDiff = (a.seedRank ?? Number.MAX_SAFE_INTEGER) -
      (b.seedRank ?? Number.MAX_SAFE_INTEGER);
    if (rankDiff !== 0) return rankDiff;
    return chunkSimilarity(b) - chunkSimilarity(a);
  });

  const emitted = new Set<string>();
  const ordered: StudyChunk[] = [];

  for (const seed of orderedSeeds) {
    const group = [seed.chunk_index - 1, seed.chunk_index, seed.chunk_index + 1]
      .filter((index) => index >= 0)
      .map((index) => byKey.get(`${seed.resume_id}:${index}`))
      .filter((chunk): chunk is StudyChunk => Boolean(chunk))
      .sort((a, b) => a.chunk_index - b.chunk_index);

    for (const chunk of group) {
      const key = chunkKey(chunk);
      if (emitted.has(key)) continue;
      emitted.add(key);
      ordered.push(chunk);
    }
  }

  const leftovers = Array.from(byKey.values())
    .filter((chunk) => !emitted.has(chunkKey(chunk)))
    .sort((a, b) => {
      const rankDiff = (a.seedRank ?? Number.MAX_SAFE_INTEGER) -
        (b.seedRank ?? Number.MAX_SAFE_INTEGER);
      if (rankDiff !== 0) return rankDiff;
      if (a.resume_id !== b.resume_id) return a.resume_id.localeCompare(b.resume_id);
      return a.chunk_index - b.chunk_index;
    });

  return [...ordered, ...leftovers];
}

function limitContext(chunks: StudyChunk[]): StudyChunk[] {
  const selected: StudyChunk[] = [];
  let totalChars = 0;

  for (const chunk of chunks) {
    if (selected.length >= MAX_CONTEXT_CHUNKS) break;
    const nextChars = totalChars + chunk.content.length;
    if (selected.length > 0 && nextChars > MAX_CONTEXT_CHARS) continue;
    selected.push(chunk);
    totalChars = nextChars;
  }

  return selected;
}

async function expandChunksWithNeighbors(
  supabase: SupabaseClient,
  chunks: StudyChunk[]
): Promise<StudyChunk[]> {
  if (chunks.length === 0) return [];
  const neighbors = await fetchNeighborChunks(supabase, chunks);
  return limitContext(mergeChunksWithNeighbors(chunks, neighbors));
}

/**
 * Completa page_start/page_end/section_title de los chunks de contexto con una
 * sola consulta batched por apunte. No toca las RPCs M2: la metadata se lee
 * directo de document_chunks. Backward compatible: chunks viejos devuelven null
 * y se ignoran al armar las citas.
 */
async function enrichWithPageMetadata(
  supabase: SupabaseClient,
  chunks: StudyChunk[]
): Promise<StudyChunk[]> {
  if (chunks.length === 0) return chunks;

  const indexesByResume = new Map<string, Set<number>>();
  for (const chunk of chunks) {
    const set = indexesByResume.get(chunk.resume_id) ?? new Set<number>();
    set.add(chunk.chunk_index);
    indexesByResume.set(chunk.resume_id, set);
  }

  const metaByKey = new Map<
    string,
    { page_start: number | null; page_end: number | null; section_title: string | null }
  >();

  for (const [resumeId, indexSet] of Array.from(indexesByResume.entries())) {
    const { data, error } = await supabase
      .from("document_chunks")
      .select("resume_id, chunk_index, page_start, page_end, section_title")
      .eq("resume_id", resumeId)
      .in("chunk_index", Array.from(indexSet));

    if (error || !data) continue;

    for (const row of data as Array<{
      resume_id: string;
      chunk_index: number;
      page_start: number | null;
      page_end: number | null;
      section_title: string | null;
    }>) {
      metaByKey.set(`${row.resume_id}:${row.chunk_index}`, {
        page_start: row.page_start,
        page_end: row.page_end,
        section_title: row.section_title,
      });
    }
  }

  return chunks.map((chunk) => {
    const meta = metaByKey.get(chunkKey(chunk));
    if (!meta) return chunk;
    return {
      ...chunk,
      page_start: meta.page_start,
      page_end: meta.page_end,
      section_title: meta.section_title,
    };
  });
}

function toLlmChunks(chunks: StudyChunk[]) {
  return chunks.map((chunk) => ({
    content: chunk.content,
    chunkIndex: chunk.chunk_index,
    resumeId: chunk.resume_id,
    pageStart: chunk.page_start ?? null,
    pageEnd: chunk.page_end ?? null,
    sectionTitle: chunk.section_title ?? null,
  }));
}

function toLlmMessages(messages: ChatMessage[]) {
  return messages.slice(-6).map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

/**
 * Resume las páginas usadas en el contexto en un string compacto con rangos,
 * p.ej. "4-5, 8, 12-13". Vacío si ningún chunk tiene metadata de página
 * (chunks viejos pre-M3 -> no se muestra chip de página).
 */
function summarizeContextPages(chunks: StudyChunk[]): string {
  const pages = new Set<number>();
  for (const c of chunks) {
    const start = c.page_start;
    if (typeof start !== "number") continue;
    const end = typeof c.page_end === "number" ? c.page_end : start;
    for (let p = start; p <= end; p++) pages.add(p);
  }
  if (pages.size === 0) return "";

  const sorted = Array.from(pages).sort((a, b) => a - b);
  const parts: string[] = [];
  let rangeStart = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) {
      prev = sorted[i];
      continue;
    }
    parts.push(rangeStart === prev ? `${rangeStart}` : `${rangeStart}-${prev}`);
    rangeStart = prev = sorted[i];
  }
  parts.push(rangeStart === prev ? `${rangeStart}` : `${rangeStart}-${prev}`);
  return parts.join(", ");
}

/** Construye la etiqueta de cita: "páginas 4-5 | sección: X" si hay metadata. */
function formatChunkLabel(chunk: {
  pageStart?: number | null;
  pageEnd?: number | null;
  sectionTitle?: string | null;
}): string {
  const parts: string[] = [];
  const { pageStart, pageEnd, sectionTitle } = chunk;
  if (typeof pageStart === "number") {
    if (typeof pageEnd === "number" && pageEnd !== pageStart) {
      parts.push(`páginas ${pageStart}-${pageEnd}`);
    } else {
      parts.push(`página ${pageStart}`);
    }
  }
  if (sectionTitle && sectionTitle.trim().length > 0) {
    parts.push(`sección: ${sectionTitle.trim()}`);
  }
  return parts.join(" | ");
}

export async function POST(request: NextRequest) {
  const requestStartedAt = Date.now();
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

  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const validation = validateChatRequest(body);
  if ("error" in validation) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }
  const {
    query,
    resumeIds,
    apiKeyId,
    messages,
    resumeTitle,
    subject,
    answerMode,
    count,
    conversationId,
    persist,
  } = validation;
  const primaryResumeId = getPrimaryResumeId(resumeIds);

  let activeConversationId = conversationId;
  let userMessageId: string | null = null;
  let recentConversationMessages = messages;

  if (persist) {
    if (activeConversationId) {
      const ownership = await conversationBelongsToUser(supabase, activeConversationId, user.id);
      if (ownership.error) {
        return NextResponse.json({ error: ownership.error }, { status: 500 });
      }
      if (!ownership.ok) {
        return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
      }
      if (
        ownership.resumeId &&
        resumeIds &&
        resumeIds.length > 0 &&
        !resumeIds.includes(ownership.resumeId)
      ) {
        return NextResponse.json(
          { error: "La conversación no pertenece a este apunte." },
          { status: 409 }
        );
      }

      const existing = await getConversationWithMessages(supabase, activeConversationId);
      if (existing.error) {
        return NextResponse.json({ error: existing.error }, { status: 500 });
      }
      recentConversationMessages = existing.messages
        .map((message) => ({ role: message.role, content: message.content }))
        .slice(-6);
    } else {
      const created = await createConversation(supabase, {
        userId: user.id,
        resumeId: primaryResumeId,
        title: buildConversationTitle(query),
      });
      if (created.error || !created.conversationId) {
        return NextResponse.json(
          { error: created.error ?? "No se pudo crear la conversación" },
          { status: 500 }
        );
      }
      activeConversationId = created.conversationId;
    }

    const appended = await appendConversationMessage(supabase, {
      conversationId: activeConversationId,
      role: "user",
      content: query,
      answerMode,
      modelProvider: apiKeyId && apiKeyId !== "platform" ? "user_key" : "platform",
    });
    if (appended.error) {
      return NextResponse.json({ error: appended.error }, { status: 500 });
    }
    userMessageId = appended.messageId;
  }

  const studyMetadata = await getStudyMetadataForChat({
    supabase,
    userId: user.id,
    resumeIds,
    fallback: { resumeTitle, subject },
  });

  const { retrievalQuery } = rewriteStudyChatQuery({
    latestUserMessage: query,
    recentMessages: messages,
    resumeTitle: studyMetadata.resumeTitle,
    subject: studyMetadata.subject,
  });

  // 1. Generar embedding de la query de recuperación (siempre, para ambas rutas)
  let queryEmbedding: number[];
  try {
    queryEmbedding = await generateQueryEmbedding(retrievalQuery);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordAiUsageEvent(supabase, {
      userId: user.id,
      resumeId: primaryResumeId,
      conversationId: activeConversationId,
      messageId: userMessageId,
      eventType: "chat_error",
      answerMode,
      modelProvider: apiKeyId && apiKeyId !== "platform" ? "user_key" : "platform",
      status: "error",
      errorCode: "embedding_error",
      latencyMs: Date.now() - requestStartedAt,
      retrievalQueryLength: retrievalQuery.length,
    });
    return NextResponse.json(
      { error: "Error generando embedding", detail: message },
      { status: 500 }
    );
  }

  // 2. Recuperar chunks relevantes de los apuntes comprados
  const { data: chunks, error: searchError } = await searchStudyChunks(
    supabase,
    retrievalQuery,
    queryEmbedding,
    resumeIds
  );

  if (searchError) {
    await recordAiUsageEvent(supabase, {
      userId: user.id,
      resumeId: primaryResumeId,
      conversationId: activeConversationId,
      messageId: userMessageId,
      eventType: "chat_error",
      answerMode,
      modelProvider: apiKeyId && apiKeyId !== "platform" ? "user_key" : "platform",
      status: "error",
      errorCode: "search_error",
      latencyMs: Date.now() - requestStartedAt,
      retrievalQueryLength: retrievalQuery.length,
    });
    return NextResponse.json(
      { error: "Error en la búsqueda", detail: searchError.message },
      { status: 500 }
    );
  }

  const expandedChunks = await expandChunksWithNeighbors(supabase, chunks);
  const contextChunks = await enrichWithPageMetadata(supabase, expandedChunks);
  const contextCharCount = contextChunks.reduce((sum, chunk) => sum + chunk.content.length, 0);

  // --- MODELO PLATAFORMA (comportamiento original) ---
  if (!apiKeyId || apiKeyId === "platform") {
    if (contextChunks.length === 0) {
      const answer = "No encontré información relevante en tus apuntes para responder esa pregunta.";
      let assistantMessageId: string | null = null;
      if (activeConversationId) {
        const appended = await appendConversationMessage(supabase, {
          conversationId: activeConversationId,
          role: "assistant",
          content: answer,
          sources: [],
          rawSources: [],
          answerMode,
          modelProvider: "platform",
          latencyMs: Date.now() - requestStartedAt,
        });
        assistantMessageId = appended.messageId;
      }
      await recordAiUsageEvent(supabase, {
        userId: user.id,
        resumeId: primaryResumeId,
        conversationId: activeConversationId,
        messageId: assistantMessageId ?? userMessageId,
        eventType: "chat_message",
        answerMode,
        modelProvider: "platform",
        status: "success",
        latencyMs: Date.now() - requestStartedAt,
        retrievalQueryLength: retrievalQuery.length,
        contextChunkCount: 0,
        contextCharCount: 0,
        sourceCount: 0,
      });
      return NextResponse.json({
        query,
        answer,
        sources: [],
        model: "platform",
        conversationId: activeConversationId,
        userMessageId,
        assistantMessageId,
      });
    }

    const llmChunks = toLlmChunks(contextChunks);
    const llmMessages = toLlmMessages(recentConversationMessages);
    const structuredMode = isStructuredActivityMode(answerMode);

    let answer: string;
    try {
      answer = await answerFromContext(query, llmChunks, {
        recentMessages: llmMessages,
        studyMetadata,
        answerMode,
        count,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await recordAiUsageEvent(supabase, {
        userId: user.id,
        resumeId: primaryResumeId,
        conversationId: activeConversationId,
        messageId: userMessageId,
        eventType: "chat_error",
        answerMode,
        modelProvider: "platform",
        status: "error",
        errorCode: "generation_error",
        latencyMs: Date.now() - requestStartedAt,
        retrievalQueryLength: retrievalQuery.length,
        contextChunkCount: contextChunks.length,
        contextCharCount,
      });
      return NextResponse.json(
        { error: "Error generando respuesta", detail: message },
        { status: 500 }
      );
    }

    let activity: StudyActivity | null = structuredMode
      ? parseStudyActivity(answer, answerMode, count)
      : null;

    // Segundo intento (máximo 1) solo para modos estructurados que no parsearon.
    if (structuredMode && !activity) {
      const repaired = await answerFromContext(query, llmChunks, {
        recentMessages: llmMessages,
        studyMetadata,
        answerMode,
        repair: true,
        count,
      }).catch(() => null);

      if (repaired) {
        const repairedActivity = parseStudyActivity(repaired, answerMode, count);
        if (repairedActivity) {
          activity = repairedActivity;
        } else if (!looksLikeJsonResponse(repaired) && looksLikeJsonResponse(answer)) {
          // El reintento devolvió prosa útil en vez de JSON roto: preferila.
          answer = repaired;
        }
      }
    }

    const pages = summarizeContextPages(contextChunks);
    const sources = [
      { type: "note" as const, label: "Tu apunte", ...(pages ? { pages } : {}) },
    ];
    const rawSources = contextChunks.map((c) => ({
      resumeId: c.resume_id,
      chunkIndex: c.chunk_index,
      similarity: chunkSimilarity(c),
      pageStart: c.page_start ?? null,
      pageEnd: c.page_end ?? null,
      sectionTitle: c.section_title ?? null,
    }));
    const safeAnswer = activity
      ? "Actividad lista para practicar."
      : structuredMode
        ? structuredFallbackText(answer, answer)
        : answer;
    let assistantMessageId: string | null = null;
    if (activeConversationId) {
      const appended = await appendConversationMessage(supabase, {
        conversationId: activeConversationId,
        role: "assistant",
        content: safeAnswer,
        sources,
        rawSources,
        activity,
        answerMode,
        modelProvider: "platform",
        latencyMs: Date.now() - requestStartedAt,
      });
      assistantMessageId = appended.messageId;
    }

    await recordAiUsageEvent(supabase, {
      userId: user.id,
      resumeId: primaryResumeId,
      conversationId: activeConversationId,
      messageId: assistantMessageId ?? userMessageId,
      eventType: activity ? "study_activity_generated" : "chat_message",
      answerMode,
      modelProvider: "platform",
      status: "success",
      latencyMs: Date.now() - requestStartedAt,
      retrievalQueryLength: retrievalQuery.length,
      contextChunkCount: contextChunks.length,
      contextCharCount,
      sourceCount: sources.length,
    });

    return NextResponse.json({
      query,
      answer: safeAnswer,
      sources,
      ...(activity ? { activity } : {}),
      model: "platform",
      rawSources,
      conversationId: activeConversationId,
      userMessageId,
      assistantMessageId,
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
    await recordAiUsageEvent(supabase, {
      userId: user.id,
      resumeId: primaryResumeId,
      conversationId: activeConversationId,
      messageId: userMessageId,
      eventType: "chat_error",
      answerMode,
      modelProvider: "user_key",
      status: "error",
      errorCode: "api_key_not_found",
      latencyMs: Date.now() - requestStartedAt,
      retrievalQueryLength: retrievalQuery.length,
      contextChunkCount: contextChunks.length,
      contextCharCount,
    });
    return NextResponse.json({ error: "API key no encontrada" }, { status: 404 });
  }

  let plainApiKey: string;
  try {
    plainApiKey = decryptApiKey(userKey.key_encrypted, userKey.key_iv);
  } catch {
    await recordAiUsageEvent(supabase, {
      userId: user.id,
      resumeId: primaryResumeId,
      conversationId: activeConversationId,
      messageId: userMessageId,
      eventType: "chat_error",
      answerMode,
      modelProvider: userKey.provider,
      modelId: userKey.model_id,
      status: "error",
      errorCode: "api_key_decrypt_error",
      latencyMs: Date.now() - requestStartedAt,
      retrievalQueryLength: retrievalQuery.length,
      contextChunkCount: contextChunks.length,
      contextCharCount,
    });
    return NextResponse.json({ error: "Error al procesar la API key" }, { status: 500 });
  }

  // Construir contexto del apunte a partir de los chunks encontrados.
  // Incluye páginas/sección cuando la metadata M3 está disponible.
  const noteContext = contextChunks.length > 0
    ? contextChunks
        .map((c, i) => {
          const label = formatChunkLabel({
            pageStart: c.page_start,
            pageEnd: c.page_end,
            sectionTitle: c.section_title,
          });
          const header = label
            ? `[Fragmento ${i + 1} | ${label}]`
            : `[Fragmento ${i + 1}]`;
          return `${header}\n${c.content}`;
        })
        .join("\n\n")
    : "No se encontró contenido relevante en el apunte para esta pregunta.";

  const structuredMode = isStructuredActivityMode(answerMode);

  // En modos estructurados (V/F, multiple choice) NO usamos búsqueda web aunque
  // el toggle esté prendido: la actividad debe basarse solo en el apunte y
  // devolver JSON estricto. La web aumenta el riesgo de salida no estructurada.
  const webResults = structuredMode ? [] : await searchWeb(query);
  const llmMessages = toLlmMessages(recentConversationMessages);

  async function callOwnModel(repair: boolean): Promise<string> {
    const prompt = buildEnrichedPrompt(query, noteContext, webResults, {
      recentMessages: llmMessages,
      studyMetadata,
      answerMode,
      repair,
      count,
    });
    const response = await callUserModel({
      provider: userKey!.provider,
      modelId: userKey!.model_id,
      apiKey: plainApiKey,
      prompt,
    });
    return response.text;
  }

  let rawText: string;
  try {
    rawText = await callOwnModel(false);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordAiUsageEvent(supabase, {
      userId: user.id,
      resumeId: primaryResumeId,
      conversationId: activeConversationId,
      messageId: userMessageId,
      eventType: "chat_error",
      answerMode,
      modelProvider: userKey.provider,
      modelId: userKey.model_id,
      status: "error",
      errorCode: message.includes("timeout") || message.includes("AbortError")
        ? "model_timeout"
        : "model_provider_error",
      latencyMs: Date.now() - requestStartedAt,
      retrievalQueryLength: retrievalQuery.length,
      contextChunkCount: contextChunks.length,
      contextCharCount,
    });
    if (message.includes("timeout") || message.includes("AbortError")) {
      return NextResponse.json(
        { error: "El modelo tardó demasiado en responder. Intentá de nuevo." },
        { status: 504 }
      );
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }

  let parsedActivity: StudyActivity | null = structuredMode
    ? parseStudyActivity(rawText, answerMode, count)
    : null;

  // Segundo intento (máximo 1) de reparación solo para modos estructurados.
  if (structuredMode && !parsedActivity) {
    const repaired = await callOwnModel(true).catch(() => null);
    if (repaired) {
      const repairedActivity = parseStudyActivity(repaired, answerMode, count);
      if (repairedActivity) {
        parsedActivity = repairedActivity;
        rawText = repaired;
      } else if (!looksLikeJsonResponse(repaired) && looksLikeJsonResponse(rawText)) {
        // El reintento devolvió prosa útil en vez de JSON roto: preferila.
        rawText = repaired;
      }
    }
  }

  const { cleanText, sources } = parseSourcesFromResponse(rawText);

  // Adjuntamos las páginas de forma determinística a la fuente del apunte:
  // no confiamos en que el modelo las informe bien. Solo si hay metadata M3.
  const contextPages = summarizeContextPages(contextChunks);
  const baseSources = parsedActivity
    ? [{ type: "note" as const, label: "Tu apunte" }]
    : sources;
  const sourcesWithPages = contextPages
    ? baseSources.map((s) =>
        s.type === "note" ? { ...s, pages: s.pages ?? contextPages } : s
      )
    : baseSources;
  const answer = parsedActivity
    ? "Actividad lista para practicar."
    : structuredMode
      ? structuredFallbackText(rawText, cleanText)
      : cleanText;
  const rawSources = contextChunks.map((c) => ({
    resumeId: c.resume_id,
    chunkIndex: c.chunk_index,
    similarity: chunkSimilarity(c),
    pageStart: c.page_start ?? null,
    pageEnd: c.page_end ?? null,
    sectionTitle: c.section_title ?? null,
  }));
  let assistantMessageId: string | null = null;
  if (activeConversationId) {
    const appended = await appendConversationMessage(supabase, {
      conversationId: activeConversationId,
      role: "assistant",
      content: answer,
      sources: sourcesWithPages,
      rawSources,
      activity: parsedActivity,
      answerMode,
      modelProvider: userKey.provider,
      modelId: userKey.model_id,
      latencyMs: Date.now() - requestStartedAt,
    });
    assistantMessageId = appended.messageId;
  }

  await recordAiUsageEvent(supabase, {
    userId: user.id,
    resumeId: primaryResumeId,
    conversationId: activeConversationId,
    messageId: assistantMessageId ?? userMessageId,
    eventType: parsedActivity ? "study_activity_generated" : "chat_message",
    answerMode,
    modelProvider: userKey.provider,
    modelId: userKey.model_id,
    status: "success",
    latencyMs: Date.now() - requestStartedAt,
    retrievalQueryLength: retrievalQuery.length,
    contextChunkCount: contextChunks.length,
    contextCharCount,
    sourceCount: sourcesWithPages.length,
  });

  return NextResponse.json({
    query,
    answer,
    sources: sourcesWithPages,
    ...(parsedActivity ? { activity: parsedActivity } : {}),
    model: userKey.provider,
    modelId: userKey.model_id,
    rawSources,
    conversationId: activeConversationId,
    userMessageId,
    assistantMessageId,
  });
}
