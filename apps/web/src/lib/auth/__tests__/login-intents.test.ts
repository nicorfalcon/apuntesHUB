import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createLoginIntentToken,
  verifyLoginIntentToken,
  encryptPendingLoginSession,
  decryptPendingLoginSession,
  type LoginIntentClaims,
  type PendingLoginSession,
} from "../login-intents";

// Dos dependencias externas a controlar:
//  - process.env.LOGIN_INTENT_SECRET  -> STUB con vi.stubEnv
//  - Date.now() (para el chequeo de expiración) -> fake timers
const SECRET = "login-intent-secret-de-mas-de-32-caracteres";
const NOW = new Date("2026-05-28T12:00:00Z");

function nowSeconds(): number {
  return Math.floor(NOW.getTime() / 1000);
}

function validClaims(overrides: Partial<LoginIntentClaims> = {}): LoginIntentClaims {
  return {
    jti: "intent-1",
    sub: "user-123",
    purpose: "device_picker",
    exp: nowSeconds() + 3600,
    ...overrides,
  };
}

describe("login-intents", () => {
  beforeEach(() => {
    vi.stubEnv("LOGIN_INTENT_SECRET", SECRET);
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  describe("createLoginIntentToken / verifyLoginIntentToken", () => {
    it("verifica correctamente un token recién creado y devuelve sus claims", () => {
      // given
      const claims = validClaims();

      // when
      const token = createLoginIntentToken(claims);
      const verified = verifyLoginIntentToken(token);

      // then
      expect(verified).toEqual(claims);
    });

    it("genera un token con tres partes separadas por punto (header.payload.firma)", () => {
      // when
      const token = createLoginIntentToken(validClaims());

      // then
      expect(token.split(".")).toHaveLength(3);
    });

    it("rechaza un token cuya firma fue alterada", () => {
      // given: cambiamos el último carácter de la firma
      const token = createLoginIntentToken(validClaims());
      const alterado = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");

      // when / then
      expect(() => verifyLoginIntentToken(alterado)).toThrow("intent_invalid");
    });

    it("rechaza un token con un número de partes inválido", () => {
      expect(() => verifyLoginIntentToken("solo.dos")).toThrow("intent_invalid");
    });

    it("rechaza un token cuyo propósito no es 'device_picker'", () => {
      // given: forzamos un purpose inválido (casteo para saltar el tipo)
      const token = createLoginIntentToken(
        validClaims({ purpose: "otra_cosa" as LoginIntentClaims["purpose"] })
      );

      // when / then
      expect(() => verifyLoginIntentToken(token)).toThrow("intent_invalid");
    });

    it("rechaza un token expirado cuando el reloj avanza más allá de exp", () => {
      // given: token que expira en 10 segundos
      const token = createLoginIntentToken(validClaims({ exp: nowSeconds() + 10 }));

      // when: avanzamos el reloj 20 segundos (pasa la expiración)
      vi.setSystemTime(new Date(NOW.getTime() + 20_000));

      // then
      expect(() => verifyLoginIntentToken(token)).toThrow("intent_expired");
    });
  });

  describe("encryptPendingLoginSession / decryptPendingLoginSession", () => {
    const session: PendingLoginSession = {
      accessToken: "access-abc",
      refreshToken: "refresh-xyz",
      sessionId: "sess-1",
      cookiesToSet: [],
    };

    it("desencripta a la misma sesión que se encriptó (round-trip)", () => {
      // when
      const ciphertext = encryptPendingLoginSession(session);
      const result = decryptPendingLoginSession(ciphertext);

      // then
      expect(result).toEqual(session);
    });

    it("produce un ciphertext con el prefijo de versión v1", () => {
      // when
      const ciphertext = encryptPendingLoginSession(session);

      // then
      expect(ciphertext.startsWith("v1.")).toBe(true);
    });

    it("rechaza un ciphertext con versión desconocida", () => {
      expect(() => decryptPendingLoginSession("v2.a.b.c")).toThrow("intent_invalid");
    });
  });
});
