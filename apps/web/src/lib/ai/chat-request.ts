import { isExtractionAttempt } from "@/lib/ai/extraction-guard";

export interface ChatRequestBody {
  query?: string;
  resumeIds?: string[];
  apiKeyId?: string;
}

export type ChatRequestValidation =
  | { error: string; status: number }
  | { query: string; resumeIds: string[] | null; apiKeyId: string | undefined };

export const MAX_QUERY_LENGTH = 500;
export const MAX_RESUME_IDS = 10;

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

  return { query, resumeIds, apiKeyId: body.apiKeyId };
}
