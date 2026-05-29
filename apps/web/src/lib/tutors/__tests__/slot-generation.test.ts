import { describe, it, expect } from "vitest";
import {
  generateSlots,
  validateSlotRequest,
  type AvailabilityWindow,
  type Interval,
} from "../slot-generation";

// Anclas: 2026-05-25 es lunes (day_of_week 1). Argentina es UTC-3 fijo, así que
// las 10:00 ART de ese día son las 13:00 UTC. Trabajamos con un "ahora" muy
// anterior (now=0) para que el filtro de "1h en el futuro" no descarte slots,
// salvo en el test que lo prueba explícitamente.
const LUNES = "2026-05-25";
const NOW_LEJANO = 0; // 1970 — todo el rango 2026 está "en el futuro"

// Helper: epoch ms de una hora ART en una fecha dada.
function artMs(ymd: string, time: string): number {
  return new Date(`${ymd}T${time}:00-03:00`).getTime();
}

function ventana(
  overrides: Partial<AvailabilityWindow> = {}
): AvailabilityWindow {
  return {
    day_of_week: 1, // lunes
    start_time: "10:00",
    end_time: "12:00",
    modality: "online",
    ...overrides,
  };
}

describe("generateSlots", () => {
  it("genera slots cada 30 min dentro de la ventana, respetando la duración", () => {
    // given: ventana 10:00-12:00, slots de 60 min
    // when
    const slots = generateSlots({
      dateStrings: [LUNES],
      availability: [ventana()],
      occupiedIntervals: [],
      blockedIntervals: [],
      durationMinutes: 60,
      now: NOW_LEJANO,
    });

    // then: arranques a 10:00, 10:30, 11:00 (11:30+60=12:30 se pasa de las 12:00)
    expect(slots.map((s) => s.start)).toEqual([
      new Date(artMs(LUNES, "10:00")).toISOString(),
      new Date(artMs(LUNES, "10:30")).toISOString(),
      new Date(artMs(LUNES, "11:00")).toISOString(),
    ]);
    expect(slots[0].day_of_week).toBe(1);
  });

  it("no genera slots para días sin disponibilidad en ese day_of_week", () => {
    // given: disponibilidad es para lunes (1), pero pedimos un martes
    const martes = "2026-05-26";

    // when
    const slots = generateSlots({
      dateStrings: [martes],
      availability: [ventana({ day_of_week: 1 })],
      occupiedIntervals: [],
      blockedIntervals: [],
      durationMinutes: 60,
      now: NOW_LEJANO,
    });

    // then
    expect(slots).toEqual([]);
  });

  it("excluye los slots con menos de 1 hora de anticipación", () => {
    // given: "ahora" son las 10:00 ART del lunes; el mínimo futuro es 11:00.
    const now = artMs(LUNES, "10:00");

    // when
    const slots = generateSlots({
      dateStrings: [LUNES],
      availability: [ventana()], // 10:00-12:00
      occupiedIntervals: [],
      blockedIntervals: [],
      durationMinutes: 60,
      now,
    });

    // then: solo el de 11:00 queda (10:00 y 10:30 caen antes del mínimo futuro)
    expect(slots.map((s) => s.start)).toEqual([
      new Date(artMs(LUNES, "11:00")).toISOString(),
    ]);
  });

  it("excluye slots que se solapan con un booking ocupado", () => {
    // given: booking ocupado de 10:00 a 11:00
    const occupied: Interval[] = [
      { start: artMs(LUNES, "10:00"), end: artMs(LUNES, "11:00") },
    ];

    // when
    const slots = generateSlots({
      dateStrings: [LUNES],
      availability: [ventana()],
      occupiedIntervals: occupied,
      blockedIntervals: [],
      durationMinutes: 60,
      now: NOW_LEJANO,
    });

    // then: 10:00 y 10:30 solapan; sobrevive 11:00
    expect(slots.map((s) => s.start)).toEqual([
      new Date(artMs(LUNES, "11:00")).toISOString(),
    ]);
  });

  it("excluye slots que se solapan con un bloqueo del tutor", () => {
    // given: bloqueo de 11:00 a 12:00
    const blocked: Interval[] = [
      { start: artMs(LUNES, "11:00"), end: artMs(LUNES, "12:00") },
    ];

    // when
    const slots = generateSlots({
      dateStrings: [LUNES],
      availability: [ventana()],
      occupiedIntervals: [],
      blockedIntervals: blocked,
      durationMinutes: 60,
      now: NOW_LEJANO,
    });

    // then: solo el slot 10:00-11:00 sobrevive. El de 10:30 termina 11:30 y el
    // de 11:00 termina 12:00; ambos solapan con el bloqueo 11:00-12:00.
    expect(slots.map((s) => s.start)).toEqual([
      new Date(artMs(LUNES, "10:00")).toISOString(),
    ]);
  });

  it("filtra por modalidad: con 'presencial' descarta ventanas 'online'", () => {
    // given: ventana online + ventana presencial el mismo día
    const slots = generateSlots({
      dateStrings: [LUNES],
      availability: [
        ventana({ start_time: "10:00", end_time: "11:00", modality: "online" }),
        ventana({ start_time: "15:00", end_time: "16:00", modality: "presencial" }),
      ],
      occupiedIntervals: [],
      blockedIntervals: [],
      durationMinutes: 60,
      now: NOW_LEJANO,
      modality: "presencial",
    });

    // then: solo el slot de 15:00 (presencial)
    expect(slots.map((s) => s.start)).toEqual([
      new Date(artMs(LUNES, "15:00")).toISOString(),
    ]);
  });

  it("con modalidad 'ambas' incluye ventanas de cualquier modalidad", () => {
    const slots = generateSlots({
      dateStrings: [LUNES],
      availability: [
        ventana({ start_time: "10:00", end_time: "11:00", modality: "online" }),
        ventana({ start_time: "15:00", end_time: "16:00", modality: "presencial" }),
      ],
      occupiedIntervals: [],
      blockedIntervals: [],
      durationMinutes: 60,
      now: NOW_LEJANO,
      modality: "ambas",
    });

    expect(slots).toHaveLength(2);
  });
});

describe("validateSlotRequest", () => {
  it("acepta una solicitud válida y devuelve las fechas del rango", () => {
    // when
    const result = validateSlotRequest({
      durationMinutes: 60,
      dateFrom: "2026-05-25",
      dateTo: "2026-05-27",
    });

    // then
    expect(result).toEqual({
      dateStrings: ["2026-05-25", "2026-05-26", "2026-05-27"],
    });
  });

  it("rechaza una duración no permitida", () => {
    const result = validateSlotRequest({
      durationMinutes: 45,
      dateFrom: "2026-05-25",
      dateTo: "2026-05-25",
    });
    expect(result).toEqual({
      error: "La duración debe ser 30, 60, 90 o 120 minutos",
    });
  });

  it("rechaza un formato de fecha inválido antes de generar el rango", () => {
    const result = validateSlotRequest({
      durationMinutes: 60,
      dateFrom: "25-05-2026",
      dateTo: "2026-05-27",
    });
    expect(result).toEqual({
      error: "Formato de fecha inválido. Usar YYYY-MM-DD.",
    });
  });

  it("rechaza un rango mayor a 14 días", () => {
    const result = validateSlotRequest({
      durationMinutes: 60,
      dateFrom: "2026-05-01",
      dateTo: "2026-05-20", // 20 días
    });
    expect(result).toEqual({ error: "El rango no puede superar 14 días" });
  });

  it("rechaza un rango invertido (longitud cero)", () => {
    const result = validateSlotRequest({
      durationMinutes: 60,
      dateFrom: "2026-05-27",
      dateTo: "2026-05-25",
    });
    expect(result).toEqual({ error: "El rango no puede superar 14 días" });
  });
});
