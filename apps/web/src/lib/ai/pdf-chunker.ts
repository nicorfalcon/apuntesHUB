import type { ExtractedPdfPage } from "./pdf-extractor";
import {
  cleanExtractedText,
  removeRepeatedHeadersFooters,
} from "./text-cleaner";

export const CHUNKING_VERSION = "m3-v1";

export type PdfChunk = {
  content: string;
  pageStart: number;
  pageEnd: number;
  sectionTitle?: string | null;
  chunkIndex: number;
  tokenCount?: number;
  charCount: number;
  metadata: Record<string, unknown>;
};

export type ChunkOptions = {
  /** Tamaño objetivo aproximado por chunk, en caracteres. */
  targetChars?: number;
  /** Tamaño máximo duro antes de forzar corte. */
  maxChars?: number;
  /** Overlap en caracteres entre chunks consecutivos. */
  overlapChars?: number;
  /** Por debajo de esto se marca metadata.hasShortText. */
  shortTextThreshold?: number;
};

// Calibración alineada al modelo de embeddings (embed-multilingual-v3.0), que
// tiene una ventana MÁXIMA de 512 tokens y trunca el resto. Apuntamos a chunks
// de ~400 tokens (~1600 chars) para que cada chunk se embeba completo. El peor
// caso estructural de un chunk es `maxChars + overlapChars` (~2300 chars ≈ ~500
// tokens); para ese borde excepcional, `truncate: "END"` en embeddings.ts actúa
// como red de seguridad. No es la estrategia principal: el chunker está
// calibrado para no excederla en texto normal.
export const DEFAULT_CHUNK_OPTIONS: Required<ChunkOptions> = {
  targetChars: 1600,
  maxChars: 2000,
  overlapChars: 300,
  shortTextThreshold: 200,
};

const DEFAULTS = DEFAULT_CHUNK_OPTIONS;

// Estimación simple de tokens (encapsulada para poder cambiarla luego sin tocar
// el resto). Heurística: ~4 caracteres por token, con piso por palabras.
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const byChars = Math.ceil(text.length / 4);
  const byWords = Math.ceil(text.trim().split(/\s+/).length * 1.3);
  return Math.max(byChars, byWords);
}

/**
 * Heurística conservadora para detectar si una línea es un título/sección.
 * No busca perfección: solo mejora metadata y los puntos de corte.
 */
export function detectHeading(rawLine: string): boolean {
  const line = rawLine.trim();
  if (line.length === 0) return false;
  // Los títulos suelen ser cortos: descartamos líneas largas (probable cuerpo).
  if (line.length > 80) return false;

  const wordCount = line.split(/\s+/).length;

  // Patrón 1: prefijos académicos explícitos ("Unidad 1", "Capítulo 2", "Tema 3").
  if (
    /^(unidad|capítulo|capitulo|cap\.|tema|sección|seccion|parte|módulo|modulo)\b/i.test(
      line
    )
  ) {
    return true;
  }

  // Patrón 2: numeración tipo "1.", "1.1", "2.3.4", opcionalmente con título corto.
  if (/^\d+(\.\d+)*\.?(\s+\p{L}.*)?$/u.test(line) && wordCount <= 12) return true;

  // De acá en adelante, descartamos si termina en puntuación de oración.
  if (/[.;:,]$/.test(line)) return false;

  // Patrón 3: línea corta en MAYÚSCULAS (al menos 3 letras).
  const letters = line.replace(/[^\p{L}]/gu, "");
  if (letters.length >= 3 && line === line.toUpperCase() && wordCount <= 10) {
    return true;
  }

  // Patrón 4: línea muy corta que arranca en mayúscula (probable subtítulo).
  if (wordCount <= 6 && /^\p{Lu}/u.test(line)) return true;

  return false;
}

type Block = {
  text: string;
  page: number;
  heading: string | null;
};

/**
 * Divide cada página en bloques (párrafos), anotando la página y el heading
 * vigente. Detecta headings al vuelo para arrastrar sectionTitle.
 */
function pagesToBlocks(pages: { pageNumber: number; text: string }[]): Block[] {
  const blocks: Block[] = [];
  let currentHeading: string | null = null;

  for (const page of pages) {
    if (!page.text.trim()) continue;
    const paragraphs = page.text.split(/\n{2,}/);

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      // Un párrafo de una sola línea que parece heading actualiza la sección
      // y no genera bloque de contenido propio.
      const lines = trimmed.split("\n");
      if (lines.length === 1 && detectHeading(lines[0])) {
        currentHeading = lines[0].trim();
        continue;
      }

      // Si la primera línea del párrafo es heading, la usamos como sección
      // y dejamos el resto como contenido.
      if (lines.length > 1 && detectHeading(lines[0])) {
        currentHeading = lines[0].trim();
        const rest = lines.slice(1).join("\n").trim();
        if (rest) {
          blocks.push({ text: rest, page: page.pageNumber, heading: currentHeading });
        }
        continue;
      }

      blocks.push({ text: trimmed, page: page.pageNumber, heading: currentHeading });
    }
  }

  return blocks;
}

/** Parte un bloque demasiado grande en oraciones, respetando maxChars. */
function splitLongBlock(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  // Cortes por oración (., !, ?, ; seguidos de espacio/fin).
  const sentences = text.match(/[^.!?;]+[.!?;]+(\s|$)|[^.!?;]+$/g) ?? [text];
  const parts: string[] = [];
  let buf = "";

  for (const sentence of sentences) {
    if (buf.length + sentence.length > maxChars && buf.length > 0) {
      parts.push(buf.trim());
      buf = "";
    }
    if (sentence.length > maxChars) {
      // Oración monstruosa (sin puntuación): fallback duro por caracteres.
      if (buf.trim()) parts.push(buf.trim());
      buf = "";
      for (let i = 0; i < sentence.length; i += maxChars) {
        parts.push(sentence.slice(i, i + maxChars).trim());
      }
    } else {
      buf += sentence;
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts.filter((p) => p.length > 0);
}

/** Toma los últimos ~overlapChars de un texto sin cortar palabras. */
function tailOverlap(text: string, overlapChars: number): string {
  if (overlapChars <= 0 || text.length <= overlapChars) return text;
  const slice = text.slice(text.length - overlapChars);
  const spaceIdx = slice.indexOf(" ");
  return spaceIdx > 0 ? slice.slice(spaceIdx + 1) : slice;
}

/**
 * Chunker M3: arma chunks a partir de páginas ya extraídas.
 * Prioriza cortar por secciones -> párrafos -> oraciones -> caracteres.
 */
export function chunkPdfPages(
  pages: ExtractedPdfPage[],
  options: ChunkOptions = {}
): PdfChunk[] {
  const opts = { ...DEFAULTS, ...options };

  // Limpieza: primero global (headers/footers) sobre el texto crudo por página,
  // luego limpieza por página.
  const rawTexts = pages.map((p) => p.text ?? "");
  const deHeadered = removeRepeatedHeadersFooters(rawTexts);
  const cleanedPages = pages.map((p, i) => ({
    pageNumber: p.pageNumber,
    text: cleanExtractedText(deHeadered[i] ?? ""),
  }));

  const blocks = pagesToBlocks(cleanedPages);
  if (blocks.length === 0) return [];

  const chunks: PdfChunk[] = [];
  let buf = "";
  let bufPageStart = blocks[0].page;
  let bufPageEnd = blocks[0].page;
  let bufHeading: string | null = blocks[0].heading;
  let chunkIndex = 0;

  const flush = (overlapFrom?: string) => {
    const content = buf.trim();
    if (content.length === 0) return;
    const charCount = content.length;
    const tokenCount = estimateTokens(content);
    chunks.push({
      content,
      pageStart: bufPageStart,
      pageEnd: bufPageEnd,
      sectionTitle: bufHeading,
      chunkIndex,
      tokenCount,
      charCount,
      metadata: {
        pageStart: bufPageStart,
        pageEnd: bufPageEnd,
        sectionTitle: bufHeading,
        source: "pdf",
        chunkingVersion: CHUNKING_VERSION,
        estimatedTokens: tokenCount,
        hasShortText: charCount < opts.shortTextThreshold,
      },
    });
    chunkIndex += 1;
    // Sembrar el próximo buffer con overlap para preservar contexto.
    buf = overlapFrom ? tailOverlap(overlapFrom, opts.overlapChars) : "";
  };

  for (const block of blocks) {
    // Cambio de sección -> cerramos chunk para no mezclar secciones.
    const sectionChanged =
      buf.length > 0 && block.heading !== bufHeading && block.heading !== null;
    if (sectionChanged) {
      const prev = buf;
      flush(prev);
      // Tras un cambio de sección no arrastramos overlap entre secciones.
      buf = "";
      bufHeading = block.heading;
      bufPageStart = block.page;
    }

    // Sub-bloques por si el párrafo solo ya supera maxChars.
    const parts = splitLongBlock(block.text, opts.maxChars);

    for (const part of parts) {
      const candidateLen = buf.length + (buf.length > 0 ? 2 : 0) + part.length;

      if (buf.length === 0) {
        buf = part;
        bufPageStart = block.page;
        bufPageEnd = block.page;
        bufHeading = bufHeading ?? block.heading;
      } else if (candidateLen <= opts.targetChars) {
        buf += "\n\n" + part;
        bufPageEnd = block.page;
      } else {
        // Alcanzamos el target: cerramos con overlap y arrancamos uno nuevo.
        const prev = buf;
        bufPageEnd = block.page;
        flush(prev);
        bufHeading = block.heading;
        bufPageStart = block.page;
        bufPageEnd = block.page;
        buf = buf.length > 0 ? buf + "\n\n" + part : part;
      }
    }
  }

  flush();
  return chunks;
}
