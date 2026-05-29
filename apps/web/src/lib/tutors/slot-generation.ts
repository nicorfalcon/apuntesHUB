import {
  generateDateRangeYmd,
  getDayOfWeekYmd,
  timeToArgentinaDate,
} from "@/lib/timezone";

export interface AvailabilityWindow {
  day_of_week: number;
  start_time: string; // HH:MM (hora local ART)
  end_time: string; // HH:MM
  modality: string;
}

export interface Interval {
  start: number; // epoch ms
  end: number; // epoch ms
}

export interface ConcreteSlot {
  start: string; // ISO datetime (UTC)
  end: string; // ISO datetime (UTC)
  day_of_week: number;
}

export interface GenerateSlotsParams {
  dateStrings: string[]; // YYYY-MM-DD (fechas de calendario ART)
  availability: AvailabilityWindow[];
  occupiedIntervals: Interval[];
  blockedIntervals: Interval[];
  durationMinutes: number;
  now: number; // epoch ms (inyectado para determinismo)
  modality?: string;
}

const SLOT_STEP_MS = 30 * 60_000; // los slots arrancan cada 30 minutos
const MIN_FUTURE_MS = 60 * 60_000; // mínimo 1 hora de anticipación

function overlaps(slotStart: number, slotEnd: number, intervals: Interval[]) {
  return intervals.some((i) => slotStart < i.end && slotEnd > i.start);
}

/**
 * Genera los slots concretos disponibles a partir de la disponibilidad recurrente
 * del tutor, descontando bookings ocupados y bloqueos. Función pura: toda la I/O
 * (consultas a Supabase, "ahora" real) se resuelve afuera y se pasa por parámetro.
 */
export function generateSlots({
  dateStrings,
  availability,
  occupiedIntervals,
  blockedIntervals,
  durationMinutes,
  now,
  modality,
}: GenerateSlotsParams): ConcreteSlot[] {
  const slots: ConcreteSlot[] = [];
  const minFutureTime = now + MIN_FUTURE_MS;
  const slotDurationMs = durationMinutes * 60_000;

  for (const dateStr of dateStrings) {
    const dayOfWeek = getDayOfWeekYmd(dateStr);

    const dayAvailability = availability.filter((a) => {
      if (a.day_of_week !== dayOfWeek) return false;
      if (modality && modality !== "ambas") {
        return a.modality === modality || a.modality === "ambas";
      }
      return true;
    });

    for (const avail of dayAvailability) {
      const windowStartUtc = timeToArgentinaDate(dateStr, avail.start_time).getTime();
      const windowEndUtc = timeToArgentinaDate(dateStr, avail.end_time).getTime();

      let cursor = windowStartUtc;
      while (cursor + slotDurationMs <= windowEndUtc) {
        const slotStartUtc = cursor;
        const slotEndUtc = cursor + slotDurationMs;

        if (
          slotStartUtc >= minFutureTime &&
          !overlaps(slotStartUtc, slotEndUtc, occupiedIntervals) &&
          !overlaps(slotStartUtc, slotEndUtc, blockedIntervals)
        ) {
          slots.push({
            start: new Date(slotStartUtc).toISOString(),
            end: new Date(slotEndUtc).toISOString(),
            day_of_week: dayOfWeek,
          });
        }

        cursor += SLOT_STEP_MS;
      }
    }
  }

  return slots;
}

export const VALID_DURATIONS = [30, 60, 90, 120];
export const MAX_RANGE_DAYS = 14;

export type SlotRequestValidation =
  | { error: string }
  | { dateStrings: string[] };

/**
 * Valida los parámetros de una solicitud de slots. Devuelve `{ error }` con el
 * mensaje si algo es inválido, o `{ dateStrings }` con las fechas del rango ya
 * computadas si es válida.
 *
 * El orden importa: el formato YYYY-MM-DD se valida ANTES de generar el rango,
 * porque generateDateRangeYmd asume fechas bien formadas (con basura lanzaría).
 * Pura: solo depende de utilidades de fecha deterministas.
 */
export function validateSlotRequest({
  durationMinutes,
  dateFrom,
  dateTo,
}: {
  durationMinutes: number;
  dateFrom: string;
  dateTo: string;
}): SlotRequestValidation {
  if (!VALID_DURATIONS.includes(durationMinutes)) {
    return { error: "La duración debe ser 30, 60, 90 o 120 minutos" };
  }
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  if (!ymd.test(dateFrom) || !ymd.test(dateTo)) {
    return { error: "Formato de fecha inválido. Usar YYYY-MM-DD." };
  }
  const dateStrings = generateDateRangeYmd(dateFrom, dateTo);
  if (dateStrings.length > MAX_RANGE_DAYS || dateStrings.length === 0) {
    return { error: `El rango no puede superar ${MAX_RANGE_DAYS} días` };
  }
  return { dateStrings };
}
