import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateQueryEmbedding } from "@/lib/ai/embeddings";
import { answerFromContext } from "@/lib/ai/llm";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { isExtractionAttempt } from "@/lib/ai/extraction-guard";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  let body: { query?: string; resumeIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const query = (body.query ?? "").trim();
  if (!query) {
    return NextResponse.json({ error: "El campo query es requerido" }, { status: 400 });
  }

  if (query.length > 500) {
    return NextResponse.json({ error: "La pregunta es demasiado larga." }, { status: 400 });
  }

  if (isExtractionAttempt(query)) {
    return NextResponse.json(
      { error: "Solo puedo responder preguntas específicas sobre el contenido." },
      { status: 400 }
    );
  }

  if (body.resumeIds && body.resumeIds.length > 10) {
    return NextResponse.json({ error: "Demasiados apuntes seleccionados." }, { status: 400 });
  }

  const resumeIds = body.resumeIds && body.resumeIds.length > 0 ? body.resumeIds : null;

  // 1. Generar embedding de la pregunta
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

  // 2. Recuperar chunks relevantes de los apuntes comprados
  const { data: chunks, error: searchError } = await supabase.rpc(
    "search_chunks_for_study",
    {
      query_embedding: JSON.stringify(queryEmbedding),
      match_count: 5,
      min_similarity: 0.5,
      resume_ids: resumeIds,
    }
  );

  if (searchError) {
    return NextResponse.json(
      { error: "Error en la búsqueda", detail: searchError.message },
      { status: 500 }
    );
  }

  if (!chunks || chunks.length === 0) {
    return NextResponse.json({
      query,
      answer: "No encontré información relevante en tus apuntes para responder esa pregunta.",
      sources: [],
    });
  }

  // 3. Generar respuesta con el LLM
  let answer: string;
  try {
    answer = await answerFromContext(query, chunks);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Error generando respuesta", detail: message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    query,
    answer,
    sources: chunks.map((c: { resume_id: string; chunk_index: number; similarity: number }) => ({
      resumeId: c.resume_id,
      chunkIndex: c.chunk_index,
      similarity: c.similarity,
    })),
  });
}
