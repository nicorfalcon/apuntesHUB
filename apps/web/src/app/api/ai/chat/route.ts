import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateQueryEmbedding } from "@/lib/ai/embeddings";
import { answerFromContext } from "@/lib/ai/llm";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { isExtractionAttempt } from "@/lib/ai/extraction-guard";
import { decryptApiKey } from "@/lib/crypto/api-key-encryption";
import { searchWeb } from "@/lib/search/web-search";
import { buildEnrichedPrompt, parseSourcesFromResponse } from "@/lib/ai/prompt-builder";
import { callUserModel } from "@/lib/ai/model-router";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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

  let body: { query?: string; resumeIds?: string[]; apiKeyId?: string };
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
  const apiKeyId = body.apiKeyId;

  // 1. Generar embedding de la pregunta (siempre, para ambas rutas)
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
      min_similarity: 0.35,
      resume_ids: resumeIds,
    }
  );

  if (searchError) {
    return NextResponse.json(
      { error: "Error en la búsqueda", detail: searchError.message },
      { status: 500 }
    );
  }

  // --- MODELO PLATAFORMA (comportamiento original) ---
  if (!apiKeyId || apiKeyId === "platform") {
    if (!chunks || chunks.length === 0) {
      return NextResponse.json({
        query,
        answer: "No encontré información relevante en tus apuntes para responder esa pregunta.",
        sources: [],
        model: "platform",
      });
    }

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
      sources: [{ type: "note", label: "Tu apunte" }],
      model: "platform",
      rawSources: chunks.map((c: { resume_id: string; chunk_index: number; similarity: number }) => ({
        resumeId: c.resume_id,
        chunkIndex: c.chunk_index,
        similarity: c.similarity,
      })),
    });
  }

  // --- MODELO PROPIO DEL USUARIO ---
  const admin = createAdminClient();
  const { data: userKey } = await admin
    .from("user_api_keys")
    .select("id, provider, model_id, key_encrypted, key_iv")
    .eq("id", apiKeyId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (!userKey) {
    return NextResponse.json({ error: "API key no encontrada" }, { status: 404 });
  }

  let plainApiKey: string;
  try {
    plainApiKey = decryptApiKey(userKey.key_encrypted, userKey.key_iv);
  } catch {
    return NextResponse.json({ error: "Error al procesar la API key" }, { status: 500 });
  }

  // Construir contexto del apunte a partir de los chunks encontrados
  const noteContext = chunks && chunks.length > 0
    ? chunks.map((c: { content: string }, i: number) => `[Fragmento ${i + 1}]\n${c.content}`).join("\n\n")
    : "No se encontró contenido relevante en el apunte para esta pregunta.";

  // Buscar en internet en paralelo
  const webResults = await searchWeb(query);

  // Construir prompt enriquecido
  const prompt = buildEnrichedPrompt(query, noteContext, webResults);

  let rawText: string;
  try {
    const response = await callUserModel({
      provider: userKey.provider,
      modelId: userKey.model_id,
      apiKey: plainApiKey,
      prompt,
    });
    rawText = response.text;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("timeout") || message.includes("AbortError")) {
      return NextResponse.json(
        { error: "El modelo tardó demasiado en responder. Intentá de nuevo." },
        { status: 504 }
      );
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const { cleanText, sources } = parseSourcesFromResponse(rawText);

  return NextResponse.json({
    query,
    answer: cleanText,
    sources,
    model: userKey.provider,
    modelId: userKey.model_id,
  });
}
