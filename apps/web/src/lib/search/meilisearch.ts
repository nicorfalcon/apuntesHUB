// Helper server-side para Meilisearch (PoC de búsqueda pública / browse).
//
// ALCANCE: Meilisearch SOLO complementa la búsqueda pública de apuntes en
// Explorar. NO reemplaza el chat, el RAG, pgvector, la búsqueda autorizada de
// chunks comprados ni las RPCs de estudio.
//
// SEGURIDAD:
//   - Este módulo es server-only. Nunca debe importarse en cliente/browser.
//   - La API key de Meilisearch jamás se expone al frontend.
//   - El índice NO es fuente de permisos: el endpoint de browse SIEMPRE revalida
//     los IDs contra Supabase (status=published, deleted_at IS NULL).
//   - No se indexa contenido completo de chunks: solo `chunkTerms` (señal).
//   - Logs seguros: nunca contenido, chunks, embeddings ni API keys.

import { Meilisearch, type Index } from "meilisearch";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  deriveChunkTerms,
  deriveAcademicAliases,
  normalizeSectionTitles,
} from "./chunk-terms";
import { normalizeResumeTopics } from "@/lib/resumes/topics";

export type SearchableResumeDocument = {
  id: string;
  title: string;
  description: string | null;
  subject: string | null;
  career: string | null;
  university: string | null;
  sellerId: string | null;
  status: "published";
  fileName: string | null;
  // topics = "Temas del apunte" declarados por el vendedor. Senal de busqueda de
  // alta prioridad: resuelven el caso en que el PDF no nombra el concepto.
  topics: string[];
  // sectionTitles = títulos de sección (el "índice"/TOC del apunte) derivados por
  // el chunker. Señal de búsqueda: equivalen a los temas del índice, aunque el
  // vendedor no los haya declarado como topics. NO es contenido del PDF.
  sectionTitles: string[];
  tags: string[];
  keywords: string[];
  aiSummary: string | null;
  chunkTerms: string[];
  createdAt: string;
  updatedAt: string | null;
};

// Fila mínima de `resumes` necesaria para construir el documento indexable.
type ResumeRow = {
  id: string;
  title: string | null;
  description: string | null;
  subject: string | null;
  career: string | null;
  university: string | null;
  seller_id: string | null;
  file_url: string | null;
  status: string | null;
  deleted_at: string | null;
  topics: string[] | null;
  created_at: string | null;
  updated_at: string | null;
};

const RESUME_INDEX_SELECT =
  "id, title, description, subject, career, university, seller_id, file_url, status, deleted_at, topics, created_at, updated_at";

// Tope de chunks por apunte a leer para derivar términos. Acota el trabajo y la
// memoria; no afecta la seguridad (igual nunca se guarda el contenido).
const MAX_CHUNKS_FOR_TERMS = 600;

// Tamaño de lote para reindexado masivo.
const REINDEX_BATCH_SIZE = 100;

const DEFAULT_RESUMES_INDEX = "resumes";

// Timeout por request HTTP a Meilisearch. Acota la latencia: si el server está
// lento/caído, la llamada lanza y el browse cae a Postgres en vez de colgarse;
// también evita que el hook best-effort de ingesta demore la respuesta.
const MEILISEARCH_REQUEST_TIMEOUT_MS = 5_000;

// ---------------------------------------------------------------------------
// Configuración / feature flag
// ---------------------------------------------------------------------------

/** Hay host + api key configurados (mínimo para hablar con Meilisearch). */
export function isMeilisearchConfigured(): boolean {
  return Boolean(
    process.env.MEILISEARCH_HOST && process.env.MEILISEARCH_API_KEY
  );
}

/**
 * La búsqueda pública debe usar Meilisearch: requiere el feature flag en "true"
 * Y las env vars presentes. Si falta cualquiera, el browse usa Postgres.
 */
export function isMeilisearchBrowseEnabled(): boolean {
  return (
    process.env.ENABLE_MEILISEARCH_BROWSE === "true" && isMeilisearchConfigured()
  );
}

export function getResumesIndexName(): string {
  return process.env.MEILISEARCH_RESUMES_INDEX || DEFAULT_RESUMES_INDEX;
}

let cachedClient: Meilisearch | null = null;

/** Cliente Meilisearch (singleton). Devuelve null si no está configurado. */
export function getMeilisearchClient(): Meilisearch | null {
  if (!isMeilisearchConfigured()) return null;
  if (!cachedClient) {
    cachedClient = new Meilisearch({
      host: process.env.MEILISEARCH_HOST as string,
      apiKey: process.env.MEILISEARCH_API_KEY as string,
      timeout: MEILISEARCH_REQUEST_TIMEOUT_MS,
    });
  }
  return cachedClient;
}

function getResumesIndex(): Index | null {
  const client = getMeilisearchClient();
  if (!client) return null;
  return client.index(getResumesIndexName());
}

// ---------------------------------------------------------------------------
// Índice
// ---------------------------------------------------------------------------

/**
 * Configura el índice de resumes: primary key, atributos buscables/filtrables/
 * ordenables, ranking rules priorizando tolerancia a typos, y typo tolerance.
 * Idempotente: se puede llamar múltiples veces.
 */
export async function configureResumesIndex(): Promise<void> {
  const client = getMeilisearchClient();
  if (!client) return;

  const indexName = getResumesIndexName();
  // Crea el índice con primary key si no existe (no falla si ya existe).
  try {
    await client.createIndex(indexName, { primaryKey: "id" });
  } catch {
    // El índice ya existe: continuamos a actualizar settings.
  }

  const index = client.index(indexName);
  await index.updateSettings({
    // El orden define la prioridad de la regla "attribute": cuanto antes, mas
    // peso. `topics` (declarados por el vendedor) va alto, justo despues de
    // title y por encima de keywords/chunkTerms, que son senales derivadas.
    searchableAttributes: [
      "title",
      "topics",
      // El índice/TOC del apunte va alto: son los temas reales del material,
      // por encima de señales más ruidosas (keywords/chunkTerms).
      "sectionTitles",
      "subject",
      "description",
      "career",
      "university",
      "fileName",
      "tags",
      "keywords",
      "aiSummary",
      "chunkTerms",
    ],
    filterableAttributes: [
      "status",
      "subject",
      "career",
      "university",
      "sellerId",
    ],
    sortableAttributes: ["createdAt", "updatedAt"],
    // Orden de reglas: words → typo → proximity → attribute → exactness → sort.
    // Mantiene la tolerancia a typos alta sin sacrificar relevancia textual.
    rankingRules: [
      "words",
      "typo",
      "proximity",
      "attribute",
      "exactness",
      "sort",
    ],
    // Typo tolerance activada y un poco más permisiva que el default (5/9),
    // para tolerar errores como "le chatlier".
    typoTolerance: {
      enabled: true,
      minWordSizeForTypos: { oneTypo: 4, twoTypos: 8 },
    },
  });
}

// ---------------------------------------------------------------------------
// Construcción del documento indexable
// ---------------------------------------------------------------------------

function fileNameFromPath(path: string | null): string | null {
  if (!path) return null;
  const fileName = path.split("/").pop() ?? "";
  if (!fileName) return null;
  try {
    return decodeURIComponent(fileName);
  } catch {
    return fileName;
  }
}

/** Señales de búsqueda derivadas de los chunks de un apunte. */
type ChunkSearchSignals = {
  chunkTerms: string[];
  sectionTitles: string[];
};

/**
 * Lee hasta {@link MAX_CHUNKS_FOR_TERMS} chunks del apunte y deriva las señales
 * de búsqueda: términos (chunkTerms) y los títulos de sección (el índice/TOC).
 * NUNCA persiste el contenido: solo devuelve listas acotadas de señales.
 * Ante cualquier error devuelve listas vacías para no romper la indexación.
 */
async function deriveChunkSignalsForResume(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  resumeId: string
): Promise<ChunkSearchSignals> {
  try {
    const { data, error } = await admin
      .from("document_chunks")
      .select("content, section_title")
      .eq("resume_id", resumeId)
      .order("chunk_index", { ascending: true })
      .limit(MAX_CHUNKS_FOR_TERMS);
    if (error || !data) return { chunkTerms: [], sectionTitles: [] };
    const rows = data as Array<{
      content: string | null;
      section_title: string | null;
    }>;
    return {
      chunkTerms: deriveChunkTerms(rows.map((row) => row.content)),
      sectionTitles: normalizeSectionTitles(rows.map((row) => row.section_title)),
    };
  } catch {
    return { chunkTerms: [], sectionTitles: [] };
  }
}

function buildResumeDocument(
  resume: ResumeRow,
  signals: ChunkSearchSignals
): SearchableResumeDocument {
  const { chunkTerms, sectionTitles } = signals;
  return {
    id: resume.id,
    title: resume.title ?? "",
    description: resume.description,
    subject: resume.subject,
    career: resume.career,
    university: resume.university,
    sellerId: resume.seller_id,
    status: "published",
    fileName: fileNameFromPath(resume.file_url),
    // Temas declarados por el vendedor. Se re-normalizan al indexar (defensa en
    // profundidad: hoy se guardan ya normalizados desde el form, pero el guardado
    // es client-side; ver deuda en resume-form.tsx).
    topics: normalizeResumeTopics(resume.topics ?? []),
    // Títulos de sección (índice/TOC) derivados de los chunks. Ya vienen
    // normalizados y deduplicados desde deriveChunkSignalsForResume.
    sectionTitles,
    // No existe esta columna en la BD todavía: PoC con valores vacíos.
    tags: [],
    // keywords = aliases académicos curados por reglas a partir de señales del
    // contenido (NO contenido del PDF). Permiten encontrar temas con nombre
    // propio (p. ej. "le chatelier") aunque el texto extraído no los contenga.
    keywords: deriveAcademicAliases({
      title: resume.title,
      subject: resume.subject,
      description: resume.description,
      chunkTerms,
    }),
    aiSummary: null,
    chunkTerms,
    createdAt: resume.created_at ?? new Date().toISOString(),
    updatedAt: resume.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Sincronización del índice
// ---------------------------------------------------------------------------

/**
 * Indexa un apunte puntual. Revalida SIEMPRE contra Supabase que esté
 * published y no eliminado. Si no lo está, lo remueve del índice.
 * No-op (sin error) si Meilisearch no está configurado.
 */
export async function indexResumeInSearch(
  resumeId: string
): Promise<{ status: "indexed" | "removed" | "skipped" }> {
  const index = getResumesIndex();
  if (!index) return { status: "skipped" };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("resumes")
    .select(RESUME_INDEX_SELECT)
    .eq("id", resumeId)
    .maybeSingle();

  const resume = (data ?? null) as ResumeRow | null;

  // Si no existe, no está publicado o está eliminado → fuera del índice.
  if (error || !resume || resume.status !== "published" || resume.deleted_at) {
    await removeResumeFromSearch(resumeId);
    return { status: "removed" };
  }

  const signals = await deriveChunkSignalsForResume(admin, resumeId);
  const document = buildResumeDocument(resume, signals);
  await index.addDocuments([document], { primaryKey: "id" });
  return { status: "indexed" };
}

/**
 * Remueve un apunte del índice por ID. No-op si no está configurado.
 */
export async function removeResumeFromSearch(resumeId: string): Promise<void> {
  const index = getResumesIndex();
  if (!index) return;
  await index.deleteDocument(resumeId);
}

/**
 * Reindexa TODOS los apuntes publicados y no eliminados, por lotes.
 * Configura el índice primero. No loguea contenido sensible.
 * Devuelve un resumen con conteos (seguro de loguear).
 */
export async function reindexPublishedResumes(): Promise<{
  configured: boolean;
  total: number;
  indexed: number;
  batches: number;
}> {
  if (!isMeilisearchConfigured()) {
    return { configured: false, total: 0, indexed: 0, batches: 0 };
  }

  await configureResumesIndex();
  const index = getResumesIndex();
  if (!index) return { configured: false, total: 0, indexed: 0, batches: 0 };

  const admin = createAdminClient();
  let total = 0;
  let indexed = 0;
  let batches = 0;
  let offset = 0;

  // Paginamos los apuntes publicados; para cada lote derivamos términos y
  // subimos los documentos juntos.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await admin
      .from("resumes")
      .select(RESUME_INDEX_SELECT)
      .eq("status", "published")
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .range(offset, offset + REINDEX_BATCH_SIZE - 1);

    if (error) throw new Error(`reindex query failed: ${error.message}`);

    const rows = (data ?? []) as ResumeRow[];
    if (rows.length === 0) break;
    total += rows.length;

    const documents: SearchableResumeDocument[] = [];
    for (const row of rows) {
      const signals = await deriveChunkSignalsForResume(admin, row.id);
      documents.push(buildResumeDocument(row, signals));
    }

    await index.addDocuments(documents, { primaryKey: "id" });
    indexed += documents.length;
    batches += 1;

    if (rows.length < REINDEX_BATCH_SIZE) break;
    offset += REINDEX_BATCH_SIZE;
  }

  return { configured: true, total, indexed, batches };
}

// ---------------------------------------------------------------------------
// Búsqueda (browse)
// ---------------------------------------------------------------------------

/**
 * Busca en Meilisearch y devuelve SOLO IDs ordenados por relevancia.
 * No devuelve ningún campo sensible (solo recupera `id`).
 * El llamador DEBE revalidar estos IDs contra Supabase antes de exponerlos.
 *
 * No filtramos por `status` en la query a propósito: el índice solo debería
 * contener apuntes published (indexResumeInSearch remueve los demás) y la
 * frontera real de seguridad es la revalidación en Supabase (status=published,
 * deleted_at IS NULL, RLS). Evitar el filtro impide que un índice autocreado sin
 * settings (sin `status` filterable) haga fallar la búsqueda y degrade siempre a
 * Postgres. `status` se mantiene en el documento y en la config del índice.
 */
export async function searchResumeIdsInMeilisearch(
  query: string,
  limit: number
): Promise<string[]> {
  const index = getResumesIndex();
  if (!index) return [];

  const result = await index.search(query, {
    limit,
    // Nunca traemos campos sensibles: únicamente el id para ordenar.
    attributesToRetrieve: ["id"],
  });

  return (result.hits as Array<{ id?: string }>)
    .map((hit) => hit.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}
