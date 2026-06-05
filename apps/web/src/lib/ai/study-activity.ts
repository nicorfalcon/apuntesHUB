import type { StudyChatAnswerMode } from "@/lib/ai/chat-request";

const MAX_ACTIVITY_QUESTIONS = 3;
const MAX_TEXT_LENGTH = 500;
const MAX_TITLE_LENGTH = 120;
const MAX_SOURCE_LABEL_LENGTH = 60;
const MAX_OPTIONS = 4;

export type StudyActivity =
  | {
      type: "true_false";
      title: string;
      questions: {
        id: string;
        statement: string;
        answer: boolean;
        explanation: string;
        sourceLabel?: string;
      }[];
    }
  | {
      type: "multiple_choice";
      title: string;
      questions: {
        id: string;
        question: string;
        options: string[];
        correctOptionIndex: number;
        explanation: string;
        sourceLabel?: string;
      }[];
    };

export function isStructuredActivityMode(
  mode: StudyChatAnswerMode
): mode is "true_false" | "multiple_choice" {
  return mode === "true_false" || mode === "multiple_choice";
}

/** Texto de respuesta cuando el modelo "parece" haber intentado JSON pero falló. */
export function looksLikeJsonResponse(value: string): boolean {
  const text = value.trim();
  return text.startsWith("{") || text.startsWith("```");
}

/**
 * Fallback textual cuando no se pudo estructurar una actividad: ofrece preguntas
 * genéricas para practicar sin inventar contenido del apunte ni exponer JSON crudo.
 */
export const STRUCTURED_ACTIVITY_FALLBACK_TEXT =
  "No pude armar tarjetas interactivas válidas con este apunte, pero podés practicar con estas preguntas:\n\n" +
  "1. ¿Cuáles son las ideas o conceptos centrales de este tema según el apunte?\n" +
  "2. ¿Qué relaciones, diferencias o condiciones importantes menciona el apunte?\n" +
  "3. ¿Cómo explicarías este tema con tus propias palabras?";

/**
 * Extrae el primer objeto JSON balanceado embebido en un texto. Tolera prefijos
 * o sufijos (p. ej. "Aquí tienes:" antes, o un marcador después) y respeta las
 * llaves dentro de strings. No ejecuta nada: solo recorta un substring candidato.
 */
export function extractJsonObject(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}

function tryParse(candidate: string): unknown | undefined {
  try {
    return JSON.parse(candidate);
  } catch {
    return undefined;
  }
}

function cleanText(value: unknown, maxLength = MAX_TEXT_LENGTH): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim().slice(0, maxLength).trim();
  return text.length > 0 ? text : null;
}

function cleanSourceLabel(value: unknown): string | undefined {
  const label = cleanText(value, MAX_SOURCE_LABEL_LENGTH);
  if (!label) return undefined;
  return label;
}

function withGeneratedIds<T extends { id?: unknown }>(
  questions: T[],
  limit: number = MAX_ACTIVITY_QUESTIONS
): Array<T & { safeId: string }> {
  return questions.slice(0, limit).map((question, index) => ({
    ...question,
    safeId: cleanText(question.id, 40) ?? `q${index + 1}`,
  }));
}

function parseJsonCandidate(rawText: string): unknown | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  // 1. JSON puro.
  const direct = tryParse(trimmed);
  if (direct !== undefined) return direct;

  // 2. JSON dentro de un bloque ```json ... ``` (aunque haya texto alrededor).
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    const parsed = tryParse(fenced[1].trim());
    if (parsed !== undefined) return parsed;
  }

  // 3. Objeto JSON balanceado embebido entre texto antes/después.
  const extracted = extractJsonObject(trimmed);
  if (extracted) {
    const parsed = tryParse(extracted);
    if (parsed !== undefined) return parsed;
  }

  return null;
}

export function parseStudyActivity(
  rawText: string,
  expectedMode: "true_false" | "multiple_choice",
  maxQuestions: number = MAX_ACTIVITY_QUESTIONS
): StudyActivity | null {
  const parsed = parseJsonCandidate(rawText);
  if (!parsed || typeof parsed !== "object") return null;

  const activity = "activity" in parsed
    ? (parsed as { activity?: unknown }).activity
    : parsed;
  if (!activity || typeof activity !== "object") return null;

  const record = activity as Record<string, unknown>;
  if (record.type !== expectedMode) return null;

  const title = cleanText(record.title, MAX_TITLE_LENGTH);
  if (!title || !Array.isArray(record.questions)) return null;

  if (expectedMode === "true_false") {
    const questions = withGeneratedIds(record.questions as Array<Record<string, unknown>>, maxQuestions)
      .map((question) => {
        const statement = cleanText(question.statement);
        const explanation = cleanText(question.explanation);
        if (!statement || typeof question.answer !== "boolean" || !explanation) {
          return null;
        }

        return {
          id: question.safeId,
          statement,
          answer: question.answer,
          explanation,
          sourceLabel: cleanSourceLabel(question.sourceLabel),
        };
      })
      .filter((question): question is NonNullable<typeof question> => Boolean(question));

    return questions.length > 0
      ? { type: "true_false", title, questions }
      : null;
  }

  const questions = withGeneratedIds(record.questions as Array<Record<string, unknown>>, maxQuestions)
    .map((question) => {
      const prompt = cleanText(question.question);
      const explanation = cleanText(question.explanation);
      const options = Array.isArray(question.options)
        ? question.options
            .map((option) => cleanText(option, 160))
            .filter((option): option is string => Boolean(option))
            .slice(0, MAX_OPTIONS)
        : [];

      if (
        !prompt ||
        !explanation ||
        options.length !== MAX_OPTIONS ||
        typeof question.correctOptionIndex !== "number" ||
        !Number.isInteger(question.correctOptionIndex) ||
        question.correctOptionIndex < 0 ||
        question.correctOptionIndex >= options.length
      ) {
        return null;
      }

      return {
        id: question.safeId,
        question: prompt,
        options,
        correctOptionIndex: question.correctOptionIndex,
        explanation,
        sourceLabel: cleanSourceLabel(question.sourceLabel),
      };
    })
    .filter((question): question is NonNullable<typeof question> => Boolean(question));

  return questions.length > 0
    ? { type: "multiple_choice", title, questions }
    : null;
}
