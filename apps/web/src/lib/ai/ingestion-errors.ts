// Clasificación y normalización de errores de ingesta IA (M3.5).
//
// Objetivo: convertir cualquier error (Cohere, PDF, DB, etc.) en un código
// estable + mensaje técnico para logs/admin + mensaje seguro para la UI +
// si conviene reintentar. ISOMÓRFICO: no importa nada server-only, así que
// tanto la ruta (server) como los componentes (client) pueden usar los códigos
// y los mensajes de usuario desde una única fuente de verdad.

export type AiIngestionErrorCode =
  | "COHERE_RATE_LIMIT"
  | "COHERE_AUTH_ERROR"
  | "COHERE_QUOTA_EXCEEDED"
  | "COHERE_TIMEOUT"
  | "EMBEDDING_PROVIDER_ERROR"
  | "PDF_DOWNLOAD_ERROR"
  | "PDF_EXTRACTION_ERROR"
  | "PDF_NO_TEXT"
  | "PDF_TOO_LARGE"
  | "CHUNKING_ERROR"
  | "CHUNKS_EMPTY"
  | "DB_REINGEST_ERROR"
  | "PERMISSION_DENIED"
  | "UNKNOWN_ERROR";

export interface ClassifiedAiError {
  /** Código estable para filtrar/diagnosticar. */
  code: AiIngestionErrorCode;
  /** Mensaje técnico resumido para logs/admin (sin contenido sensible). */
  message: string;
  /** Si conviene reintentar el procesamiento. */
  retryable: boolean;
  /** Mensaje seguro y entendible para la UI. */
  userMessage: string;
  /** Status HTTP sugerido para la respuesta del endpoint. */
  statusCode: number;
}

// Mensajes para la UI (fuente única, importable también desde el cliente).
export const AI_INGESTION_USER_MESSAGES: Record<AiIngestionErrorCode, string> = {
  COHERE_RATE_LIMIT:
    "El proveedor de IA recibió demasiadas solicitudes. Probá reintentar en unos minutos.",
  COHERE_AUTH_ERROR:
    "Hay un problema de configuración con el proveedor de IA. Avisanos para revisarlo.",
  COHERE_QUOTA_EXCEEDED:
    "Se agotó la cuota del proveedor de IA. Intentá más tarde o contactanos.",
  COHERE_TIMEOUT:
    "El proveedor de IA tardó demasiado en responder. Probá reintentar en unos minutos.",
  EMBEDDING_PROVIDER_ERROR:
    "El proveedor de IA tuvo un error temporal. Probá reintentar en unos minutos.",
  PDF_DOWNLOAD_ERROR: "No pudimos descargar el archivo del apunte. Probá reintentar.",
  PDF_EXTRACTION_ERROR:
    "No pudimos leer el contenido del PDF. Puede estar dañado o protegido.",
  PDF_NO_TEXT:
    "No pudimos leer texto del PDF. Puede ser un escaneo o imágenes (todavía no procesamos eso).",
  PDF_TOO_LARGE: "El PDF es demasiado grande para procesarlo con IA.",
  CHUNKING_ERROR: "Ocurrió un error preparando el contenido del apunte.",
  CHUNKS_EMPTY: "No encontramos contenido procesable en el PDF.",
  DB_REINGEST_ERROR:
    "Se generó el contenido, pero falló guardarlo. Podés reintentar.",
  PERMISSION_DENIED: "No tenés permisos para procesar este apunte.",
  UNKNOWN_ERROR: "Ocurrió un error inesperado procesando la IA.",
};

const RETRYABLE: Record<AiIngestionErrorCode, boolean> = {
  COHERE_RATE_LIMIT: true,
  COHERE_AUTH_ERROR: false,
  COHERE_QUOTA_EXCEEDED: false,
  COHERE_TIMEOUT: true,
  EMBEDDING_PROVIDER_ERROR: true,
  PDF_DOWNLOAD_ERROR: true,
  PDF_EXTRACTION_ERROR: false,
  PDF_NO_TEXT: false,
  PDF_TOO_LARGE: false,
  CHUNKING_ERROR: false,
  CHUNKS_EMPTY: false,
  DB_REINGEST_ERROR: true,
  PERMISSION_DENIED: false,
  UNKNOWN_ERROR: false,
};

const STATUS_BY_CODE: Record<AiIngestionErrorCode, number> = {
  COHERE_RATE_LIMIT: 429,
  COHERE_AUTH_ERROR: 502,
  COHERE_QUOTA_EXCEEDED: 502,
  COHERE_TIMEOUT: 504,
  EMBEDDING_PROVIDER_ERROR: 502,
  PDF_DOWNLOAD_ERROR: 502,
  PDF_EXTRACTION_ERROR: 422,
  PDF_NO_TEXT: 422,
  PDF_TOO_LARGE: 413,
  CHUNKING_ERROR: 500,
  CHUNKS_EMPTY: 422,
  DB_REINGEST_ERROR: 500,
  PERMISSION_DENIED: 403,
  UNKNOWN_ERROR: 500,
};

/**
 * Error tipado que la ruta de ingesta lanza en etapas deterministas
 * (descarga, extracción, chunking, DB) para arrastrar el código hasta el catch.
 */
export class AiIngestionError extends Error {
  readonly code: AiIngestionErrorCode;
  readonly retryable: boolean;

  constructor(code: AiIngestionErrorCode, message?: string, retryable?: boolean) {
    super(message ?? code);
    this.name = "AiIngestionError";
    this.code = code;
    this.retryable = retryable ?? RETRYABLE[code];
  }
}

function readStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const e = error as Record<string, unknown>;
  const candidates = [e.statusCode, e.status, e.code];
  for (const c of candidates) {
    if (typeof c === "number") return c;
    if (typeof c === "string" && /^\d+$/.test(c)) return Number(c);
  }
  return undefined;
}

function buildResult(
  code: AiIngestionErrorCode,
  message: string,
  retryable?: boolean
): ClassifiedAiError {
  return {
    code,
    message: message.slice(0, 500),
    retryable: retryable ?? RETRYABLE[code],
    userMessage: AI_INGESTION_USER_MESSAGES[code],
    statusCode: STATUS_BY_CODE[code],
  };
}

/**
 * Normaliza cualquier error a un ClassifiedAiError. Si ya es un
 * AiIngestionError, respeta su código. Para errores crudos de Cohere/red,
 * clasifica por statusCode + nombre + mensaje (sin depender de clases exactas).
 *
 * Importante: no incluye contenido de PDF/chunks/embeddings; solo el mensaje
 * técnico del error (acotado).
 */
export function classifyAiIngestionError(error: unknown): ClassifiedAiError {
  if (error instanceof AiIngestionError) {
    return buildResult(error.code, error.message, error.retryable);
  }

  const status = readStatus(error);
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name?: unknown }).name ?? "")
      : "";
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : String(error);
  const lower = rawMessage.toLowerCase();

  // 1. Timeout / red (puede no traer statusCode).
  if (
    name.includes("Timeout") ||
    /timeout|etimedout|econnreset|enotfound|fetch failed|network|aborterror|socket hang up/i.test(
      rawMessage
    )
  ) {
    return buildResult("COHERE_TIMEOUT", rawMessage);
  }

  // 2. Rate limit (429).
  if (status === 429 || /rate ?limit|too many requests/.test(lower)) {
    return buildResult("COHERE_RATE_LIMIT", rawMessage);
  }

  // 3. Auth (401/403 del proveedor, token inválido).
  if (
    status === 401 ||
    status === 403 ||
    /unauthor|forbidden|invalid (api ?key|token)|no api key/.test(lower)
  ) {
    return buildResult("COHERE_AUTH_ERROR", rawMessage);
  }

  // 4. Cuota / billing.
  if (/quota|billing|exceeded your|insufficient|payment required|trial/.test(lower)) {
    return buildResult("COHERE_QUOTA_EXCEEDED", rawMessage);
  }

  // 5. Error del proveedor (5xx o error reconocible de Cohere).
  if ((typeof status === "number" && status >= 500) || /cohere/i.test(name + rawMessage)) {
    return buildResult("EMBEDDING_PROVIDER_ERROR", rawMessage);
  }

  // 6. Desconocido.
  return buildResult("UNKNOWN_ERROR", rawMessage || "error desconocido");
}
