import { describe, it, expect } from "vitest";
import {
  AiIngestionError,
  classifyAiIngestionError,
  AI_INGESTION_USER_MESSAGES,
} from "../ingestion-errors";

describe("classifyAiIngestionError", () => {
  it("HTTP 429 -> COHERE_RATE_LIMIT, retryable true", () => {
    const r = classifyAiIngestionError({ statusCode: 429, message: "Too Many Requests" });
    expect(r.code).toBe("COHERE_RATE_LIMIT");
    expect(r.retryable).toBe(true);
    expect(r.statusCode).toBe(429);
    expect(r.userMessage).toBe(AI_INGESTION_USER_MESSAGES.COHERE_RATE_LIMIT);
  });

  it("mensaje 'rate limit' sin status -> COHERE_RATE_LIMIT", () => {
    const r = classifyAiIngestionError(new Error("You are being rate limited"));
    expect(r.code).toBe("COHERE_RATE_LIMIT");
    expect(r.retryable).toBe(true);
  });

  it("HTTP 401 -> COHERE_AUTH_ERROR, retryable false", () => {
    const r = classifyAiIngestionError({ statusCode: 401, message: "Unauthorized" });
    expect(r.code).toBe("COHERE_AUTH_ERROR");
    expect(r.retryable).toBe(false);
  });

  it("HTTP 403 -> COHERE_AUTH_ERROR", () => {
    const r = classifyAiIngestionError({ status: 403, message: "Forbidden" });
    expect(r.code).toBe("COHERE_AUTH_ERROR");
    expect(r.retryable).toBe(false);
  });

  it("mensaje de quota -> COHERE_QUOTA_EXCEEDED, retryable false", () => {
    const r = classifyAiIngestionError(new Error("You have exceeded your monthly quota"));
    expect(r.code).toBe("COHERE_QUOTA_EXCEEDED");
    expect(r.retryable).toBe(false);
  });

  it("timeout por nombre -> COHERE_TIMEOUT, retryable true", () => {
    const err = new Error("request timed out");
    err.name = "CohereTimeoutError";
    const r = classifyAiIngestionError(err);
    expect(r.code).toBe("COHERE_TIMEOUT");
    expect(r.retryable).toBe(true);
    expect(r.statusCode).toBe(504);
  });

  it("error de red (ECONNRESET) -> COHERE_TIMEOUT", () => {
    const r = classifyAiIngestionError(new Error("read ECONNRESET"));
    expect(r.code).toBe("COHERE_TIMEOUT");
  });

  it("HTTP 500 del proveedor -> EMBEDDING_PROVIDER_ERROR, retryable true", () => {
    const r = classifyAiIngestionError({ statusCode: 503, message: "Service Unavailable" });
    expect(r.code).toBe("EMBEDDING_PROVIDER_ERROR");
    expect(r.retryable).toBe(true);
  });

  it("error desconocido -> UNKNOWN_ERROR, retryable false", () => {
    const r = classifyAiIngestionError(new Error("algo raro pasó"));
    expect(r.code).toBe("UNKNOWN_ERROR");
    expect(r.retryable).toBe(false);
    expect(r.statusCode).toBe(500);
  });

  it("respeta el código de un AiIngestionError ya tipado (PDF_NO_TEXT)", () => {
    const r = classifyAiIngestionError(
      new AiIngestionError("PDF_NO_TEXT", "El PDF no contiene texto extraíble")
    );
    expect(r.code).toBe("PDF_NO_TEXT");
    expect(r.retryable).toBe(false);
    expect(r.statusCode).toBe(422);
    expect(r.userMessage).toBe(AI_INGESTION_USER_MESSAGES.PDF_NO_TEXT);
  });

  it("DB_REINGEST_ERROR es retryable y status 500", () => {
    const r = classifyAiIngestionError(new AiIngestionError("DB_REINGEST_ERROR"));
    expect(r.code).toBe("DB_REINGEST_ERROR");
    expect(r.retryable).toBe(true);
    expect(r.statusCode).toBe(500);
  });

  it("acota el mensaje técnico a 500 chars (no vuelca contenido enorme)", () => {
    const r = classifyAiIngestionError(new Error("x".repeat(5000)));
    expect(r.message.length).toBeLessThanOrEqual(500);
  });

  it("AiIngestionError usa retryable por defecto del código si no se pasa", () => {
    expect(new AiIngestionError("COHERE_RATE_LIMIT").retryable).toBe(true);
    expect(new AiIngestionError("PDF_NO_TEXT").retryable).toBe(false);
  });
});
