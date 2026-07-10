#!/usr/bin/env node
// Genera las imágenes de vista previa protegida (estilo Scribd) de los apuntes con
// preview_status = 'pending'. Espeja process-pending-hls.mjs: reclama pendientes en
// FIFO vía RPC, renderiza, sube al bucket privado 'resume-previews' y marca 'ready'.
//
// Uso:
//   npm run preview:process-pending [-- --limit N]
//
// Requiere SUPABASE_SERVICE_ROLE_KEY y las env de Supabase (las carga loadEnvFiles).
// No imprime contenido sensible: solo ids y conteos.

import process from "node:process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadEnvFiles, createAdminClient } from "./lib/hls-conversion.mjs";
import {
  PREVIEW_MAX_RENDERED_PAGES,
  resolveFreePages,
  resolveRenderedPageCount,
  detectIndexPage,
} from "./lib/preview-rules.mjs";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";

// pdfjs (build legacy) necesita estas globales del DOM para renderizar en Node.
// @napi-rs/canvas las provee (a diferencia de node-canvas, que no trae Path2D).
globalThis.DOMMatrix ??= DOMMatrix;
globalThis.ImageData ??= ImageData;
globalThis.Path2D ??= Path2D;

// Polyfill de Promise.try — idéntico al de src/lib/ai/pdf-extractor.ts. pdfjs la usa
// con ciertos PDFs (fuentes no estándar / cmaps). Node 22 no la trae nativa; al
// faltar lanza un TypeError sincrónico dentro de un microtask desprendido de pdfjs
// que ESCAPA al try/catch de processResume: el apunte quedaría colgado en 'processing'.
if (typeof Promise.try !== "function") {
  Promise.try = function (fn, ...args) {
    return new Promise((res) => res(fn(...args)));
  };
}

const RESUMES_BUCKET = "resumes";
const PREVIEWS_BUCKET = "resume-previews";

// CanvasFactory de pdfjs respaldada por @napi-rs/canvas. pdfjs la usa para el canvas
// principal y para los auxiliares (patterns, fuentes type3, máscaras): por eso NO
// alcanza con renderizar en un canvas propio. Implementa el contrato de
// BaseCanvasFactory (create/reset/destroy).
class NapiCanvasFactory {
  create(width, height) {
    if (width <= 0 || height <= 0) throw new Error("Invalid canvas size");
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext("2d") };
  }
  reset(canvasAndContext, width, height) {
    if (!canvasAndContext.canvas) throw new Error("Canvas is not specified");
    if (width <= 0 || height <= 0) throw new Error("Invalid canvas size");
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(canvasAndContext) {
    if (!canvasAndContext.canvas) throw new Error("Canvas is not specified");
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
  }
}

// cMaps + fuentes estándar para PDFs con fuentes no estándar (apuntes de iPad /
// escaneados). Best-effort: si el directorio no existe, no se pasa la opción.
function resolvePdfAssetOptions() {
  const pdfjsDir = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../node_modules/pdfjs-dist"
  );
  const opts = {};
  const cmapDir = resolve(pdfjsDir, "cmaps");
  if (existsSync(cmapDir)) {
    opts.cMapUrl = pathToFileURL(cmapDir).href + "/";
    opts.cMapPacked = true;
  }
  const fontsDir = resolve(pdfjsDir, "standard_fonts");
  if (existsSync(fontsDir)) {
    opts.standardFontDataUrl = pathToFileURL(fontsDir).href + "/";
  }
  return opts;
}

// Escalas de render. Las libres, nítidas; las bloqueadas, muy chicas (ilegibles).
// El visor refuerza con blur por CSS. Nunca se sube la versión nítida de una
// página bloqueada (regla de oro de la feature).
const FREE_SCALE = 1.8;
const LOCKED_SCALE = 0.35;

function parseArgs(argv) {
  const args = { limit: 5, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--limit") args.limit = Number(argv[++i]);
  }
  return args;
}

function printHelp() {
  console.log(`Uso:
  npm run preview:process-pending [-- --limit N]

Opciones:
  --limit N   Máximo de apuntes a procesar en esta corrida. Default: 5.
  --help      Muestra esta ayuda.

Reclama apuntes en estado preview 'pending' (FIFO), los marca 'processing',
descarga el PDF de Supabase Storage, renderiza páginas libres nítidas y
bloqueadas en baja resolución, sube al bucket privado '${PREVIEWS_BUCKET}' y
marca 'ready'. En error individual marca 'failed' sin frenar la tanda.`);
}

async function markFailed(supabase, resumeId, error) {
  const message = (error?.message ?? String(error)).slice(0, 500);
  await supabase
    .from("resumes")
    .update({ preview_status: "failed", preview_error: message })
    .eq("id", resumeId);
}

/** Descarga el PDF original del apunte desde el bucket privado 'resumes'. */
async function downloadPdf(supabase, filePath) {
  const { data, error } = await supabase.storage
    .from(RESUMES_BUCKET)
    .download(filePath);
  if (error || !data) {
    throw new Error(`No pude descargar el PDF (${filePath}): ${error?.message}`);
  }
  return new Uint8Array(await data.arrayBuffer());
}

/**
 * Renderiza una página a PNG y devuelve el buffer + sus dimensiones. Recibe el
 * PDFDocumentProxy ya abierto: renderPageAsImage lo reutiliza sin re-parsear (y sin
 * arriesgar que el Uint8Array original quede "detached" tras abrir el doc en pdf.js).
 * Las dimensiones (del viewport a esa escala) se guardan para que el visor reserve
 * el espacio y evite layout shift (CLS).
 */
async function renderPage(pdf, pageNumber, scale) {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const width = Math.max(1, Math.ceil(viewport.width));
  const height = Math.max(1, Math.ceil(viewport.height));

  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  await page.render({ canvasContext: context, viewport }).promise;
  page.cleanup();

  return {
    png: await canvas.encode("png"),
    width,
    height,
  };
}

/**
 * Extrae el texto de las primeras `count` páginas (para detectar el índice). Usa la
 * API de pdf.js sobre el proxy ya abierto: acotado a pocas páginas, no recorre el doc
 * entero. Si una página falla, devuelve "" para esa posición (best-effort).
 */
async function extractFirstPagesText(pdfProxy, count) {
  const limit = Math.min(count, pdfProxy.numPages);
  const texts = [];
  for (let i = 1; i <= limit; i += 1) {
    try {
      const page = await pdfProxy.getPage(i);
      const content = await page.getTextContent();
      texts.push(content.items.map((it) => it.str ?? "").join(" "));
    } catch {
      texts.push("");
    }
  }
  return texts;
}

/** Preflight: confirma que @napi-rs/canvas renderiza (Path2D + createCanvas + encode).
 * Falla temprano con un mensaje claro en vez de por cada apunte. */
async function assertCanvasAvailable() {
  try {
    if (typeof Path2D !== "function") {
      throw new Error("@napi-rs/canvas no expone Path2D");
    }
    const probe = createCanvas(2, 2);
    await probe.encode("png");
  } catch (err) {
    throw new Error(
      "No se pudo usar '@napi-rs/canvas'. Instalalo en el entorno del worker " +
        "(npm i @napi-rs/canvas -w @apunteshub/web). Detalle: " +
        (err?.message ?? err)
    );
  }
}

async function processResume(supabase, resume) {
  const { id: resumeId, seller_id: sellerId, file_url: filePath } = resume;

  if (!filePath) {
    throw new Error("El apunte no tiene file_url");
  }

  const pdfBytes = await downloadPdf(supabase, filePath);

  // Abrimos el documento una vez y reusamos el proxy para leer texto y renderizar.
  // La CanvasFactory de @napi-rs/canvas cubre los canvases auxiliares de pdfjs.
  const loadingTask = pdfjs.getDocument({
    data: pdfBytes,
    CanvasFactory: NapiCanvasFactory,
    ...resolvePdfAssetOptions(),
  });
  const pdf = await loadingTask.promise;

  const totalPages = pdf.numPages;
  const renderedCount = resolveRenderedPageCount(totalPages);

  // Páginas libres = política de contenido ∪ índice detectado. El índice se muestra
  // siempre (aunque en docs cortos la política no libere ninguna página de contenido):
  // es un teaser útil que no expone material real.
  const freePages = new Set(resolveFreePages(totalPages));
  const firstTexts = await extractFirstPagesText(pdf, 5);
  const indexPage = detectIndexPage(firstTexts);
  if (indexPage && indexPage <= renderedCount) {
    freePages.add(indexPage);
  }

  // Limpiar páginas previas (regeneración) — tanto storage como filas.
  await supabase.storage
    .from(PREVIEWS_BUCKET)
    .remove(
      Array.from({ length: PREVIEW_MAX_RENDERED_PAGES }, (_, i) =>
        `${sellerId}/${resumeId}/p${i + 1}.png`
      )
    )
    .catch(() => {});
  await supabase.from("resume_preview_pages").delete().eq("resume_id", resumeId);

  const rows = [];
  for (let page = 1; page <= renderedCount; page += 1) {
    const locked = !freePages.has(page);
    const scale = locked ? LOCKED_SCALE : FREE_SCALE;

    const { png, width, height } = await renderPage(pdf, page, scale);
    const storagePath = `${sellerId}/${resumeId}/p${page}.png`;

    const { error: upErr } = await supabase.storage
      .from(PREVIEWS_BUCKET)
      .upload(storagePath, png, { contentType: "image/png", upsert: true });
    if (upErr) {
      throw new Error(`No pude subir la página ${page}: ${upErr.message}`);
    }

    rows.push({
      resume_id: resumeId,
      page_number: page,
      storage_path: storagePath,
      is_locked: locked,
      width,
      height,
    });
  }

  if (rows.length > 0) {
    const { error: insErr } = await supabase
      .from("resume_preview_pages")
      .insert(rows);
    if (insErr) {
      throw new Error(`No pude insertar filas de páginas: ${insErr.message}`);
    }
  }

  const { error: readyErr } = await supabase
    .from("resumes")
    .update({
      preview_status: "ready",
      preview_page_count: renderedCount,
      preview_processing_completed_at: new Date().toISOString(),
      preview_error: null,
    })
    .eq("id", resumeId);
  if (readyErr) {
    throw new Error(`No pude marcar 'ready': ${readyErr.message}`);
  }

  await pdf.destroy();
  return { resumeId, renderedCount, freeCount: freePages.size };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  await loadEnvFiles();
  await assertCanvasAvailable();
  const supabase = await createAdminClient();

  const limit = Number.isFinite(args.limit) && args.limit > 0 ? args.limit : 5;
  let processed = 0;
  let failed = 0;

  for (let i = 0; i < limit; i += 1) {
    // Claim atómico FIFO: marca 'processing' y devuelve el id, o null si no hay.
    const { data: resumeId, error: claimErr } = await supabase.rpc(
      "claim_resume_preview_job"
    );
    if (claimErr) {
      console.error("Error al reclamar job:", claimErr.message);
      break;
    }
    if (!resumeId) {
      break; // no hay más pendientes
    }

    const { data: resume, error: resumeErr } = await supabase
      .from("resumes")
      .select("id, seller_id, file_url")
      .eq("id", resumeId)
      .single();

    if (resumeErr || !resume) {
      failed += 1;
      await markFailed(supabase, resumeId, resumeErr ?? new Error("no encontrado"));
      console.error(`✗ ${resumeId}: no pude leer el apunte`);
      continue;
    }

    try {
      const result = await processResume(supabase, resume);
      processed += 1;
      console.log(
        `✓ ${result.resumeId}: ${result.renderedCount} páginas ` +
          `(${result.freeCount} libres)`
      );
    } catch (err) {
      failed += 1;
      await markFailed(supabase, resumeId, err);
      console.error(`✗ ${resumeId}: ${err.message}`);
    }
  }

  console.log(`\nHecho. Procesados: ${processed}, fallidos: ${failed}.`);
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
