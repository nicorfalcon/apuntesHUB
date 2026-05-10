import Groq from "groq-sdk";

const CHAT_MODEL = "llama-3.1-8b-instant";

function getClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY no está configurada");
  return new Groq({ apiKey });
}

export interface ChunkContext {
  content: string;
  chunkIndex: number;
  resumeId: string;
}

export async function answerFromContext(
  question: string,
  chunks: ChunkContext[]
): Promise<string> {
  const client = getClient();

  const context = chunks
    .map((c, i) => `[Fragmento ${i + 1}]\n${c.content}`)
    .join("\n\n");

  const response = await client.chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      {
        role: "system",
        content: `Sos un asistente de estudio. Tu único trabajo es responder preguntas basándote en los fragmentos de apuntes que se te proporcionan.

Reglas:
- Respondé solo con información que esté en los fragmentos.
- No reproduzcas los fragmentos textualmente; parafraseá y sintetizá.
- Si la respuesta no está en los fragmentos, decí claramente que no encontraste esa información en los apuntes.
- Respondé en español, de forma clara y concisa.
- No inventes información ni uses conocimiento externo.`,
      },
      {
        role: "user",
        content: `Fragmentos de los apuntes:\n\n${context}\n\nPregunta: ${question}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 800,
  });

  return response.choices[0]?.message?.content ?? "No se pudo generar una respuesta.";
}
