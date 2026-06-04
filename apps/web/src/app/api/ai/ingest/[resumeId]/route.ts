import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractPdfPages } from "@/lib/ai/pdf-extractor";
import { chunkPdfPages } from "@/lib/ai/pdf-chunker";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { checkRateLimit } from "@/lib/ai/rate-limit";

export const maxDuration = 60;

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
        error_message: null,
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
    // 3. Bajar el PDF del bucket privado
    const { data: fileData, error: fileError } = await admin.storage
      .from("resumes")
      .download(resume.file_url);

    if (fileError || !fileData) {
      throw new Error(`No se pudo descargar el PDF: ${fileError?.message ?? "sin detalle"}`);
    }

    // 4. Extraer texto POR PÁGINA (M3). Conserva numeración 1-based para citas.
    const startedAt = Date.now();
    const arrayBuffer = await fileData.arrayBuffer();
    const extracted = await extractPdfPages(arrayBuffer);

    if (!extracted.fullText || extracted.fullText.trim().length === 0) {
      throw new Error("El PDF no contiene texto extraíble");
    }

    // 5. Chunkear con el chunker M3 (limpieza + secciones + páginas + metadata).
    const chunks = chunkPdfPages(extracted.pages);

    if (chunks.length === 0) {
      throw new Error("No se pudieron generar chunks a partir del PDF");
    }

    const hasInsufficientText =
      extracted.fullText.trim().length < 80 ||
      chunks.every((c) => c.metadata.hasShortText === true);

    // 6. Generar embeddings ANTES de tocar la tabla. Si esto falla, los chunks
    //    anteriores del apunte quedan intactos (no se borra nada todavía).
    const embeddings = await generateEmbeddings(chunks.map((c) => c.content));

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
      throw new Error(`Error reemplazando chunks: ${rpcError.message}`);
    }

    // La RPC devuelve la cantidad insertada: debe coincidir con lo esperado.
    if (insertedCount !== chunks.length) {
      throw new Error(
        `Conteo de chunks inconsistente: insertados ${insertedCount ?? "null"}, esperados ${chunks.length}`
      );
    }

    // 9. Marcar job como done.
    await admin
      .from("ingestion_jobs")
      .update({
        status: "done",
        chunks_generated: chunks.length,
        finished_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    // Log de métricas SIN contenido del PDF.
    console.info("[ingest] ok", {
      resumeId,
      pages: extracted.pageCount,
      chunks: chunks.length,
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
    const message = err instanceof Error ? err.message : String(err);
    console.error("[ingest] error:", message);

    await admin
      .from("ingestion_jobs")
      .update({
        status: "failed",
        error_message: message.slice(0, 1000),
        finished_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    return NextResponse.json(
      { error: "Error procesando el apunte", detail: message },
      { status: 500 }
    );
  }
}
