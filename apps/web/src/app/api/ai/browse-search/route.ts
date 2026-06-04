// Busqueda IA para el catalogo publico.
// Estrategia hibrida simple: candidatos vectoriales + candidatos por metadata.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateQueryEmbedding } from "@/lib/ai/embeddings";
import {
  isMeilisearchBrowseEnabled,
  searchResumeIdsInMeilisearch,
} from "@/lib/search/meilisearch";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 15;
const RATE_WINDOW = 60_000;
const VECTOR_MATCH_COUNT = 150;
const VECTOR_MIN_SIMILARITY = 0.32;
const VECTOR_FALLBACK_MIN_SIMILARITY = 0.25;
const VECTOR_FALLBACK_MIN_RESULTS = 10;
const RESULT_LIMIT = 50;
const METADATA_MIN_SCORE = 0.22;
const METADATA_ONLY_SCORE_CAP = 0.78;
const VECTOR_METADATA_BOOST = 0.18;
const HYBRID_VECTOR_WEIGHT = 0.55;
const HYBRID_CHUNK_TEXT_WEIGHT = 0.25;
const HYBRID_METADATA_WEIGHT = 0.2;
const RESUME_METADATA_SELECT =
  "id, title, subject, career, university, description, file_url, topics";

type VectorCandidate = {
  resume_id: string;
  similarity: number;
};

type ResumeMetadata = {
  id: string;
  title: string;
  subject: string;
  career: string;
  university: string;
  description: string | null;
  file_url: string | null;
  topics: string[] | null;
};

type HybridBrowseCandidate = {
  resume_id: string;
  score: number;
  vector_score?: number | null;
  chunk_text_score?: number | null;
  metadata_score?: number | null;
  best_chunk_index?: number | null;
  match_reason?: string | null;
};

type RankedCandidate = {
  resumeId: string;
  similarity: number;
};

type MetadataScore = {
  score: number;
  metadataOnlyScore: number;
  eligibleMetadataOnly: boolean;
};

function checkBrowseRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// Extrae tokens significativos de la query (>= 3 caracteres, excluye stopwords comunes).
const STOPWORDS = new Set([
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "un",
  "una",
  "uno",
  "unos",
  "unas",
  "y",
  "o",
  "en",
  "con",
  "por",
  "para",
  "que",
  "le",
  "lo",
  "al",
  "a",
  "sobre",
  "como",
  "cual",
  "cuales",
  "es",
  "son",
]);

const WEAK_METADATA_TOKENS = new Set([
  "universidad",
  "facultad",
  "carrera",
  "materia",
  "apunte",
  "apuntes",
  "resumen",
  "resumenes",
  "parcial",
  "parciales",
  "final",
  "finales",
  "pdf",
  "clase",
  "clases",
  "guia",
  "guias",
  "teoria",
]);

function tokenizeNormalizedText(text: string): string[] {
  return normalizeText(text).match(/[a-z0-9]+/g) ?? [];
}

function isWeakQueryToken(token: string): boolean {
  return STOPWORDS.has(token) || WEAK_METADATA_TOKENS.has(token);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  return String(error);
}

function extractQueryTokens(query: string): string[] {
  return Array.from(new Set(tokenizeNormalizedText(query)))
    .filter((t) => t.length >= 3 && !isWeakQueryToken(t));
}

function fileNameFromPath(path: string | null): string {
  if (!path) return "";
  const fileName = path.split("/").pop() ?? "";
  try {
    return decodeURIComponent(fileName);
  } catch {
    return fileName;
  }
}

function countTokenMatches(text: string, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const haystack = normalizeText(text);
  return tokens.filter((token) => haystack.includes(token)).length;
}

function countUniqueTokenMatches(fields: string[], tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const matched = new Set<string>();
  for (const token of tokens) {
    if (fields.some((field) => field.includes(token))) {
      matched.add(token);
    }
  }
  return matched.size;
}

function hasMeaningfulPhraseMatch(
  field: string,
  normalizedQuery: string
): boolean {
  if (normalizedQuery.length < 3) return false;
  const queryTokens = tokenizeNormalizedText(normalizedQuery);
  if (queryTokens.length === 0) return false;
  if (queryTokens.every(isWeakQueryToken)) return false;
  return field.includes(normalizedQuery);
}

function hasShortExactFieldMatch(
  field: string,
  normalizedQuery: string
): boolean {
  const queryTokens = tokenizeNormalizedText(normalizedQuery);
  if (queryTokens.length !== 1) return false;
  const [token] = queryTokens;
  if (token.length < 2 || token.length >= 3 || isWeakQueryToken(token)) {
    return false;
  }
  return tokenizeNormalizedText(field).includes(token);
}

function scoreResumeMetadata(
  resume: ResumeMetadata,
  normalizedQuery: string,
  tokens: string[]
): MetadataScore {
  const fields = {
    title: normalizeText(resume.title),
    subject: normalizeText(resume.subject),
    career: normalizeText(resume.career),
    university: normalizeText(resume.university),
    description: normalizeText(resume.description ?? ""),
    fileName: normalizeText(fileNameFromPath(resume.file_url)),
    // Temas declarados por el vendedor. Se concatenan para el matching textual;
    // resuelven busquedas por conceptos que el PDF no nombra literalmente.
    topics: normalizeText((resume.topics ?? []).join(" ")),
  };

  const titlePhraseMatch = hasMeaningfulPhraseMatch(fields.title, normalizedQuery);
  const topicsPhraseMatch = hasMeaningfulPhraseMatch(fields.topics, normalizedQuery);
  const subjectPhraseMatch = hasMeaningfulPhraseMatch(fields.subject, normalizedQuery);
  const careerPhraseMatch = hasMeaningfulPhraseMatch(fields.career, normalizedQuery);
  const universityPhraseMatch = hasMeaningfulPhraseMatch(
    fields.university,
    normalizedQuery
  );
  const descriptionPhraseMatch = hasMeaningfulPhraseMatch(
    fields.description,
    normalizedQuery
  );
  const fileNamePhraseMatch = hasMeaningfulPhraseMatch(
    fields.fileName,
    normalizedQuery
  );

  const titleTokenMatches = countTokenMatches(fields.title, tokens);
  const topicsTokenMatches = countTokenMatches(fields.topics, tokens);
  const subjectTokenMatches = countTokenMatches(fields.subject, tokens);
  const careerTokenMatches = countTokenMatches(fields.career, tokens);
  const universityTokenMatches = countTokenMatches(fields.university, tokens);
  const descriptionTokenMatches = countTokenMatches(fields.description, tokens);
  const fileNameTokenMatches = countTokenMatches(fields.fileName, tokens);

  const shortExactTitleMatch = hasShortExactFieldMatch(fields.title, normalizedQuery);
  const shortExactTopicsMatch = hasShortExactFieldMatch(
    fields.topics,
    normalizedQuery
  );
  const shortExactSubjectMatch = hasShortExactFieldMatch(
    fields.subject,
    normalizedQuery
  );
  const shortExactFileNameMatch = hasShortExactFieldMatch(
    fields.fileName,
    normalizedQuery
  );

  let score = 0;

  if (titlePhraseMatch) score += 0.55;
  // topics declarados por el vendedor: senal fuerte, casi a la par de title.
  if (topicsPhraseMatch) score += 0.5;
  if (subjectPhraseMatch) score += 0.42;
  if (fileNamePhraseMatch) score += 0.36;
  if (careerPhraseMatch) score += 0.16;
  if (universityPhraseMatch) score += 0.12;
  if (descriptionPhraseMatch) score += 0.12;

  if (shortExactTitleMatch) score += 0.5;
  if (shortExactTopicsMatch) score += 0.46;
  if (shortExactSubjectMatch) score += 0.38;
  if (shortExactFileNameMatch) score += 0.34;

  if (tokens.length > 0) {
    score += (titleTokenMatches / tokens.length) * 0.4;
    score += (topicsTokenMatches / tokens.length) * 0.36;
    score += (subjectTokenMatches / tokens.length) * 0.3;
    score += (fileNameTokenMatches / tokens.length) * 0.24;
    score += (careerTokenMatches / tokens.length) * 0.08;
    score += (universityTokenMatches / tokens.length) * 0.06;
    score += (descriptionTokenMatches / tokens.length) * 0.1;
  }

  const primaryUsefulTokenMatches = countUniqueTokenMatches(
    [fields.title, fields.topics, fields.subject, fields.fileName, fields.description],
    tokens
  );
  const hasPrimaryMetadataMatch =
    titlePhraseMatch ||
    topicsPhraseMatch ||
    subjectPhraseMatch ||
    fileNamePhraseMatch ||
    titleTokenMatches > 0 ||
    topicsTokenMatches > 0 ||
    subjectTokenMatches > 0 ||
    fileNameTokenMatches > 0 ||
    shortExactTitleMatch ||
    shortExactTopicsMatch ||
    shortExactSubjectMatch ||
    shortExactFileNameMatch;
  const eligibleMetadataOnly =
    hasPrimaryMetadataMatch || primaryUsefulTokenMatches >= 2;
  const cappedScore = Math.min(score, 0.98);

  return {
    score: cappedScore,
    metadataOnlyScore: Math.min(cappedScore, METADATA_ONLY_SCORE_CAP),
    eligibleMetadataOnly,
  };
}

function mergeVectorCandidates(
  primary: VectorCandidate[],
  fallback: VectorCandidate[]
): VectorCandidate[] {
  const byResume = new Map<string, VectorCandidate>();
  for (const row of [...primary, ...fallback]) {
    const current = byResume.get(row.resume_id);
    if (!current || row.similarity > current.similarity) {
      byResume.set(row.resume_id, row);
    }
  }
  return Array.from(byResume.values()).sort((a, b) => b.similarity - a.similarity);
}

async function searchVectorCandidates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  queryEmbedding: number[]
): Promise<{ data: VectorCandidate[]; error: { message: string } | null }> {
  const baseParams = {
    query_embedding: JSON.stringify(queryEmbedding),
    match_count: VECTOR_MATCH_COUNT,
  };

  const first = await supabase.rpc("search_chunks_browse", {
    ...baseParams,
    min_similarity: VECTOR_MIN_SIMILARITY,
  });

  if (first.error) {
    return { data: [], error: first.error };
  }

  const firstRows = (first.data ?? []) as VectorCandidate[];
  if (firstRows.length >= VECTOR_FALLBACK_MIN_RESULTS) {
    return { data: firstRows, error: null };
  }

  const fallback = await supabase.rpc("search_chunks_browse", {
    ...baseParams,
    min_similarity: VECTOR_FALLBACK_MIN_SIMILARITY,
  });

  if (fallback.error) {
    return { data: firstRows, error: null };
  }

  return {
    data: mergeVectorCandidates(firstRows, (fallback.data ?? []) as VectorCandidate[]),
    error: null,
  };
}

function dedupeHybridCandidates(rows: HybridBrowseCandidate[]): HybridBrowseCandidate[] {
  const byResume = new Map<string, HybridBrowseCandidate>();

  for (const row of rows) {
    const score = Number(row.score ?? 0);
    const current = byResume.get(row.resume_id);
    if (!current || score > Number(current.score ?? 0)) {
      byResume.set(row.resume_id, { ...row, score });
    }
  }

  return Array.from(byResume.values()).sort(
    (a, b) => Number(b.score ?? 0) - Number(a.score ?? 0)
  );
}

async function searchHybridBrowseCandidates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  query: string,
  queryEmbedding: number[]
): Promise<{ data: HybridBrowseCandidate[]; error: { message: string } | null }> {
  let result: { data: unknown; error: { message: string } | null };
  try {
    result = await supabase.rpc("search_resumes_hybrid_browse", {
      query_text: query,
      query_embedding: JSON.stringify(queryEmbedding),
      match_count: RESULT_LIMIT,
      vector_weight: HYBRID_VECTOR_WEIGHT,
      chunk_text_weight: HYBRID_CHUNK_TEXT_WEIGHT,
      metadata_weight: HYBRID_METADATA_WEIGHT,
      min_vector_similarity: VECTOR_FALLBACK_MIN_SIMILARITY,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    console.warn(
      "[ai:browse] search_resumes_hybrid_browse failed; falling back to M1",
      { message }
    );
    return { data: [], error: { message } };
  }

  if (result.error) {
    console.warn(
      "[ai:browse] search_resumes_hybrid_browse failed; falling back to M1",
      { message: getErrorMessage(result.error) }
    );
    return { data: [], error: result.error };
  }

  return {
    data: dedupeHybridCandidates((result.data ?? []) as HybridBrowseCandidate[]),
    error: null,
  };
}

async function fetchPublishedResumeMetadata(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  resumeIds?: string[]
): Promise<{ data: ResumeMetadata[] | null; error: { message: string } | null }> {
  const query = supabase
    .from("resumes")
    .select(RESUME_METADATA_SELECT)
    .eq("status", "published")
    .is("deleted_at", null);

  if (resumeIds && resumeIds.length > 0) {
    return query.in("id", resumeIds);
  }

  return query;
}

function rankHybridCandidates(
  vectorRows: VectorCandidate[],
  metadataRows: ResumeMetadata[],
  query: string
): RankedCandidate[] {
  const normalizedQuery = normalizeText(query);
  const tokens = extractQueryTokens(query);
  const metadataById = new Map(metadataRows.map((resume) => [resume.id, resume]));
  const vectorById = new Map(
    vectorRows.map((row) => [row.resume_id, Math.max(0, row.similarity)])
  );
  const candidateIds = new Set<string>(vectorById.keys());

  for (const resume of metadataRows) {
    const metadataScore = scoreResumeMetadata(resume, normalizedQuery, tokens);
    if (
      metadataScore.eligibleMetadataOnly &&
      metadataScore.metadataOnlyScore >= METADATA_MIN_SCORE
    ) {
      candidateIds.add(resume.id);
    }
  }

  return Array.from(candidateIds)
    .map((resumeId) => {
      const metadata = metadataById.get(resumeId);
      const metadataScore = metadata
        ? scoreResumeMetadata(metadata, normalizedQuery, tokens)
        : null;
      const vectorScore = vectorById.get(resumeId) ?? 0;
      const hasVector = vectorById.has(resumeId);
      const hybridScore = hasVector
        ? vectorScore + (metadataScore?.score ?? 0) * VECTOR_METADATA_BOOST
        : metadataScore?.metadataOnlyScore ?? 0;

      return {
        resumeId,
        similarity: Math.min(hybridScore, 0.99),
      };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, RESULT_LIMIT);
}

// Revalida los IDs que devuelve Meilisearch contra Supabase (published + no
// deleted), preservando el orden de Meilisearch y deduplicando. La similarity
// se asigna decreciente según el rango para que el cliente conserve el orden.
// Lanza si la revalidación falla, para que el caller caiga a Postgres.
async function revalidateMeilisearchIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  ids: string[]
): Promise<RankedCandidate[]> {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  }
  if (ordered.length === 0) return [];

  const { data, error } = await fetchPublishedResumeMetadata(supabase, ordered);
  if (error) {
    throw new Error(getErrorMessage(error));
  }

  const allowed = new Set(
    ((data ?? []) as ResumeMetadata[]).map((resume) => resume.id)
  );
  const filtered = ordered.filter((id) => allowed.has(id));
  const total = filtered.length;

  return filtered.map((resumeId, rank) => ({
    resumeId,
    similarity: total > 0 ? (total - rank) / total : 0,
  }));
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkBrowseRateLimit(ip)) {
    return NextResponse.json(
      { error: "Demasiadas búsquedas. Esperá un momento." },
      { status: 429 }
    );
  }

  let body: { query?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const query = (body.query ?? "").trim();
  if (!query) {
    return NextResponse.json(
      { error: "El campo query es requerido" },
      { status: 400 }
    );
  }
  if (query.length > 200) {
    return NextResponse.json(
      { error: "La búsqueda es demasiado larga." },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Camino Meilisearch (solo si el feature flag está en true y hay env vars).
  // Devuelve IDs ordenados; revalidamos contra Supabase antes de responder.
  // Si Meilisearch falla, caemos al camino Postgres actual.
  if (isMeilisearchBrowseEnabled()) {
    try {
      const ids = await searchResumeIdsInMeilisearch(query, RESULT_LIMIT);
      const results = await revalidateMeilisearchIds(supabase, ids);
      return NextResponse.json({ query, results, source: "meilisearch" });
    } catch (err) {
      console.warn(
        "[ai:browse] meilisearch failed; falling back to Postgres",
        { message: getErrorMessage(err) }
      );
    }
  }

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

  const hybrid = await searchHybridBrowseCandidates(supabase, query, queryEmbedding);
  if (!hybrid.error) {
    if (hybrid.data.length === 0) {
      return NextResponse.json({ query, results: [] });
    }

    const resumeIds = hybrid.data.map((row) => row.resume_id);
    const { data: resumesMeta, error: metadataError } =
      await fetchPublishedResumeMetadata(supabase, resumeIds);
    if (metadataError) {
      console.warn(
        "[ai:browse] hybrid resume revalidation failed; falling back to M1",
        { message: getErrorMessage(metadataError) }
      );
    } else {
      const allowedResumeIds = new Set(
        ((resumesMeta ?? []) as ResumeMetadata[]).map((resume) => resume.id)
      );

      const results = hybrid.data
        .filter((row) => allowedResumeIds.has(row.resume_id))
        .map((row) => ({
          resumeId: row.resume_id,
          similarity: Math.min(Number(row.score ?? 0), 0.99),
        }))
        .slice(0, RESULT_LIMIT);

      return NextResponse.json({ query, results });
    }
  }

  const { data, error } = await searchVectorCandidates(supabase, queryEmbedding);

  if (error) {
    return NextResponse.json(
      { error: "Error en la búsqueda", detail: error.message },
      { status: 500 }
    );
  }

  const { data: resumesMeta, error: metadataError } =
    await fetchPublishedResumeMetadata(supabase);

  const results = metadataError
    ? data.map((row) => ({ resumeId: row.resume_id, similarity: row.similarity }))
    : rankHybridCandidates(data, (resumesMeta ?? []) as ResumeMetadata[], query);

  return NextResponse.json({ query, results });
}
