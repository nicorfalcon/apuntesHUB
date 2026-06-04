import { isExtractionAttempt } from "@/lib/ai/extraction-guard";

export interface ChatRequestBody {
  query?: string;
  resumeIds?: string[];
  apiKeyId?: string;
  messages?: Array<{ role?: unknown; content?: unknown }>;
  resumeTitle?: string;
  subject?: string;
  topics?: unknown;
}

export type ChatRequestValidation =
  | { error: string; status: number }
  | {
      query: string;
      resumeIds: string[] | null;
      apiKeyId: string | undefined;
      messages: Array<{ role: "user" | "assistant"; content: string }>;
      resumeTitle: string | null;
      subject: string | null;
      topics: string[];
    };

export const MAX_QUERY_LENGTH = 500;
export const MAX_RESUME_IDS = 10;
const MAX_CHAT_HISTORY_MESSAGES = 6;
const MAX_CHAT_HISTORY_MESSAGE_LENGTH = 1_000;
const MAX_CHAT_CONTEXT_FIELD_LENGTH = 120;
const MAX_CHAT_TOPICS = 12;
const MAX_CHAT_TOPIC_LENGTH = 80;

/**
 * Valida el body de una solicitud al chat de IA. Devuelve `{ error, status }`
 * con el mensaje y código HTTP si algo es inválido, o los campos normalizados
 * (`query` recortada, `resumeIds` normalizado a null si vacío) si es válido.
 *
 * Pura salvo por isExtractionAttempt, que también es pura (regex). El handler se
 * encarga de auth, rate-limit y la I/O; acá solo vive la validación del input.
 */
export function validateChatRequest(
  body: ChatRequestBody
): ChatRequestValidation {
  const query = (body.query ?? "").trim();

  if (!query) {
    return { error: "El campo query es requerido", status: 400 };
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return { error: "La pregunta es demasiado larga.", status: 400 };
  }
  if (isExtractionAttempt(query)) {
    return {
      error: "Solo puedo responder preguntas específicas sobre el contenido.",
      status: 400,
    };
  }
  if (body.resumeIds && body.resumeIds.length > MAX_RESUME_IDS) {
    return { error: "Demasiados apuntes seleccionados.", status: 400 };
  }

  const resumeIds =
    body.resumeIds && body.resumeIds.length > 0 ? body.resumeIds : null;
  const messages = Array.isArray(body.messages)
    ? body.messages
        .filter((message): message is { role: "user" | "assistant"; content: string } =>
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string" &&
          message.content.trim().length > 0
        )
        .slice(-MAX_CHAT_HISTORY_MESSAGES)
        .map((message) => ({
          role: message.role,
          content: message.content.trim().slice(0, MAX_CHAT_HISTORY_MESSAGE_LENGTH),
        }))
    : [];
  const resumeTitle = typeof body.resumeTitle === "string"
    ? body.resumeTitle.trim().slice(0, MAX_CHAT_CONTEXT_FIELD_LENGTH) || null
    : null;
  const subject = typeof body.subject === "string"
    ? body.subject.trim().slice(0, MAX_CHAT_CONTEXT_FIELD_LENGTH) || null
    : null;
  const topics = Array.isArray(body.topics)
    ? Array.from(
        new Set(
          body.topics
            .filter((topic): topic is string => typeof topic === "string")
            .map((topic) => topic.trim().slice(0, MAX_CHAT_TOPIC_LENGTH))
            .filter(Boolean)
        )
      ).slice(0, MAX_CHAT_TOPICS)
    : [];

  return {
    query,
    resumeIds,
    apiKeyId: body.apiKeyId,
    messages,
    resumeTitle,
    subject,
    topics,
  };
}
