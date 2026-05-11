import { describe, it, expect } from "vitest";
import { checkRateLimit } from "../rate-limit";

// Cada test usa una key única para evitar estado compartido entre tests
let keyCounter = 0;
function uniqueKey(prefix = "test") {
  return `${prefix}:${++keyCounter}`;
}

describe("checkRateLimit", () => {
  it("permite la primera solicitud y devuelve remaining = limit - 1", () => {
    const result = checkRateLimit(uniqueKey(), 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("permite solicitudes hasta alcanzar el límite", () => {
    const key = uniqueKey();
    const limit = 3;
    for (let i = 0; i < limit; i++) {
      const r = checkRateLimit(key, limit, 60_000);
      expect(r.allowed).toBe(true);
    }
  });

  it("bloquea la solicitud cuando se supera el límite", () => {
    const key = uniqueKey();
    const limit = 2;
    checkRateLimit(key, limit, 60_000);
    checkRateLimit(key, limit, 60_000);
    const blocked = checkRateLimit(key, limit, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resetAt está en el futuro", () => {
    const before = Date.now();
    const result = checkRateLimit(uniqueKey(), 5, 60_000);
    expect(result.resetAt).toBeGreaterThan(before);
  });

  it("keys distintas no se interfieren entre sí", () => {
    const keyA = uniqueKey("userA");
    const keyB = uniqueKey("userB");
    const limit = 1;
    checkRateLimit(keyA, limit, 60_000);
    const blockedA = checkRateLimit(keyA, limit, 60_000);
    const allowedB = checkRateLimit(keyB, limit, 60_000);
    expect(blockedA.allowed).toBe(false);
    expect(allowedB.allowed).toBe(true);
  });

  it("reinicia el contador cuando expira la ventana", () => {
    const key = uniqueKey();
    const limit = 1;
    // Ventana de 1ms — expira inmediatamente
    checkRateLimit(key, limit, 1);
    // Esperar que expire
    const start = Date.now();
    while (Date.now() - start < 5) { /* spin */ }
    const result = checkRateLimit(key, limit, 60_000);
    expect(result.allowed).toBe(true);
  });
});
