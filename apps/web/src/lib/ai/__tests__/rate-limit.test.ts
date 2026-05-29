import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkRateLimit, pruneExpiredEntries } from "../rate-limit";

// checkRateLimit depende de Date.now() (ventana de tiempo) y guarda el estado en
// un Map global del módulo. Dos consecuencias para los tests:
//  - Congelamos el reloj con fake timers para que la expiración sea determinística
//    (antes se usaba un busy-wait, que era lento y dependía del reloj real).
//  - Como el store es global y se comparte entre tests, usamos una key única por
//    test para aislarlos. Que haga falta este truco es indicio de que la unidad
//    sería más testeable si el store se inyectara en vez de ser global.
let keyCounter = 0;
function uniqueKey(prefix = "test") {
  return `${prefix}:${++keyCounter}`;
}

const NOW = new Date("2026-05-28T12:00:00Z");

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("permite la primera solicitud y devuelve remaining = limit - 1", () => {
    // when
    const result = checkRateLimit(uniqueKey(), 5, 60_000);

    // then
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("permite solicitudes hasta alcanzar el límite", () => {
    // given
    const key = uniqueKey();
    const limit = 3;

    // when / then
    for (let i = 0; i < limit; i++) {
      expect(checkRateLimit(key, limit, 60_000).allowed).toBe(true);
    }
  });

  it("bloquea la solicitud cuando se supera el límite", () => {
    // given: agotamos el límite de 2
    const key = uniqueKey();
    const limit = 2;
    checkRateLimit(key, limit, 60_000);
    checkRateLimit(key, limit, 60_000);

    // when
    const blocked = checkRateLimit(key, limit, 60_000);

    // then
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resetAt cae al final de la ventana (ahora + windowMs)", () => {
    // when
    const result = checkRateLimit(uniqueKey(), 5, 60_000);

    // then
    expect(result.resetAt).toBe(NOW.getTime() + 60_000);
  });

  it("keys distintas no se interfieren entre sí", () => {
    // given
    const keyA = uniqueKey("userA");
    const keyB = uniqueKey("userB");
    const limit = 1;

    // when: agotamos la key A
    checkRateLimit(keyA, limit, 60_000);
    const blockedA = checkRateLimit(keyA, limit, 60_000);
    const allowedB = checkRateLimit(keyB, limit, 60_000);

    // then: B sigue permitida pese a que A está bloqueada
    expect(blockedA.allowed).toBe(false);
    expect(allowedB.allowed).toBe(true);
  });

  it("reinicia el contador cuando la ventana expira", () => {
    // given: una key con límite 1, ya agotada
    const key = uniqueKey();
    const limit = 1;
    checkRateLimit(key, limit, 60_000);
    expect(checkRateLimit(key, limit, 60_000).allowed).toBe(false);

    // when: avanzamos el reloj más allá de la ventana
    vi.advanceTimersByTime(60_001);

    // then: vuelve a permitir
    expect(checkRateLimit(key, limit, 60_000).allowed).toBe(true);
  });

  it("no reinicia el contador justo en el borde de la ventana", () => {
    // given: la condición de reset es estricta (now > resetAt), así que en el
    // instante exacto del resetAt todavía no debe reiniciar.
    const key = uniqueKey();
    const limit = 1;
    checkRateLimit(key, limit, 60_000); // resetAt = NOW + 60_000

    // when: avanzamos exactamente hasta el borde
    vi.advanceTimersByTime(60_000);

    // then: sigue bloqueada (now === resetAt, no es > resetAt)
    expect(checkRateLimit(key, limit, 60_000).allowed).toBe(false);
  });
});

describe("pruneExpiredEntries", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("conserva las entradas cuya ventana sigue vigente", () => {
    // given: key agotada (limit 1), su ventana vence en NOW + 60s
    const key = uniqueKey();
    checkRateLimit(key, 1, 60_000);

    // when: limpiamos en un instante anterior a la expiración
    pruneExpiredEntries(NOW.getTime() + 30_000);

    // then: la entrada no se borró, la key sigue bloqueada
    expect(checkRateLimit(key, 1, 60_000).allowed).toBe(false);
  });

  it("borra las entradas cuya ventana ya expiró", () => {
    // given: key agotada (limit 1), su ventana vence en NOW + 60s
    const key = uniqueKey();
    checkRateLimit(key, 1, 60_000);

    // when: limpiamos en un instante posterior a la expiración
    pruneExpiredEntries(NOW.getTime() + 60_001);

    // then: la entrada se borró, una nueva solicitud arranca de cero
    const result = checkRateLimit(key, 1, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });
});
