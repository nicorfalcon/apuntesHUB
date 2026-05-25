// Re-ingesta masiva con normalización de diacríticos.
// Uso: node --env-file=apps/web/.env.local scripts/reingest-all.mjs
//
// Descarga cada PDF ya ingresado desde Supabase Storage, lo rechunkea
// y regenera los embeddings con la normalización nueva (sin diacríticos).
// El contenido visible en la DB queda sin cambios; solo cambian los vectores.

import { createClient } from "@supabase/supabase-js";
import { CohereClient } from "cohere-ai";
import { getDocumentProxy, extractText } from "unpdf";
import { resolve } from "path";
import { pathToFileURL, fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
// pdfjs-dist está en el workspace de apps/web, no en el root
const CMAP_URL = pathToFileURL(resolve(__dirname, "../apps/web/node_modules/pdfjs-dist/cmaps")).href + "/";

const CHUNK_SIZE = 700;
const CHUNK_OVERLAP = 120;
const BATCH_LIMIT = 96;
const EMBEDDING_MODEL = "embed-multilingual-v3.0";

function normalizeForEmbedding(text) {
  return text.normalize("NFD").replace(/\p{Mn}/gu, "");
}

function chunkText(text) {
  const chunks = [];
  let start = 0;
  let index = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    const content = text.slice(start, end).trim();
    if (content.length > 0) {
      chunks.push({ content, chunkIndex: index });
      index++;
    }
    start += CHUNK_SIZE - CHUNK_OVERLAP;
  }
  return chunks;
}

// pdfjs-dist v4 no expone NodeCMapReaderFactory — la implementamos con fs/promises
// para que los cmaps se lean del disco en vez de intentar fetchearlos vía HTTP.
class NodeCMapReaderFactory {
  constructor({ baseUrl }) {
    this.baseUrl = baseUrl;
  }
  async fetch({ name }) {
    const { readFile } = await import("fs/promises");
    const { fileURLToPath } = await import("url");
    const filePath = fileURLToPath(new URL(name + ".bcmap", this.baseUrl));
    const data = await readFile(filePath);
    return { cMapData: new Uint8Array(data), compressionType: 1 };
  }
}

async function extractPdfText(arrayBuffer) {
  const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer), {
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    CMapReaderFactory: NodeCMapReaderFactory,
  });
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

async function generateEmbeddings(texts, cohere) {
  const all = [];
  for (let i = 0; i < texts.length; i += BATCH_LIMIT) {
    const batch = texts.slice(i, i + BATCH_LIMIT);
    const response = await cohere.embed({
      model: EMBEDDING_MODEL,
      texts: batch.map(normalizeForEmbedding),
      inputType: "search_document",
    });
    for (const vec of response.embeddings) {
      all.push(vec);
    }
  }
  return all;
}

async function reingestResume(resumeId, fileUrl, title, admin, cohere) {
  const label = `[${(title ?? resumeId).slice(0, 40)}]`;

  process.stdout.write(`${label} Descargando...`);
  const { data: fileData, error: fileError } = await admin.storage
    .from("resumes")
    .download(fileUrl);

  if (fileError || !fileData) {
    throw new Error(`No se pudo descargar el PDF: ${fileError?.message}`);
  }

  const arrayBuffer = await fileData.arrayBuffer();

  process.stdout.write(` extrayendo texto...`);
  const text = await extractPdfText(arrayBuffer);

  if (!text || text.trim().length === 0) {
    throw new Error("El PDF no contiene texto extraíble");
  }

  const chunks = chunkText(text);
  process.stdout.write(` ${chunks.length} chunks... embeddings...`);

  const embeddings = await generateEmbeddings(chunks.map((c) => c.content), cohere);

  const { error: deleteError } = await admin
    .from("document_chunks")
    .delete()
    .eq("resume_id", resumeId);

  if (deleteError) throw new Error(`Error limpiando chunks: ${deleteError.message}`);

  const rows = chunks.map((chunk, i) => ({
    resume_id: resumeId,
    content: chunk.content,
    embedding: JSON.stringify(embeddings[i]),
    chunk_index: chunk.chunkIndex,
  }));

  const { error: insertError } = await admin.from("document_chunks").insert(rows);
  if (insertError) throw new Error(`Error insertando chunks: ${insertError.message}`);

  await admin
    .from("ingestion_jobs")
    .update({
      status: "done",
      chunks_generated: chunks.length,
      finished_at: new Date().toISOString(),
      error_message: null,
    })
    .eq("resume_id", resumeId);

  console.log(` OK`);
  return chunks.length;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const cohereApiKey = process.env.COHERE_API_KEY;

  if (!supabaseUrl || !serviceRoleKey || !cohereApiKey) {
    console.error(
      "Faltan variables de entorno. Necesitás:\n" +
      "  NEXT_PUBLIC_SUPABASE_URL\n" +
      "  SUPABASE_SERVICE_ROLE_KEY\n" +
      "  COHERE_API_KEY"
    );
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const cohere = new CohereClient({ token: cohereApiKey });

  const { data: jobs, error } = await admin
    .from("ingestion_jobs")
    .select("resume_id, resumes(id, file_url, title)")
    .eq("status", "done");

  if (error) {
    console.error("Error consultando jobs:", error.message);
    process.exit(1);
  }

  if (!jobs || jobs.length === 0) {
    console.log("No hay apuntes ingresados para re-procesar.");
    return;
  }

  console.log(`Re-ingestando ${jobs.length} apunte(s) con normalización de diacríticos...\n`);

  let ok = 0;
  let failed = 0;

  for (const job of jobs) {
    const resume = Array.isArray(job.resumes) ? job.resumes[0] : job.resumes;
    if (!resume?.file_url) {
      console.warn(`[${job.resume_id}] Sin file_url, saltando.`);
      continue;
    }

    try {
      await reingestResume(job.resume_id, resume.file_url, resume.title, admin, cohere);
      ok++;
    } catch (err) {
      console.error(` ERROR: ${err.message}`);
      await admin
        .from("ingestion_jobs")
        .update({
          status: "failed",
          error_message: err.message.slice(0, 1000),
          finished_at: new Date().toISOString(),
        })
        .eq("resume_id", job.resume_id);
      failed++;
    }
  }

  console.log(`\nListo: ${ok} OK, ${failed} con errores.`);
}

main().catch((err) => {
  console.error("Error inesperado:", err);
  process.exit(1);
});
