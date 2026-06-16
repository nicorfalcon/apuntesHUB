import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractPdfPages } from "@/lib/ai/pdf-extractor";
import { chunkPdfPages, CHUNKING_VERSION } from "@/lib/ai/pdf-chunker";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import {
  AiIngestionError,
  classifyAiIngestionError,
} from "@/lib/ai/ingestion-errors";
import { indexResumeInSearch } from "@/lib/search/meilisearch";
import { normalizeSectionTitles } from "@/lib/search/chunk-terms";
import {
  mergeResumeTopics,
  normalizeResumeTopics,
} from "@/lib/resumes/topics";

// 300s: tope actual de Vercel en todos los planes (Fluid Compute). La ingesta
// de PDFs grandes (extracción + embeddings + reingest) corre síncrona dentro de
// esta request, así que necesita el techo alto. En `next dev` no se aplica.
export const maxDuration = 300;

// Límite de tamaño del PDF para procesar con IA. Evita cargar archivos enormes
// en memoria dentro del maxDuration.
const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25 MB

// Ventana del "lock" lógico de ingesta. Si un job quedó en 'processing' hace más
// de esto (request cortada, deploy a mitad, crash), se considera stale y se puede
// reclamar de nuevo. Configurable por env; default 10 min.
function getIngestionLockTtlMinutes(): number {
  const raw = process.env.AI_INGEST_LOCK_TTL_MINUTES;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return 10;
  return n;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ resumeId: string }> }
) {
  const { resumeId } = await params;

  // 1. Verificar que el usuario está autenticado y es el seller del apunte
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data: resume, error: resumeError } = await supabase
    .from("resumes")
    .select("id, seller_id, file_url, topics")
    .eq("id", resumeId)
    .single();

  if (resumeError || !resume) {
    return NextResponse.json({ error: "Apunte no encontrado" }, { status: 404 });
  }

  if (resume.seller_id !== user.id) {
    return NextResponse.json(
      { error: "Solo el vendedor del apunte puede iniciar la ingesta" },
      { status: 403 }
    );
  }

  const rl = checkRateLimit(`ingest:${user.id}`, 5, 60 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Límite de procesamientos alcanzado. Podés volver a intentarlo en una hora." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  if (!resume.file_url) {
    return NextResponse.json(
      { error: "El apunte no tiene archivo PDF" },
      { status: 400 }
    );
  }

  // 2. Claim ATÓMICO del job (service role para escribir). Evita reingestas
  //    concurrentes del mismo apunte: la RPC solo "toma" el job si no hay uno
  //    'processing' reciente. Si claim=false, otra request ya lo está procesando
  //    y cortamos ANTES de descargar el PDF o generar embeddings (sin doble costo).
  const admin = createAdminClient();

  const { data: claimed, error: claimError } = await admin.rpc(
    "claim_ai_ingestion_job",
    {
      p_resume_id: resumeId,
      p_seller_id: user.id,
      p_stale_after_minutes: getIngestionLockTtlMinutes(),
    }
  );

  if (claimError) {
    return NextResponse.json(
      { error: "Error iniciando la ingesta", detail: claimError.message },
      { status: 500 }
    );
  }

  if (claimed !== true) {
    console.info("[ai:ingest] claim skipped; already processing", { resumeId });
    return NextResponse.json(
      {
        error: "Este apunte ya se está procesando con IA.",
        code: "AI_INGEST_ALREADY_PROCESSING",
        retryable: true,
      },
      { status: 409 }
    );
  }

  try {
    const startedAt = Date.now();

    // 3. Bajar el PDF del bucket privado.
    const { data: fileData, error: fileError } = await admin.storage
      .from("resumes")
      .download(resume.file_url);

    if (fileError || !fileData) {
      throw new AiIngestionError(
        "PDF_DOWNLOAD_ERROR",
        `No se pudo descargar el PDF: ${fileError?.message ?? "sin detalle"}`
      );
    }

    if (typeof fileData.size === "number" && fileData.size > MAX_PDF_BYTES) {
      throw new AiIngestionError(
        "PDF_TOO_LARGE",
        `PDF de ${fileData.size} bytes supera el máximo de ${MAX_PDF_BYTES}`
      );
    }

    // 4. Extraer texto POR PÁGINA (M3). Conserva numeración 1-based para citas.
    const arrayBuffer = await fileData.arrayBuffer();
    let extracted: Awaited<ReturnType<typeof extractPdfPages>>;
    try {
      extracted = await extractPdfPages(arrayBuffer);
    } catch (e) {
      throw new AiIngestionError(
        "PDF_EXTRACTION_ERROR",
        e instanceof Error ? e.message : String(e)
      );
    }

    if (!extracted.fullText || extracted.fullText.trim().length === 0) {
      throw new AiIngestionError("PDF_NO_TEXT", "El PDF no contiene texto extraíble");
    }

    // 5. Chunkear con el chunker M3 (limpieza + secciones + páginas + metadata).
    let chunks: ReturnType<typeof chunkPdfPages>;
    try {
      chunks = chunkPdfPages(extracted.pages);
    } catch (e) {
      throw new AiIngestionError(
        "CHUNKING_ERROR",
        e instanceof Error ? e.message : String(e)
      );
    }

    if (chunks.length === 0) {
      throw new AiIngestionError("CHUNKS_EMPTY", "No se generaron chunks del PDF");
    }

    const hasInsufficientText =
      extracted.fullText.trim().length < 80 ||
      chunks.every((c) => c.metadata.hasShortText === true);

    // 6. Generar embeddings ANTES de tocar la tabla. Si esto falla (rate limit,
    //    auth, timeout, etc.), los chunks anteriores quedan intactos. Clasificamos
    //    el error del proveedor en un código estable.
    let embeddings: number[][];
    try {
      embeddings = await generateEmbeddings(chunks.map((c) => c.content));
    } catch (e) {
      const classified = classifyAiIngestionError(e);
      throw new AiIngestionError(
        classified.code,
        classified.message,
        classified.retryable
      );
    }

    // 7. Reemplazo TRANSACCIONAL: una sola RPC hace delete + insert atómico.
    //    Si algún insert falla, Postgres rollbackea también el delete y los
    //    chunks viejos quedan intactos (nunca queda el apunte con 0 chunks).
    //    El embedding viaja como texto JSON "[...]"; la RPC lo castea a vector.
    const payloadChunks = chunks.map((chunk, i) => ({
      content: chunk.content,
      embedding: JSON.stringify(embeddings[i]),
      chunk_index: chunk.chunkIndex,
      page_start: chunk.pageStart,
      page_end: chunk.pageEnd,
      section_title: chunk.sectionTitle ?? null,
      token_count: chunk.tokenCount ?? null,
      char_count: chunk.charCount,
      metadata: chunk.metadata,
    }));

    const { data: insertedCount, error: rpcError } = await admin.rpc(
      "reingest_document_chunks",
      { p_resume_id: resumeId, p_chunks: payloadChunks }
    );

    if (rpcError) {
      throw new AiIngestionError(
        "DB_REINGEST_ERROR",
        `Error reemplazando chunks: ${rpcError.message}`
      );
    }

    // La RPC devuelve la cantidad insertada: debe coincidir con lo esperado.
    if (insertedCount !== chunks.length) {
      throw new AiIngestionError(
        "DB_REINGEST_ERROR",
        `Conteo de chunks inconsistente: insertados ${insertedCount ?? "null"}, esperados ${chunks.length}`
      );
    }

    // 8. Marcar job como done y limpiar cualquier error previo. Filtramos por
    //    resume_id (unique): el claim ya garantizó que este job es nuestro.
    await admin
      .from("ingestion_jobs")
      .update({
        status: "done",
        chunks_generated: chunks.length,
        finished_at: new Date().toISOString(),
        error_message: null,
        error_code: null,
        retryable: null,
      })
      .eq("resume_id", resumeId);

    // Log de éxito SIN contenido del PDF/chunks.
    console.info("[ai:ingest] completed", {
      resumeId,
      pages: extracted.pageCount,
      chunks: chunks.length,
      chunkingVersion: CHUNKING_VERSION,
      durationMs: Date.now() - startedAt,
      insufficientText: hasInsufficientText,
    });

    // Best-effort: completar los "Temas del apunte" con los títulos de sección
    // (el índice/TOC detectado por el chunker), SIN pisar los que cargó el
    // vendedor. Mejora el recall de la búsqueda pública en los dos caminos de
    // Explorar (Meilisearch usa `topics`; el fallback Postgres lo puntúa en
    // scoreResumeMetadata). Se hace ANTES de reindexar para que el índice tome
    // los temas combinados. No debe afectar el resultado de la ingesta.
    try {
      const derivedTopics = normalizeSectionTitles(
        chunks.map((c) => c.sectionTitle ?? null)
      );
      if (derivedTopics.length > 0) {
        const existingTopics = normalizeResumeTopics(resume.topics ?? []);
        const mergedTopics = mergeResumeTopics(existingTopics, derivedTopics);
        // Solo escribimos si realmente se agregó al menos un tema nuevo.
        if (mergedTopics.length > existingTopics.length) {
          const { error: topicsError } = await admin
            .from("resumes")
            .update({ topics: mergedTopics })
            .eq("id", resumeId);
          if (topicsError) {
            console.warn("[ai:ingest] topics auto-fill failed (ignored)", {
              resumeId,
              message: topicsError.message,
            });
          }
        }
      }
    } catch (topicsErr) {
      console.warn("[ai:ingest] topics auto-fill threw (ignored)", {
        resumeId,
        message:
          topicsErr instanceof Error ? topicsErr.message : String(topicsErr),
      });
    }

    // Best-effort: reindexar el apunte en Meilisearch con los nuevos chunkTerms.
    // No debe afectar el resultado de la ingesta. No-op si Meili no está
    // configurado. Revalida internamente published/deleted contra Supabase.
    try {
      await indexResumeInSearch(resumeId);
    } catch (searchErr) {
      console.warn("[ai:ingest] meilisearch reindex failed (ignored)", {
        resumeId,
        message:
          searchErr instanceof Error ? searchErr.message : String(searchErr),
      });
    }

    return NextResponse.json({
      ok: true,
      resumeId,
      chunks: chunks.length,
      pages: extracted.pageCount,
      insufficientText: hasInsufficientText,
    });
  } catch (err) {
    const classified = classifyAiIngestionError(err);

    // Log seguro: código + retryable + mensaje técnico acotado (sin PDF/chunks).
    console.warn("[ai:ingest] failed", {
      resumeId,
      code: classified.code,
      retryable: classified.retryable,
      message: classified.message,
    });

    await admin
      .from("ingestion_jobs")
      .update({
        status: "failed",
        error_code: classified.code,
        error_message: classified.message,
        retryable: classified.retryable,
        finished_at: new Date().toISOString(),
      })
      .eq("resume_id", resumeId);

    // Respuesta segura: sin stack ni detalle técnico, solo mensaje de usuario.
    return NextResponse.json(
      {
        error: classified.userMessage,
        code: classified.code,
        retryable: classified.retryable,
      },
      { status: classified.statusCode }
    );
  }
}
