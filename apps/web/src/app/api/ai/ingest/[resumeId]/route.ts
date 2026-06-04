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

export const maxDuration = 60;

// Límite de tamaño del PDF para procesar con IA. Evita cargar archivos enormes
// en memoria dentro del maxDuration de 60s.
const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25 MB

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
    .select("id, seller_id, file_url")
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

  // 2. Registrar el job de ingesta (service role para escribir)
  const admin = createAdminClient();

  const { data: job, error: jobError } = await admin
    .from("ingestion_jobs")
    .upsert(
      {
        resume_id: resumeId,
        status: "processing",
        started_at: new Date().toISOString(),
        finished_at: null,
        // Limpiar cualquier error de un intento anterior.
        error_message: null,
        error_code: null,
        retryable: null,
        chunks_generated: 0,
      },
      { onConflict: "resume_id" }
    )
    .select()
    .single();

  if (jobError || !job) {
    return NextResponse.json(
      { error: "Error creando job de ingesta", detail: jobError?.message },
      { status: 500 }
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

    // 8. Marcar job como done y limpiar cualquier error previo.
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
      .eq("id", job.id);

    // Log de éxito SIN contenido del PDF/chunks.
    console.info("[ai:ingest] completed", {
      resumeId,
      pages: extracted.pageCount,
      chunks: chunks.length,
      chunkingVersion: CHUNKING_VERSION,
      durationMs: Date.now() - startedAt,
      insufficientText: hasInsufficientText,
    });

    return NextResponse.json({
      ok: true,
      resumeId,
      chunks: chunks.length,
      pages: extracted.pageCount,
      insufficientText: hasInsufficientText,
      jobId: job.id,
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
      .eq("id", job.id);

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
