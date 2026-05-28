import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { formatRelative } from "../format-relative";

// formatRelative compara contra Date.now(). Si dejáramos el reloj real, el
// resultado cambiaría según el día en que se corra el test (no determinístico).
// Por eso congelamos el tiempo con fake timers en un instante fijo.
const NOW = new Date("2026-05-28T12:00:00Z");

// Helper: devuelve el ISO de una fecha N días antes del "ahora" congelado.
function diasAtras(n: number): string {
  return new Date(NOW.getTime() - n * 86_400_000).toISOString();
}

describe("formatRelative", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("devuelve 'hoy' cuando la fecha es de hace menos de un día", () => {
    // given: hace 2 horas
    const iso = new Date(NOW.getTime() - 2 * 3_600_000).toISOString();

    // when / then
    expect(formatRelative(iso)).toBe("hoy");
  });

  it("devuelve 'ayer' cuando la fecha es de hace exactamente un día", () => {
    expect(formatRelative(diasAtras(1))).toBe("ayer");
  });

  it("devuelve los días cuando es de hace menos de una semana", () => {
    expect(formatRelative(diasAtras(3))).toBe("hace 3 días");
  });

  it("devuelve semanas cuando es de hace entre 7 y 29 días", () => {
    expect(formatRelative(diasAtras(7))).toBe("hace 1 sem");
    expect(formatRelative(diasAtras(20))).toBe("hace 2 sem");
  });

  it("devuelve meses cuando es de hace entre 30 y 364 días", () => {
    expect(formatRelative(diasAtras(70))).toBe("hace 2 meses");
  });

  it("usa el singular 'año' cuando pasó exactamente un año", () => {
    expect(formatRelative(diasAtras(365))).toBe("hace 1 año");
  });

  it("usa el plural 'años' cuando pasó más de un año", () => {
    expect(formatRelative(diasAtras(800))).toBe("hace 2 años");
  });

  it("devuelve 'hoy' para una fecha en el futuro (diferencia negativa)", () => {
    // given: 2 días en el futuro respecto del ahora congelado
    const futuro = new Date(NOW.getTime() + 2 * 86_400_000).toISOString();

    // when / then
    expect(formatRelative(futuro)).toBe("hoy");
  });
});
