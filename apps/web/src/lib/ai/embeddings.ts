import OpenAI from "openai";

export const EMBEDDING_MODEL = "text-embedding-ada-002";
export const EMBEDDING_DIM = 1536;

// OpenAI acepta hasta 2048 inputs por request, pero limitamos a 100 para no superar el límite de tokens
const BATCH_LIMIT = 100;

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY no está configurada");
  return new OpenAI({ apiKey });
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const client = getClient();
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_LIMIT) {
    const batch = texts.slice(i, i + BATCH_LIMIT);
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });
    // la API devuelve los embeddings en el mismo orden que el input
    const sorted = response.data.sort((a, b) => a.index - b.index);
    for (const item of sorted) {
      allEmbeddings.push(item.embedding);
    }
  }

  return allEmbeddings;
}