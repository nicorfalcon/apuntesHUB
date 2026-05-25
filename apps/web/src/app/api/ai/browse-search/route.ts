// Búsqueda semántica para el catálogo público.
// Estrategia híbrida: embedding similarity + boost por keywords en metadata.
// Si solo hay un resultado semántico fuerte (gap > 0.07 con el segundo), lo devuelve solo.
// Si hay varios, mantiene los que estén dentro de 0.12 del top score (ventana relativa).
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

function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// Extrae tokens significativos de la query (>= 3 caracteres, excluye stopwords comunes).
const STOPWORDS = new Set(["de", "del", "la", "el", "los", "las", "un", "una", "y", "en", "con", "por", "para", "que", "le"]);
function extractQueryTokens(query: string): string[] {
  return normalizeText(query)
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function resumeMatchesTokens(
  resume: { title: string; subject: string; description: string | null },
  tokens: string[]
): boolean {
  if (tokens.length === 0) return true;
  const haystack = normalizeText(
    [resume.title, resume.subject, resume.description ?? ""].join(" ")
  );
  return tokens.some((token) => haystack.includes(token));
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

  // Buscar candidatos con threshold bajo; el filtrado fino se hace abajo.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("search_chunks_browse", {
    query_embedding: JSON.stringify(queryEmbedding),
    match_count: 50,
    min_similarity: 0.38,
  });

  if (error) {
    return NextResponse.json(
      { error: "Error en la búsqueda", detail: error.message },
      { status: 500 }
    );
  }

  const raw: Array<{ resume_id: string; similarity: number }> = data ?? [];

  if (raw.length === 0) {
    return NextResponse.json({ query, results: [] });
  }

  // Ordenar por similitud desc
  raw.sort((a, b) => b.similarity - a.similarity);
  const topScore = raw[0].similarity;

  // Ventana relativa: solo candidatos dentro de 0.12 del top score
  const RELATIVE_WINDOW = 0.12;
  const candidates = raw.filter((r) => topScore - r.similarity <= RELATIVE_WINDOW);

  // Si hay más de un candidato, verificar presencia de tokens en metadata
  let filtered = candidates;
  if (candidates.length > 1) {
    const tokens = extractQueryTokens(query);

    if (tokens.length > 0) {
      // Obtener metadata de los candidatos en paralelo
      const resumeIds = candidates.map((c) => c.resume_id);
      const { data: resumesMeta } = await supabase
        .from("resumes")
        .select("id, title, subject, description")
        .in("id", resumeIds);

      if (resumesMeta && resumesMeta.length > 0) {
        const metaMap = new Map(resumesMeta.map((r) => [r.id, r]));

        // Separar: los que matchean tokens en metadata tienen prioridad
        const withKeyword = candidates.filter((c) => {
          const meta = metaMap.get(c.resume_id);
          return meta ? resumeMatchesTokens(meta, tokens) : false;
        });

        // Si al menos uno matchea por keyword, mostrar solo esos
        if (withKeyword.length > 0) {
          filtered = withKeyword;
        }
        // Si ninguno matchea por keyword (todos son puramente semánticos),
        // devolver solo el top resultado para evitar ruido
        else {
          filtered = [candidates[0]];
        }
      }
    }
  }

  const results = filtered.map((row) => ({
    resumeId: row.resume_id,
    similarity: row.similarity,
  }));

  return NextResponse.json({ query, results });
}
