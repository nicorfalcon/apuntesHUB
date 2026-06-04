import type { WebResult } from "@/lib/search/web-search";

export interface Source {
  type: "note" | "web";
  label: string;
  url?: string;
  pages?: string;
}

export interface StudyMetadataContext {
  resumeTitle?: string | null;
  subject?: string | null;
  topics?: string[];
}

export function buildEnrichedPrompt(
  userQuestion: string,
  noteContext: string,
  webResults: WebResult[],
  options: {
    recentMessages?: Array<{ role: "user" | "assistant"; content: string }>;
    studyMetadata?: StudyMetadataContext;
  } = {}
): string {
  const webContext = webResults.length > 0
    ? webResults
        .map((r, i) => `[Fuente web ${i + 1} - ${r.source}]\n${r.snippet}`)
        .join("\n\n")
    : "No se encontraron resultados web adicionales.";
  const recentHistory = (options.recentMessages ?? [])
    .slice(-6)
    .map((message) => {
      const label = message.role === "user" ? "Usuario" : "Asistente";
      return `${label}: ${message.content}`;
    })
    .join("\n");
  const historyBlock = recentHistory
    ? `HISTORIAL RECIENTE:\n${recentHistory}\n\n`
    : "";
  const metadataLines: string[] = [];
  const metadata = options.studyMetadata;
  if (metadata?.resumeTitle) metadataLines.push(`Título del apunte: ${metadata.resumeTitle}`);
  if (metadata?.subject) metadataLines.push(`Materia: ${metadata.subject}`);
  const topics = (metadata?.topics ?? []).filter(Boolean);
  if (topics.length > 0) {
    metadataLines.push(`Temas declarados del apunte: ${topics.join(", ")}`);
  }
  const metadataBlock = metadataLines.length > 0
    ? `METADATA DE ORIENTACIÓN:\n${metadataLines.join("\n")}\n\n`
    : "";

  return `Sos un asistente de estudio. Tenés acceso al contenido de un apunte y a resultados de búsqueda web recientes.

REGLAS IMPORTANTES:
1. Priorizá el contenido del apunte cuando sea relevante.
2. Complementá con información web solo cuando el apunte no sea suficiente.
3. Respondé en español, de forma clara y concisa.
4. Si la pregunta es una continuación ("eso", "lo anterior", "dame un ejemplo", "explicame más"), interpretala con el historial reciente y no cambies de tema.
5. Si el contexto no alcanza para responder sin inventar, decilo claramente.
6. La metadata del apunte (título, materia y temas declarados) sirve para interpretar la pregunta, pero no reemplaza al contexto como fuente.
7. Si un término no aparece literalmente en el contexto pero coincide con un tema declarado, explicá que no aparece escrito con ese nombre y conectalo con fragmentos relacionados.
8. Respondé como tutor universitario claro: explicación corta, desarrollo paso a paso y ejemplo si ayuda.
9. Si generás un ejemplo que no está en el contexto, marcá la sección como "Ejemplo ilustrativo:".
10. No atribuyas al apunte ejemplos que no estén en el contexto.
11. Solo cites páginas/secciones para afirmaciones apoyadas directamente por el contexto. No inventes páginas.
12. Para Le Chatelier, preferí ejemplos genéricos seguros como "A ⇌ B" o "Reactivos ⇌ Productos"; si usás una reacción real, debe estar balanceada o sin coeficientes específicos.
13. Al final de tu respuesta, SIEMPRE incluí una sección con este marcador exacto:
FUENTES_JSON:[{"type":"note","label":"Tu apunte"},{"type":"web","label":"nombre_fuente","url":"https://..."}]
Incluí solo las fuentes que realmente usaste. Si no usaste fuentes web, incluí solo el apunte.

${metadataBlock}
${historyBlock}
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
