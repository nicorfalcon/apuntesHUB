import { CohereClient } from "cohere-ai";
import { classifyAiIngestionError } from "./ingestion-errors";

export const EMBEDDING_MODEL = "embed-multilingual-v3.0";
export const EMBEDDING_DIM = 1024;

// El modelo tiene una ventana MÁXIMA de 512 tokens. El chunker (pdf-chunker.ts)
// está calibrado (DEFAULT_CHUNK_OPTIONS) para producir chunks de ~400 tokens y
// no excederla. `truncate: "END"` queda como red de seguridad explícita para el
// caso patológico (bloques sin cortes naturales): documenta el comportamiento
// del proveedor, no es la estrategia principal.
const TRUNCATE_MODE = "END" as const;

const BATCH_LIMIT = 96;

// Concurrencia de lotes a Cohere. Default 3 (conservador): las keys trial tienen
// rate limits bajos y disparar muchos lotes de golpe gatilla COHERE_RATE_LIMIT.
// Para trial conviene 2–3; con key de producción se puede subir vía env.
// Configurable por COHERE_EMBED_CONCURRENCY; valores inválidos caen al default,
// nunca baja de 1 y se capea a MAX_EMBEDDING_CONCURRENCY.
const DEFAULT_EMBEDDING_CONCURRENCY = 3;
const MAX_EMBEDDING_CONCURRENCY = 8;

// Retry/backoff para errores temporales del proveedor (rate limit, timeout, red,
// 5xx). Hasta 3 reintentos con backoff exponencial 1s → 2s → 4s + jitter 20–30%.
const MAX_EMBED_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
  max: number
): number {
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return Math.min(n, max);
}

// Se lee en cada llamada (no a nivel módulo) para que sea testeable con stubEnv.
function getEmbeddingConcurrency(): number {
  return parsePositiveInt(
    process.env.COHERE_EMBED_CONCURRENCY,
    DEFAULT_EMBEDDING_CONCURRENCY,
    MAX_EMBEDDING_CONCURRENCY
  );
}

// Quita diacríticos antes de vectorizar para que "Le Chatelier" y "Le Châtelier"
// produzcan embeddings compatibles. El contenido original se guarda sin tocar en la DB.
function normalizeForEmbedding(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function getClient(): CohereClient {
  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey) throw new Error("COHERE_API_KEY no está configurada");
  return new CohereClient({ token: apiKey });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Lee el header Retry-After del error del proveedor (segundos -> ms) si existe,
// tolerando distintas formas (Headers, objeto plano, campo retryAfter).
function readRetryAfterMs(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const e = error as Record<string, any>;
  const headers = e.headers ?? e.rawResponse?.headers ?? e.response?.headers;
  let raw: unknown;
  if (headers) {
    raw =
      typeof headers.get === "function"
        ? headers.get("retry-after")
        : (headers["retry-after"] ?? headers["Retry-After"]);
  }
  if (raw == null) raw = e.retryAfter ?? e.retry_after;
  if (raw == null) return undefined;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds < 0) return undefined;
  return seconds * 1000;
}

// Backoff exponencial (1s, 2s, 4s) + jitter 20–30%. Si el proveedor expone un
// Retry-After mayor al backoff calculado, lo respetamos.
function computeBackoffMs(attempt: number, error: unknown): number {
  const base = RETRY_BASE_DELAY_MS * 2 ** attempt;
  const jitter = base * (0.2 + Math.random() * 0.1);
  const backoff = base + jitter;
  const retryAfter = readRetryAfterMs(error);
  return retryAfter !== undefined ? Math.max(backoff, retryAfter) : backoff;
}

// Una llamada a Cohere con retry/backoff acotado a errores retryable. Reintenta
// solo lo transitorio (rate limit, timeout, red, 5xx) según classifyAiIngestionError;
// auth/quota/validación se propagan de inmediato. No loguea textos ni embeddings.
async function embedWithRetry(
  client: CohereClient,
  texts: string[],
  inputType: "search_document" | "search_query"
): Promise<number[][]> {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await client.embed({
        model: EMBEDDING_MODEL,
        texts: texts.map(normalizeForEmbedding),
        inputType,
        truncate: TRUNCATE_MODE,
      });

      const embeddings = response.embeddings as number[][];
      // Respuesta vacía/ malformada: contrato roto, no es transitorio -> no se
      // reintenta (mensaje sin palabras que lo clasifiquen como retryable).
      if (!embeddings?.length) {
        throw new Error("El proveedor no devolvió embeddings válidos");
      }
      return embeddings;
    } catch (error) {
      const { retryable, code } = classifyAiIngestionError(error);
      if (!retryable || attempt >= MAX_EMBED_RETRIES) {
        throw error;
      }
      const delay = computeBackoffMs(attempt, error);
      // Log mínimo y seguro: sin textos/chunks/embeddings.
      console.warn("[ai:embeddings] retry", {
        attempt: attempt + 1,
        code,
        retryDelayMs: Math.round(delay),
        batchSize: texts.length,
      });
      await sleep(delay);
    }
  }
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const client = getClient();
  const concurrency = getEmbeddingConcurrency();

  const allEmbeddings: number[][] = new Array(texts.length);

  // Defensa: no mandamos textos vacíos a Cohere (gastarían un slot del lote y el
  // chunker ya garantiza contenido). Esas posiciones se rellenan con un vector
  // cero para mantener la alineación 1:1 con el array de entrada.
  const nonEmpty: { text: string; index: number }[] = [];
  for (let i = 0; i < texts.length; i++) {
    if (texts[i].trim().length === 0) {
      allEmbeddings[i] = new Array(EMBEDDING_DIM).fill(0);
    } else {
      nonEmpty.push({ text: texts[i], index: i });
    }
  }

  // Particionar en lotes de hasta BATCH_LIMIT, conservando el índice original de
  // cada texto para reensamblar en orden (los lotes terminan fuera de orden).
  const batches: { items: { text: string; index: number }[] }[] = [];
  for (let i = 0; i < nonEmpty.length; i += BATCH_LIMIT) {
    batches.push({ items: nonEmpty.slice(i, i + BATCH_LIMIT) });
  }

  // Pool de workers: cada uno toma el siguiente lote pendiente hasta agotarlos.
  // Acota la concurrencia sin dependencias externas. `next++` es atómico (no hay
  // await entre lectura y escritura), así que dos workers nunca toman el mismo lote.
  let next = 0;
  async function worker(): Promise<void> {
    while (next < batches.length) {
      const { items } = batches[next++];
      const embeddings = await embedWithRetry(
        client,
        items.map((it) => it.text),
        "search_document"
      );

      // Cada embedding vuelve a SU índice original: orden preservado, sin duplicar.
      for (let j = 0; j < items.length; j++) {
        allEmbeddings[items[j].index] = embeddings[j];
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, batches.length) }, worker)
  );

  return allEmbeddings;
}

export async function generateQueryEmbedding(text: string): Promise<number[]> {
  const client = getClient();
  const embeddings = await embedWithRetry(client, [text], "search_query");
  return embeddings[0];
}
