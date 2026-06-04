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
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_LIMIT) {
    const batch = texts.slice(i, i + BATCH_LIMIT);
    const response = await client.embed({
      model: EMBEDDING_MODEL,
      texts: batch.map(normalizeForEmbedding),
      inputType: "search_document",
      truncate: TRUNCATE_MODE,
    });

    const embeddings = response.embeddings as number[][];
    if (!embeddings?.length) {
      throw new Error("Cohere no devolvió embeddings válidos");
    }

    for (const vec of embeddings) {
      allEmbeddings.push(vec);
    }
  }

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
