import type { WebResult } from "@/lib/search/web-search";
import type { StudyChatAnswerMode } from "@/lib/ai/chat-request";
import { isStructuredActivityMode } from "@/lib/ai/study-activity";

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
    answerMode?: StudyChatAnswerMode;
    /** Segundo intento: refuerza que la salida debe ser JSON puro. */
    repair?: boolean;
    /** Cantidad de preguntas para actividades estructuradas (default 3). */
    count?: number;
  } = {}
): string {
  // Modos estructurados (V/F y multiple choice): prompt dedicado y minimalista
  // que pide JSON estricto, sin web, sin marcadores de fuentes ni rótulos de
  // tutor. Esto reduce muchísimo el riesgo de salida no parseable en modelos
  // propios (especialmente Gemini).
  if (isStructuredActivityMode(options.answerMode ?? "auto")) {
    return buildStructuredActivityPrompt(userQuestion, noteContext, {
      mode: options.answerMode as "true_false" | "multiple_choice",
      studyMetadata: options.studyMetadata,
      recentMessages: options.recentMessages,
      repair: options.repair ?? false,
      count: options.count ?? 3,
    });
  }

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
  const modeInstruction = answerModeInstruction(options.answerMode);
  const activityInstruction = structuredActivityInstruction(options.answerMode);

  return `Sos un asistente de estudio. Tenés acceso al contenido de un apunte y a resultados de búsqueda web recientes.

REGLAS IMPORTANTES:
1. Priorizá el contenido del apunte cuando sea relevante.
2. Complementá con información web solo cuando el apunte no sea suficiente.
3. Respondé en español, de forma clara y concisa.
4. Si la pregunta es una continuación ("eso", "lo anterior", "dame un ejemplo", "explicame más"), interpretala con el historial reciente y no cambies de tema.
5. Si el contexto no alcanza para responder sin inventar, decilo claramente.
6. La metadata del apunte (título, materia y temas declarados) sirve para interpretar la pregunta, pero no reemplaza al contexto como fuente.
7. Si un término no aparece literalmente en el contexto pero coincide con un tema declarado, explicá que no aparece escrito con ese nombre y conectalo con fragmentos relacionados.
8. Si un tema aparece declarado pero el contexto recuperado no alcanza para desarrollarlo, explicá solo lo que puedas conectar con el contexto y aclaralo.
9. ${modeInstruction}
10. El modo elegido nunca permite saltear las reglas de fuente, privacidad o grounding.
11. Respondé como tutor universitario claro: explicación corta, desarrollo paso a paso y ejemplo si ayuda.
12. Cuando sea natural, separá la respuesta con rótulos: "Según el apunte", "Esto significa", "Ejemplo ilustrativo" y "Para practicar".
13. En "Según el apunte", incluí solo afirmaciones apoyadas por el contexto.
14. En "Esto significa", explicá consecuencias o interpretación derivada del contexto.
15. En "Para practicar", proponé ejercicios o preguntas basadas en el contexto recuperado.
16. Si generás un ejemplo que no está en el contexto, marcá la sección como "Ejemplo ilustrativo:".
17. No atribuyas al apunte ejemplos que no estén en el contexto.
18. Solo cites páginas/secciones para afirmaciones apoyadas directamente por el contexto. No inventes páginas.
19. Para Le Chatelier, preferí ejemplos genéricos seguros como "A ⇌ B" o "Reactivos ⇌ Productos"; si usás una reacción real, debe estar balanceada o sin coeficientes específicos.
20. Para actividades estructuradas, basá las preguntas solo en el contenido del apunte recuperado.
21. Al final de tu respuesta, SIEMPRE incluí una sección con este marcador exacto, salvo cuando el modo pida JSON estricto:
FUENTES_JSON:[{"type":"note","label":"Tu apunte"},{"type":"web","label":"nombre_fuente","url":"https://..."}]
Incluí solo las fuentes que realmente usaste. Si no usaste fuentes web, incluí solo el apunte.
${activityInstruction ? `\n${activityInstruction}\n` : ""}

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

function answerModeInstruction(mode: StudyChatAnswerMode = "auto", count = 3): string {
  switch (mode) {
    case "explain":
      return "Modo de respuesta: Explicar. Priorizá una explicación clara y didáctica, conectando conceptos.";
    case "summary":
      return "Modo de respuesta: Resumir. Respondé breve, con las ideas centrales y sin extenderte de más.";
    case "example":
      return "Modo de respuesta: Dar ejemplo. Priorizá un ejemplo útil; si no está en el contexto, marcá 'Ejemplo ilustrativo:' y no cites página para ese ejemplo.";
    case "quiz":
      return "Modo de respuesta: Mini quiz. Generá 3 a 5 preguntas para practicar basadas en el contexto y, si ayuda, agregá respuestas esperadas breves.";
    case "true_false":
      return `Modo de respuesta: Verdadero/Falso. Generá una actividad de ${count} afirmaciones claras, mezclando verdaderas y falsas, basada solo en el contexto.`;
    case "multiple_choice":
      return `Modo de respuesta: Multiple choice. Generá una actividad de ${count} preguntas con 4 opciones cada una, una sola correcta y distractores plausibles no ambiguos.`;
    case "step_by_step":
      return "Modo de respuesta: Paso a paso. Descomponé la idea en pasos numerados y progresivos.";
    case "beginner":
      return "Modo de respuesta: Principiante. Usá lenguaje simple, definí términos y podés usar analogías suaves sin salirte del contexto.";
    case "auto":
    default:
      return "Modo de respuesta: Auto. Elegí el formato más útil según la pregunta del usuario.";
  }
}

function structuredActivityInstruction(mode: StudyChatAnswerMode = "auto"): string {
  if (!isStructuredActivityMode(mode)) return "";

  const schema = mode === "true_false"
    ? `ACTIVIDAD_JSON_ESTRICTA:
{
  "type": "true_false",
  "title": "Título breve",
  "questions": [
    {
      "id": "q1",
      "statement": "Afirmación basada en el contexto",
      "answer": true,
      "explanation": "Explicación breve apoyada en el contexto",
      "sourceLabel": "pág. 1-2"
    }
  ]
}`
    : `ACTIVIDAD_JSON_ESTRICTA:
{
  "type": "multiple_choice",
  "title": "Título breve",
  "questions": [
    {
      "id": "q1",
      "question": "Pregunta basada en el contexto",
      "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
      "correctOptionIndex": 0,
      "explanation": "Explicación breve apoyada en el contexto",
      "sourceLabel": "pág. 1-2"
    }
  ]
}`;

  return `${schema}
Reglas para ACTIVIDAD_JSON_ESTRICTA:
- Si el contexto alcanza, respondé únicamente con JSON válido, sin markdown, sin bloques de código y sin texto fuera del JSON.
- Generá como máximo 3 preguntas.
- No incluyas HTML.
- No inventes páginas: omití "sourceLabel" si no hay página en el contexto.
- Si no hay contexto suficiente para crear la actividad sin inventar, respondé texto plano breve explicando que falta contexto, no JSON inventado.
- Para este modo no agregues FUENTES_JSON dentro ni fuera del JSON.`;
}

function structuredSchema(mode: "true_false" | "multiple_choice"): string {
  return mode === "true_false"
    ? `{
  "type": "true_false",
  "title": "Título breve",
  "questions": [
    {
      "id": "q1",
      "statement": "Afirmación basada en el contexto",
      "answer": true,
      "explanation": "Explicación breve apoyada en el contexto",
      "sourceLabel": "pág. 1-2"
    }
  ]
}`
    : `{
  "type": "multiple_choice",
  "title": "Título breve",
  "questions": [
    {
      "id": "q1",
      "question": "Pregunta basada en el contexto",
      "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
      "correctOptionIndex": 0,
      "explanation": "Explicación breve apoyada en el contexto",
      "sourceLabel": "pág. 1-2"
    }
  ]
}`;
}

function buildStructuredActivityPrompt(
  userQuestion: string,
  noteContext: string,
  options: {
    mode: "true_false" | "multiple_choice";
    studyMetadata?: StudyMetadataContext;
    recentMessages?: Array<{ role: "user" | "assistant"; content: string }>;
    repair?: boolean;
    count?: number;
  }
): string {
  const { mode } = options;
  const count = options.count ?? 3;
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

  const repairBlock = options.repair
    ? "Tu respuesta anterior NO fue JSON válido. Devolvé EXCLUSIVAMENTE un objeto JSON válido con el formato pedido. Sin markdown. Sin texto extra.\n\n"
    : "";

  const optionsRule = mode === "multiple_choice"
    ? '- Cada pregunta debe tener exactamente 4 opciones y "correctOptionIndex" entre 0 y 3 (una sola correcta, distractores plausibles no ambiguos).'
    : '- Cada afirmación ("statement") debe tener un "answer" booleano (true o false), mezclando verdaderas y falsas.';

  return `Sos un asistente de estudio. Generá una actividad interactiva basada EXCLUSIVAMENTE en el contenido del apunte.

${repairBlock}${answerModeInstruction(mode, count)}

REGLAS DE SALIDA (ACTIVIDAD_JSON_ESTRICTA) — son obligatorias:
- Si el apunte alcanza, respondé únicamente con JSON válido, sin markdown, sin bloques de código y sin texto fuera del JSON.
- No uses markdown. No uses \`\`\`json. No agregues texto antes ni después del JSON.
- No expliques nada fuera del JSON. Para este modo no agregues FUENTES_JSON ni ningún otro marcador.
- Usá comillas dobles en todas las claves y strings. No uses trailing commas.
- Generá exactamente ${count} preguntas (no más de ${count}), basadas solo en el contenido del apunte.
${optionsRule}
- No inventes páginas: omití "sourceLabel" si el fragmento no trae página en su encabezado.
- Si el apunte no alcanza para crear la actividad sin inventar, respondé igual un JSON con "questions": [].

ESQUEMA EXACTO:
${structuredSchema(mode)}

${metadataBlock}${historyBlock}CONTENIDO DEL APUNTE:
${noteContext}

PEDIDO DEL USUARIO:
${userQuestion}

Respondé SOLO con el JSON:`;
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
