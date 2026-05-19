// Opción C: search_chunks_browse — busca en document_chunks de apuntes publicados.
// Ver PLANBUSCADOR.md para el SQL de la función que hay que aplicar en Supabase.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateQueryEmbedding } from "@/lib/ai/embeddings";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 15;
const RATE_WINDOW = 60_000;

function checkBrowseRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkBrowseRateLimit(ip)) {
    return NextResponse.json(
      { error: "Demasiadas búsquedas. Esperá un momento." },
      { status: 429 }
    );
  }

  let body: { query?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const query = (body.query ?? "").trim();
  if (!query) {
    return NextResponse.json(
      { error: "El campo query es requerido" },
      { status: 400 }
    );
  }
  if (query.length > 200) {
    return NextResponse.json(
      { error: "La búsqueda es demasiado larga." },
      { status: 400 }
    );
  }

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

  const supabase = await createClient();

  // search_chunks_browse no está tipada en database.types.ts aún
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("search_chunks_browse", {
    query_embedding: JSON.stringify(queryEmbedding),
    match_count: 20,
    min_similarity: 0.50,
  });

  if (error) {
    return NextResponse.json(
      { error: "Error en la búsqueda", detail: error.message },
      { status: 500 }
    );
  }

  const results: Array<{ resumeId: string; similarity: number }> =
    ((data as { resume_id: string; similarity: number }[]) ?? []).map((row) => ({
      resumeId: row.resume_id,
      similarity: row.similarity,
    }));

  return NextResponse.json({ query, results });
}
