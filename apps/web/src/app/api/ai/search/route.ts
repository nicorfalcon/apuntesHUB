import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateQueryEmbedding } from "@/lib/ai/embeddings";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
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

  const resumeIds = body.resumeIds && body.resumeIds.length > 0 ? body.resumeIds : null;

  // 1. Generar embedding de la query
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

  // 2. Búsqueda semántica sobre apuntes comprados
  // search_chunks_for_study filtra internamente por purchases.status = 'completed'
  const { data, error } = await supabase.rpc("search_chunks_for_study", {
    query_embedding: JSON.stringify(queryEmbedding),
    match_count: 5,
    min_similarity: 0.3,
    resume_ids: resumeIds,
  });

  if (error) {
    return NextResponse.json(
      { error: "Error en la búsqueda", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ query, results: data ?? [] });
}
