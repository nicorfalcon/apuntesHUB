const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents";

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY no está configurada");

  // Gemini acepta hasta 100 textos por request, procesamos en batches
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += 100) {
    batches.push(texts.slice(i, i + 100));
  }

  const allEmbeddings: number[][] = [];

  for (const batch of batches) {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: batch.map((text) => ({
          model: "models/text-embedding-004",
          content: { parts: [{ text }] },
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error de Gemini API: ${error}`);
    }

    const data = await response.json();
    const embeddings = data.embeddings.map(
      (e: { values: number[] }) => e.values
    );
    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}