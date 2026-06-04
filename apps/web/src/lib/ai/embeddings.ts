import { CohereClient } from "cohere-ai";

export const EMBEDDING_MODEL = "embed-multilingual-v3.0";
export const EMBEDDING_DIM = 1024;

// El modelo tiene una ventana MÁXIMA de 512 tokens. El chunker (pdf-chunker.ts)
// está calibrado (DEFAULT_CHUNK_OPTIONS) para producir chunks de ~400 tokens y
// no excederla. `truncate: "END"` queda como red de seguridad explícita para el
// caso patológico (bloques sin cortes naturales): documenta el comportamiento
// del proveedor, no es la estrategia principal.
const TRUNCATE_MODE = "END" as const;

const BATCH_LIMIT = 96;

// Cantidad de lotes que se piden a Cohere en paralelo. Acotado a propósito: las
// keys trial tienen rate limits bajos y disparar todos los lotes de golpe gatilla
// COHERE_RATE_LIMIT. 4 da buen speedup sin pasarse. Si aun así pega el límite, el
// route lo clasifica (classifyAiIngestionError) y queda visible.
const EMBEDDING_CONCURRENCY = 4;

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

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const client = getClient();

  // Particionar en lotes de hasta BATCH_LIMIT, guardando el índice de inicio
  // para reensamblar en el orden original (los lotes terminan fuera de orden).
  const batches: { start: number; texts: string[] }[] = [];
  for (let i = 0; i < texts.length; i += BATCH_LIMIT) {
    batches.push({ start: i, texts: texts.slice(i, i + BATCH_LIMIT) });
  }

  const allEmbeddings: number[][] = new Array(texts.length);

  // Pool de workers: cada uno toma el siguiente lote pendiente hasta agotarlos.
  // Acota la concurrencia a EMBEDDING_CONCURRENCY sin dependencias externas.
  // `next++` es atómico (no hay await entre lectura y escritura), así que dos
  // workers nunca toman el mismo lote.
  let next = 0;
  async function worker(): Promise<void> {
    while (next < batches.length) {
      const { start, texts: batchTexts } = batches[next++];
      const response = await client.embed({
        model: EMBEDDING_MODEL,
        texts: batchTexts.map(normalizeForEmbedding),
        inputType: "search_document",
        truncate: TRUNCATE_MODE,
      });

      const embeddings = response.embeddings as number[][];
      if (!embeddings?.length) {
        throw new Error("Cohere no devolvió embeddings válidos");
      }

      for (let j = 0; j < embeddings.length; j++) {
        allEmbeddings[start + j] = embeddings[j];
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(EMBEDDING_CONCURRENCY, batches.length) },
      worker
    )
  );

  return allEmbeddings;
}

export async function generateQueryEmbedding(text: string): Promise<number[]> {
  const client = getClient();
  const response = await client.embed({
    model: EMBEDDING_MODEL,
    texts: [normalizeForEmbedding(text)],
    inputType: "search_query",
    truncate: TRUNCATE_MODE,
  });

  const embeddings = response.embeddings as number[][];
  if (!embeddings?.length) {
    throw new Error("Cohere no devolvió embeddings válidos");
  }

  return embeddings[0];
}
