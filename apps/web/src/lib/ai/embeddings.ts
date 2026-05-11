import { CohereClient } from "cohere-ai";

export const EMBEDDING_MODEL = "embed-multilingual-v3.0";
export const EMBEDDING_DIM = 1024;

const BATCH_LIMIT = 96;

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
      texts: batch,
      inputType: "search_document",
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
    texts: [text],
    inputType: "search_query",
  });

  const embeddings = response.embeddings as number[][];
  if (!embeddings?.length) {
    throw new Error("Cohere no devolvió embeddings válidos");
  }

  return embeddings[0];
}
