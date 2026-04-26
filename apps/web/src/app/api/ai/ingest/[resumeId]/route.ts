import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractPdfText } from "@/lib/ai/pdf-extractor";
import { chunkText } from "@/lib/ai/chunker";
import { generateEmbeddings } from "@/lib/ai/embeddings";

export const maxDuration = 60;

export async function POST(
  _req: NextRequest,
  { params }: { params: { resumeId: string } }
) {
  try {
    const { resumeId } = params;
    const admin = createAdminClient();

    // 1. Buscar el apunte
    const { data: resume, error: resumeError } = await admin
      .from("resumes")
      .select("id, title, file_url")
      .eq("id", resumeId)
      .single();

    if (resumeError || !resume) {
      return NextResponse.json(
        { error: "Apunte no encontrado" },
        { status: 404 }
      );
    }

    if (!resume.file_url) {
      return NextResponse.json(
        { error: "El apunte no tiene archivo PDF" },
        { status: 400 }
      );
    }

    // 2. Bajar el PDF del bucket
    const { data: fileData, error: fileError } = await admin.storage
      .from("resumes")
      .download(resume.file_url);

    if (fileError || !fileData) {
      return NextResponse.json(
        { error: "No se pudo descargar el PDF" },
        { status: 500 }
      );
    }

    // 3. Extraer texto
    const arrayBuffer = await fileData.arrayBuffer();
    const text = await extractPdfText(arrayBuffer);

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "No se pudo extraer texto del PDF" },
        { status: 400 }
      );
    }

    // 4. Chunkear
    const chunks = chunkText(text);

    // 5. Generar embeddings
    const embeddings = await generateEmbeddings(chunks.map((c) => c.content));

    // 6. Eliminar chunks previos si ya fue ingestado antes
    await admin
      .from("document_chunks")
      .delete()
      .eq("resume_id", resumeId);

    // 7. Insertar chunks nuevos
    const rows = chunks.map((chunk, i) => ({
      resume_id: resumeId,
      content: chunk.content,
      embedding: embeddings[i],
      chunk_index: chunk.chunkIndex,
    }));

    const { error: insertError } = await admin
      .from("document_chunks")
      .insert(rows);

    if (insertError) {
      return NextResponse.json(
        { error: "Error al guardar los chunks", detail: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      resumeId,
      chunks: chunks.length,
    });
  } catch (err) {
    console.error("[ingest] error:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}