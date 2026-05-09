import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractPdfText } from "@/lib/ai/pdf-extractor";
import { chunkText } from "@/lib/ai/chunker";
import { generateEmbeddings } from "@/lib/ai/embeddings";

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

    // 4. Extraer texto
    const arrayBuffer = await fileData.arrayBuffer();
    const text = await extractPdfText(arrayBuffer);

    if (!text || text.trim().length === 0) {
      throw new Error("El PDF no contiene texto extraíble");
    }

    // 5. Chunkear
    const chunks = chunkText(text);

    // 6. Generar embeddings
    const embeddings = await generateEmbeddings(chunks.map((c) => c.content));

    // 7. Reemplazar chunks anteriores (idempotente)
    const { error: deleteError } = await admin
      .from("document_chunks")
      .delete()
      .eq("resume_id", resumeId);

    if (deleteError) {
      throw new Error(`Error limpiando chunks previos: ${deleteError.message}`);
    }

    // 8. Insertar chunks nuevos
    const rows = chunks.map((chunk, i) => ({
      resume_id: resumeId,
      content: chunk.content,
      embedding: JSON.stringify(embeddings[i]),
      chunk_index: chunk.chunkIndex,
    }));

    const { error: insertError } = await admin.from("document_chunks").insert(rows);

    if (insertError) {
      throw new Error(`Error insertando chunks: ${insertError.message}`);
    }

    // 9. Marcar job como done
    await admin
      .from("ingestion_jobs")
      .update({
        status: "done",
        chunks_generated: chunks.length,
        finished_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    return NextResponse.json({
      ok: true,
      resumeId,
      chunks: chunks.length,
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
