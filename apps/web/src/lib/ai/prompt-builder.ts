import type { WebResult } from "@/lib/search/web-search";

export interface Source {
  type: "note" | "web";
  label: string;
  url?: string;
  pages?: string;
}

export function buildEnrichedPrompt(
  userQuestion: string,
  noteContext: string,
  webResults: WebResult[]
): string {
  const webContext = webResults.length > 0
    ? webResults
        .map((r, i) => `[Fuente web ${i + 1} - ${r.source}]\n${r.snippet}`)
        .join("\n\n")
    : "No se encontraron resultados web adicionales.";

  return `Sos un asistente de estudio. Tenés acceso al contenido de un apunte y a resultados de búsqueda web recientes.

REGLAS IMPORTANTES:
1. Priorizá el contenido del apunte cuando sea relevante.
2. Complementá con información web solo cuando el apunte no sea suficiente.
3. Respondé en español, de forma clara y concisa.
4. Al final de tu respuesta, SIEMPRE incluí una sección con este marcador exacto:
FUENTES_JSON:[{"type":"note","label":"Tu apunte"},{"type":"web","label":"nombre_fuente","url":"https://..."}]
Incluí solo las fuentes que realmente usaste. Si no usaste fuentes web, incluí solo el apunte.

CONTENIDO DEL APUNTE:
${noteContext}

RESULTADOS DE BÚSQUEDA WEB:
${webContext}

PREGUNTA DEL USUARIO:
${userQuestion}

TU RESPUESTA:`;
}

export function parseSourcesFromResponse(
  responseText: string
): { cleanText: string; sources: Source[] } {
  const MARKER = "FUENTES_JSON:";
  const idx = responseText.indexOf(MARKER);

  if (idx === -1) {
    return {
      cleanText: responseText.trim(),
      sources: [{ type: "note", label: "Tu apunte" }],
    };
  }

  const cleanText = responseText.slice(0, idx).trim();
  const jsonStr = responseText.slice(idx + MARKER.length).trim();

  try {
    const sources = JSON.parse(jsonStr) as Source[];
    return { cleanText, sources };
  } catch {
    return {
      cleanText,
      sources: [{ type: "note", label: "Tu apunte" }],
    };
  }
}
