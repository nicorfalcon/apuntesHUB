import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import { validateSignature } from "../webhook-signature";

// validateSignature lee process.env.MP_WEBHOOK_SECRET (dependencia externa:
// entorno). Usamos un STUB con vi.stubEnv para fijar un secreto conocido.
const SECRET = "mp-webhook-secret-de-prueba";

// Helper: arma un header x-signature válido para un manifest dado, calculando
// el HMAC igual que lo hace Mercado Pago.
function firmaValida(dataId: string, requestId: string, ts: string): string {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const hash = crypto.createHmac("sha256", SECRET).update(manifest).digest("hex");
  return `ts=${ts},v1=${hash}`;
}

describe("validateSignature", () => {
  const DATA_ID = "1234567890";
  const REQUEST_ID = "req-abc";
  const TS = "1700000000";

  beforeEach(() => {
    vi.stubEnv("MP_WEBHOOK_SECRET", SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("acepta una firma HMAC válida", () => {
    // given
    const xSignature = firmaValida(DATA_ID, REQUEST_ID, TS);

    // when / then
    expect(validateSignature(xSignature, REQUEST_ID, DATA_ID)).toBe(true);
  });

  it("rechaza una firma con un hash incorrecto (misma longitud)", () => {
    // given: un hash hex válido pero que no corresponde al manifest
    const hashFalso = "f".repeat(64);
    const xSignature = `ts=${TS},v1=${hashFalso}`;

    // when / then
    expect(validateSignature(xSignature, REQUEST_ID, DATA_ID)).toBe(false);
  });

  it("rechaza cuando falta el componente ts o v1 del header", () => {
    expect(validateSignature(`v1=${"a".repeat(64)}`, REQUEST_ID, DATA_ID)).toBe(false);
    expect(validateSignature(`ts=${TS}`, REQUEST_ID, DATA_ID)).toBe(false);
  });

  it("rechaza cuando cambia el data.id (manifest distinto)", () => {
    // given: firma calculada para DATA_ID pero validada contra otro id
    const xSignature = firmaValida(DATA_ID, REQUEST_ID, TS);

    // when / then
    expect(validateSignature(xSignature, REQUEST_ID, "otro-id")).toBe(false);
  });

  it("rechaza cuando el secreto no está configurado", () => {
    // given
    vi.stubEnv("MP_WEBHOOK_SECRET", "");
    delete process.env.MP_WEBHOOK_SECRET;
    const xSignature = `ts=${TS},v1=${"a".repeat(64)}`;

    // when / then
    expect(validateSignature(xSignature, REQUEST_ID, DATA_ID)).toBe(false);
  });
});
