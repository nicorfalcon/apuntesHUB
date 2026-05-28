import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  addDaysYmd,
  getWeekStartYmd,
  getDayOfWeekYmd,
  generateDateRangeYmd,
  timeToArgentinaDate,
  formatDateInArgentina,
  getTodayYmd,
  formatTimeInArgentina,
} from "../timezone";

// Anclas de calendario conocidas y verificables:
// 2000-01-01 fue sábado, 2000-01-02 domingo, 2000-01-03 lunes.

describe("addDaysYmd", () => {
  it("suma un día dentro del mismo mes", () => {
    // when / then
    expect(addDaysYmd("2000-01-01", 1)).toBe("2000-01-02");
  });

  it("resta días devolviendo una fecha anterior", () => {
    expect(addDaysYmd("2000-01-01", -1)).toBe("1999-12-31");
  });

  it("cruza el borde de mes correctamente", () => {
    expect(addDaysYmd("2000-01-31", 1)).toBe("2000-02-01");
  });

  it("cruza el borde de año correctamente", () => {
    expect(addDaysYmd("2000-12-31", 1)).toBe("2001-01-01");
  });

  it("respeta el 29 de febrero en un año bisiesto", () => {
    expect(addDaysYmd("2020-02-28", 1)).toBe("2020-02-29");
  });

  it("devuelve la misma fecha cuando suma cero días", () => {
    expect(addDaysYmd("2000-01-01", 0)).toBe("2000-01-01");
  });
});

describe("getDayOfWeekYmd", () => {
  it.each([
    ["2000-01-01", 6], // sábado
    ["2000-01-02", 0], // domingo
    ["2000-01-03", 1], // lunes
  ])("devuelve %s -> %i (0=domingo)", (ymd, esperado) => {
    expect(getDayOfWeekYmd(ymd)).toBe(esperado);
  });
});

describe("getWeekStartYmd", () => {
  it("devuelve el lunes anterior cuando la fecha es un sábado", () => {
    // given: 2000-01-01 es sábado
    // when / then: el lunes de esa semana es 1999-12-27
    expect(getWeekStartYmd("2000-01-01")).toBe("1999-12-27");
  });

  it("trata el domingo como fin de semana (lunes de la semana previa)", () => {
    // given: 2000-01-02 es domingo
    expect(getWeekStartYmd("2000-01-02")).toBe("1999-12-27");
  });

  it("devuelve la misma fecha cuando ya es lunes (idempotente)", () => {
    // given: 2000-01-03 es lunes
    expect(getWeekStartYmd("2000-01-03")).toBe("2000-01-03");
  });

  it("el resultado siempre cae en lunes", () => {
    // when
    const inicio = getWeekStartYmd("2000-01-01");

    // then
    expect(getDayOfWeekYmd(inicio)).toBe(1);
  });
});

describe("generateDateRangeYmd", () => {
  it("genera el rango inclusivo entre dos fechas", () => {
    expect(generateDateRangeYmd("2000-01-01", "2000-01-03")).toEqual([
      "2000-01-01",
      "2000-01-02",
      "2000-01-03",
    ]);
  });

  it("devuelve un único elemento cuando desde y hasta son iguales", () => {
    expect(generateDateRangeYmd("2000-01-01", "2000-01-01")).toEqual([
      "2000-01-01",
    ]);
  });

  it("devuelve un array vacío cuando el rango está invertido", () => {
    expect(generateDateRangeYmd("2000-01-03", "2000-01-01")).toEqual([]);
  });
});

describe("timeToArgentinaDate", () => {
  it("interpreta la hora con offset -03:00 (Argentina)", () => {
    // given: 14:30 en Argentina son 17:30 UTC
    // when
    const date = timeToArgentinaDate("2000-01-01", "14:30");

    // then
    expect(date.toISOString()).toBe("2000-01-01T17:30:00.000Z");
  });

  it("acepta horas con segundos (HH:MM:SS) como las que devuelve la BD", () => {
    const date = timeToArgentinaDate("2000-01-01", "14:30:45");
    expect(date.toISOString()).toBe("2000-01-01T17:30:45.000Z");
  });

  it("rellena con ceros las horas y minutos de un solo dígito", () => {
    // given: "9:5" -> 09:05 -03:00 -> 12:05 UTC
    const date = timeToArgentinaDate("2000-01-01", "9:5");
    expect(date.toISOString()).toBe("2000-01-01T12:05:00.000Z");
  });
});

describe("formatDateInArgentina", () => {
  it("devuelve el mismo día cuando el instante UTC cae en horario diurno argentino", () => {
    // given: mediodía UTC = 09:00 en Argentina, mismo día
    const date = new Date("2000-01-01T12:00:00Z");

    // when / then
    expect(formatDateInArgentina(date)).toBe("2000-01-01");
  });

  it("devuelve el día anterior cuando el instante UTC cae de madrugada (UTC-3)", () => {
    // given: 02:00 UTC = 23:00 del día previo en Argentina
    const date = new Date("2000-01-01T02:00:00Z");

    // when / then
    expect(formatDateInArgentina(date)).toBe("1999-12-31");
  });
});

describe("getTodayYmd", () => {
  // Depende de new Date() (el "ahora" real), así que congelamos el reloj
  // con fake timers para que el resultado sea determinístico.
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("devuelve la fecha de hoy en Argentina cuando es horario diurno", () => {
    // given: mediodía UTC = 09:00 en Argentina, mismo día
    vi.setSystemTime(new Date("2026-05-28T12:00:00Z"));

    // when / then
    expect(getTodayYmd()).toBe("2026-05-28");
  });

  it("devuelve el día previo cuando en UTC ya cambió de día pero en Argentina no", () => {
    // given: 02:00 UTC = 23:00 del día anterior en Argentina
    vi.setSystemTime(new Date("2026-05-28T02:00:00Z"));

    // when / then
    expect(getTodayYmd()).toBe("2026-05-27");
  });
});

describe("formatTimeInArgentina", () => {
  it("formatea la hora del instante en horario argentino (HH:MM)", () => {
    // given: 12:00 UTC = 09:00 en Argentina
    const date = new Date("2026-05-28T12:00:00Z");

    // when / then
    expect(formatTimeInArgentina(date)).toBe("09:00");
  });

  it("aplica el offset -03:00 al convertir desde UTC", () => {
    // given: 02:30 UTC = 23:30 del día anterior en Argentina
    const date = new Date("2026-05-28T02:30:00Z");

    // when / then
    expect(formatTimeInArgentina(date)).toBe("23:30");
  });
});
