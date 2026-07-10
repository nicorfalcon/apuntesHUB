// Extracción de "Temas del apunte" sugeridos desde el índice de un PDF.
//
// Este helper es PURO (no toca pdfjs ni Next): recibe el outline ya resuelto
// (bookmarks) o el texto de la página de índice, y devuelve una lista de temas
// limpios lista para pre-cargar como chips editables en el formulario.
//
// Contexto del problema (ver caso "Lógica Computacional"): los PDFs de LaTeX con
// `hyperref` suelen traer, además de los bookmarks reales de capítulo/sección,
// un bookmark por CADA página cuyo título es el encabezado corrido:
//   "<capítulo> <título del documento> Página <n>"
// p. ej. "Cardinalidad Lógica Computacional Página 12". Si uno toma todos los
// títulos del outline sin filtrar, esos encabezados entran como temas basura.
//
// Reglas de limpieza:
//   - descartar entradas que sean un encabezado corrido por página
//     (terminan en "Página <n>" / "Pág. <n>", arábigo o romano);
//   - descartar títulos de índice genéricos ("Índice general", "Contenidos", …);
//   - descartar entradas que sean solo numeración / número de página;
//   - quitar numeración de sección al inicio ("1.2.3 ") y líderes de puntos +
//     número de página al final ("Tema . . . . 12");
//   - quedarse solo con los primeros niveles del outline (capítulos/secciones);
//   - normalizar con las reglas existentes (dedupe, largo, máximo de temas).

import { normalizeResumeTopic, normalizeResumeTopics } from "./topics";

/** Nodo de outline resuelto (compatible con TocItem de pdf-viewer). */
export interface OutlineTopicNode {
  title: string;
  items?: OutlineTopicNode[];
}

// Encabezado corrido por página: "… Página 12", "… Pág. iii", "… página XIV".
// Requiere la palabra Página/Pág para no confundirse con un título legítimo que
// termine en un número.
const PAGE_HEADER_TAIL = /\bp[áa]g(?:ina)?\.?\s+[0-9ivxlcdm]+\s*$/i;

// Títulos genéricos del propio índice / portada que no son temas de contenido.
const GENERIC_TITLES =
  /^(?:[íi]ndice(?:\s+general)?|contenidos?|tabla\s+de\s+contenidos?|[íi]ndice\s+de\s+contenidos?|sumario)$/i;

// Título que es solo numeración, número de página o números romanos.
const ONLY_NUMBERING = /^[\divxlcdm.\s·-]+$/i;

/** ¿El título es un encabezado/ruido y no un tema real? */
function isNoiseTitle(title: string): boolean {
  const t = title.trim();
  if (!t) return true;
  if (PAGE_HEADER_TAIL.test(t)) return true;
  if (GENERIC_TITLES.test(t)) return true;
  if (ONLY_NUMBERING.test(t)) return true;
  return false;
}

/**
 * Limpia un título de outline: quita numeración de sección inicial y un posible
 * sufijo de líderes de puntos + número de página. Devuelve "" si queda vacío.
 */
export function cleanTopicTitle(raw: string): string {
  let t = raw.replace(/\s+/g, " ").trim();

  // Líderes de puntos/espacios seguidos de número de página final:
  // "Producto cartesiano . . . . 1" -> "Producto cartesiano".
  t = t.replace(/[.·\s]{2,}[0-9ivxlcdm]+\s*$/i, "").trim();
  // Número de página "pegado" al final sin líderes: "Relaciones 1" -> "Relaciones".
  // Solo si hay al menos una palabra antes (evita borrar títulos de una palabra).
  t = t.replace(/(\S.*\S)\s+[0-9ivxlcdm]{1,4}\s*$/i, "$1").trim();
  // Numeración de sección al inicio: "1.2.3 ", "1.2. ", "3 ".
  t = t.replace(/^\d+(?:\.\d+)*\.?\s+/, "").trim();

  return t;
}

/** Recorre el outline hasta `maxDepth` niveles y junta los títulos crudos. */
function collectTitles(
  nodes: OutlineTopicNode[],
  maxDepth: number,
  depth = 1,
  acc: string[] = []
): string[] {
  for (const node of nodes) {
    if (typeof node.title === "string") acc.push(node.title);
    if (node.items?.length && depth < maxDepth) {
      collectTitles(node.items, maxDepth, depth + 1, acc);
    }
  }
  return acc;
}

/**
 * Temas sugeridos a partir del outline (bookmarks) del PDF. Filtra encabezados
 * por página y ruido, se queda con los primeros `maxDepth` niveles y normaliza.
 */
export function topicsFromOutline(
  nodes: OutlineTopicNode[],
  maxDepth = 2
): string[] {
  if (!Array.isArray(nodes) || nodes.length === 0) return [];

  const cleaned: string[] = [];
  for (const rawTitle of collectTitles(nodes, maxDepth)) {
    if (isNoiseTitle(rawTitle)) continue;
    const cleanedTitle = cleanTopicTitle(rawTitle);
    // Volver a chequear ruido tras limpiar (p. ej. quedó solo un número).
    if (!cleanedTitle || isNoiseTitle(cleanedTitle)) continue;
    const norm = normalizeResumeTopic(cleanedTitle);
    if (norm) cleaned.push(norm);
  }

  return normalizeResumeTopics(cleaned);
}

/**
 * Temas sugeridos a partir del TEXTO de la página de índice (fallback cuando el
 * PDF no tiene outline). Parte por líneas y aplica la misma limpieza.
 */
export function topicsFromIndexText(text: string): string[] {
  if (typeof text !== "string" || !text.trim()) return [];

  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw || isNoiseTitle(raw)) continue;
    const cleaned = cleanTopicTitle(raw);
    if (!cleaned || isNoiseTitle(cleaned)) continue;
    const norm = normalizeResumeTopic(cleaned);
    if (norm) out.push(norm);
  }

  return normalizeResumeTopics(out);
}

/**
 * Combina outline (prioridad) y texto de índice (fallback). Si el outline ya da
 * temas, se usa eso; si no, se cae al texto.
 */
export function suggestTopics(input: {
  outline?: OutlineTopicNode[] | null;
  indexText?: string | null;
  maxDepth?: number;
}): string[] {
  const fromOutline = topicsFromOutline(input.outline ?? [], input.maxDepth ?? 2);
  if (fromOutline.length > 0) return fromOutline;
  return topicsFromIndexText(input.indexText ?? "");
}
