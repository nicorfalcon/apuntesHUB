// Limpieza de texto extraído de PDFs.
//
// Se separa en dos niveles:
//   1. cleanExtractedText(text)      -> limpieza POR PÁGINA (sin contexto del resto).
//   2. removeRepeatedHeadersFooters  -> limpieza GLOBAL (compara líneas entre páginas).
//
// Objetivo: mejorar la calidad de los chunks/embeddings sin destruir información
// académica (acentos, símbolos, fórmulas, párrafos).

// Quita caracteres de control invisibles y marcas zero-width. Se hace por code
// point (no por regex con literales) para no incluir bytes invisibles en el
// fuente. Conserva \n (0x0A) y \t (0x09).
function stripInvisible(text: string): string {
  let out = "";
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === 0x09 || code === 0x0a) {
      out += ch;
      continue;
    }
    // Controles C0 / DEL / C1.
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) continue;
    // Soft hyphen, ZWSP, ZWNJ, ZWJ, BOM.
    if (
      code === 0x00ad ||
      code === 0x200b ||
      code === 0x200c ||
      code === 0x200d ||
      code === 0xfeff
    ) {
      continue;
    }
    out += ch;
  }
  return out;
}

/**
 * Limpieza por página. No elimina texto "por las dudas": solo normaliza
 * espacios, saltos de línea, caracteres invisibles y une cortes de palabra
 * por guion. Preserva párrafos (dobles saltos), acentos y símbolos.
 */
export function cleanExtractedText(text: string): string {
  if (!text) return "";

  // 1. Normalizar saltos de línea (CRLF / CR -> LF).
  let out = text.replace(/\r\n?/g, "\n");

  // 2. Quitar caracteres de control invisibles y zero-width.
  out = stripInvisible(out);

  // 3. Unir cortes de palabra por guion de fin de línea:
  //    "trans-\nformación" -> "transformación".
  //    Conservador: solo cuando hay letra antes del guion y letra después del
  //    salto, para no romper guiones intencionales (rangos, listas con "-").
  out = out.replace(/([\p{L}])-\n[\t ]*([\p{L}])/gu, "$1$2");

  // 4. Tabs -> espacio simple.
  out = out.replace(/\t+/g, " ");

  // 5. Colapsar espacios repetidos dentro de cada línea (sin tocar saltos).
  out = out.replace(/[^\S\n]{2,}/g, " ");

  // 6. Quitar espacios al inicio/fin de cada línea.
  out = out
    .split("\n")
    .map((line) => line.trim())
    .join("\n");

  // 7. Colapsar 3+ saltos de línea a 2 (preserva separación de párrafos).
  out = out.replace(/\n{3,}/g, "\n\n");

  return out.trim();
}

/**
 * Heurística CONSERVADORA para reducir headers/footers que se repiten en muchas
 * páginas (numeración, nombre de cátedra, etc.).
 *
 * Reglas para no borrar contenido real:
 *   - Solo mira las primeras/últimas `edgeLines` líneas de cada página.
 *   - Solo elimina una línea si aparece en al menos `minPages` páginas Y en una
 *     fracción >= `minFraction` del total.
 *   - Nunca borra líneas largas (probable contenido, no encabezado).
 *   - No se aplica si hay muy pocas páginas (no hay señal estadística).
 */
export function removeRepeatedHeadersFooters(
  pages: string[],
  {
    edgeLines = 2,
    minFraction = 0.6,
    minPages = 3,
    maxHeaderLen = 80,
  }: {
    edgeLines?: number;
    minFraction?: number;
    minPages?: number;
    maxHeaderLen?: number;
  } = {}
): string[] {
  if (pages.length < minPages) return pages;

  // Normaliza una línea para comparar: minúsculas, sin dígitos (los números de
  // página varían), espacios colapsados. Así "Página 3" y "Página 4" matchean.
  const normalize = (line: string): string =>
    line
      .toLowerCase()
      .replace(/\d+/g, "#")
      .replace(/\s+/g, " ")
      .trim();

  const counts = new Map<string, number>();

  for (const page of pages) {
    const lines = page.split("\n").filter((l) => l.trim().length > 0);
    const edges = [...lines.slice(0, edgeLines), ...lines.slice(-edgeLines)];
    // Set por página: una misma línea repetida en la misma página cuenta 1 vez.
    const seen = new Set<string>();
    for (const line of edges) {
      if (line.length > maxHeaderLen) continue;
      const norm = normalize(line);
      if (norm.length === 0) continue;
      seen.add(norm);
    }
    for (const norm of Array.from(seen)) {
      counts.set(norm, (counts.get(norm) ?? 0) + 1);
    }
  }

  const threshold = Math.max(minPages, Math.ceil(pages.length * minFraction));
  const repeated = new Set(
    Array.from(counts.entries())
      .filter(([, count]) => count >= threshold)
      .map(([norm]) => norm)
  );

  if (repeated.size === 0) return pages;

  return pages.map((page) => {
    const lines = page.split("\n");
    const kept = lines.filter((line, idx) => {
      // Solo evaluamos las líneas de borde; el cuerpo no se toca nunca.
      const isEdge = idx < edgeLines || idx >= lines.length - edgeLines;
      if (!isEdge) return true;
      if (line.trim().length === 0 || line.length > maxHeaderLen) return true;
      return !repeated.has(normalize(line));
    });
    return kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  });
}
