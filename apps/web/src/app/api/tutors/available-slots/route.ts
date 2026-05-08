import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/tutors/available-slots
 *
 * Calcula los slots concretos disponibles para un tutor en un rango de fechas.
 * Considera:
 *   1. Disponibilidad recurrente semanal (tutor_availability)
 *   2. Bookings activos (pending_payment no expirados + confirmed)
 *   3. Bloqueos del tutor (tutor_blocked_slots)
 *   4. Duración solicitada
 *   5. Modalidad
 *   6. Mínimo 1 hora en el futuro
 *
 * Body: { tutor_id, date_from, date_to, duration_minutes, modality? }
 * Response: { slots: Array<{ start: ISO, end: ISO, day_of_week: number }> }
 */

interface SlotRequest {
  tutor_id?: string;
  date_from?: string; // YYYY-MM-DD
  date_to?: string; // YYYY-MM-DD
  duration_minutes?: number;
  modality?: string;
}

interface ConcreteSlot {
  start: string; // ISO datetime (UTC)
  end: string; // ISO datetime (UTC)
  day_of_week: number;
}

// Argentina no tiene DST desde 2009. UTC-3 siempre.
const ART_OFFSET_MS = 3 * 60 * 60_000;

export async function POST(request: NextRequest) {
  let body: SlotRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { tutor_id, date_from, date_to, duration_minutes = 60, modality } = body;

  if (!tutor_id || !date_from || !date_to) {
    return NextResponse.json(
      { error: "tutor_id, date_from y date_to son requeridos" },
      { status: 400 }
    );
  }

  if (![30, 60, 90, 120].includes(duration_minutes)) {
    return NextResponse.json(
      { error: "La duración debe ser 30, 60, 90 o 120 minutos" },
      { status: 400 }
    );
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date_from) || !/^\d{4}-\d{2}-\d{2}$/.test(date_to)) {
    return NextResponse.json(
      { error: "Formato de fecha inválido. Usar YYYY-MM-DD." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Expirar bookings pending_payment vencidos (limpieza oportunista)
  await admin.rpc("expire_pending_tutoring_bookings", {
    p_tutor_id: tutor_id,
  });

  // Generate list of date strings to iterate (avoids Date UTC midnight issues)
  const dateStrings = generateDateRange(date_from, date_to);
  const maxDays = 14;
  if (dateStrings.length > maxDays || dateStrings.length === 0) {
    return NextResponse.json(
      { error: `El rango no puede superar ${maxDays} días` },
      { status: 400 }
    );
  }

  // Build ISO range for Supabase queries using ART boundaries
  // date_from 00:00 ART = date_from 03:00 UTC
  const rangeStartUtc = new Date(`${date_from}T00:00:00Z`).getTime() + ART_OFFSET_MS;
  // date_to 23:59 ART = date_to+1 02:59 UTC
  const rangeEndUtc = new Date(`${date_to}T23:59:59Z`).getTime() + ART_OFFSET_MS;

  const [
    { data: availability },
    { data: bookings },
    { data: blockedSlots },
  ] = await Promise.all([
    // 1. Disponibilidad recurrente
    admin
      .from("tutor_availability")
      .select("day_of_week, start_time, end_time, modality")
      .eq("tutor_id", tutor_id),
    // 2. Bookings activos en el rango (pending_payment no expirados + confirmed)
    admin
      .from("tutor_bookings")
      .select("scheduled_at, duration_minutes, status, payment_expires_at")
      .eq("tutor_id", tutor_id)
      .in("status", ["pending_payment", "confirmed"])
      .gte("scheduled_at", new Date(rangeStartUtc).toISOString())
      .lte("scheduled_at", new Date(rangeEndUtc).toISOString()),
    // 3. Bloqueos que solapan con el rango
    admin
      .from("tutor_blocked_slots")
      .select("starts_at, ends_at")
      .eq("tutor_id", tutor_id)
      .lt("starts_at", new Date(rangeEndUtc).toISOString())
      .gt("ends_at", new Date(rangeStartUtc).toISOString()),
  ]);

  if (!availability || availability.length === 0) {
    return NextResponse.json({ slots: [] });
  }

  // Filter out expired pending_payment bookings (safety net)
  const now = Date.now();
  const activeBookings = (bookings ?? []).filter((b) => {
    if (b.status === "pending_payment") {
      return b.payment_expires_at && new Date(b.payment_expires_at).getTime() > now;
    }
    return true;
  });

  // Build occupied intervals from active bookings
  const occupiedIntervals = activeBookings
    .filter((b) => b.scheduled_at)
    .map((b) => {
      const start = new Date(b.scheduled_at!).getTime();
      const end = start + (b.duration_minutes ?? 60) * 60_000;
      return { start, end };
    });

  // Build blocked intervals
  const blockedIntervals = (blockedSlots ?? []).map((b) => ({
    start: new Date(b.starts_at).getTime(),
    end: new Date(b.ends_at).getTime(),
  }));

  // Generate concrete slots for each day in the range
  const slots: ConcreteSlot[] = [];
  const minFutureTime = now + 60 * 60_000; // 1 hour from now
  const slotDurationMs = duration_minutes * 60_000;

  for (const dateStr of dateStrings) {
    // dateStr is YYYY-MM-DD (ART calendar date)
    const dayOfWeek = getDayOfWeekFromDateStr(dateStr);

    // Find availability windows for this day of the week
    const dayAvailability = availability.filter((a) => {
      if (a.day_of_week !== dayOfWeek) return false;
      if (modality && modality !== "ambas") {
        return a.modality === modality || a.modality === "ambas";
      }
      return true;
    });

    for (const avail of dayAvailability) {
      // Convert ART local times to UTC timestamps
      // avail.start_time is like "14:00:00" (ART)
      const windowStartUtc = artTimeToUtc(dateStr, avail.start_time);
      const windowEndUtc = artTimeToUtc(dateStr, avail.end_time);

      // Generate slots at 30-minute intervals within the window
      let cursor = windowStartUtc;

      while (cursor + slotDurationMs <= windowEndUtc) {
        const slotStartUtc = cursor;
        const slotEndUtc = cursor + slotDurationMs;

        // Check: must be at least 1 hour in the future
        if (slotStartUtc >= minFutureTime) {
          // Check: no overlap with occupied intervals
          const isOccupied = occupiedIntervals.some(
            (o) => slotStartUtc < o.end && slotEndUtc > o.start
          );

          // Check: no overlap with blocked intervals
          const isBlocked = blockedIntervals.some(
            (b) => slotStartUtc < b.end && slotEndUtc > b.start
          );

          if (!isOccupied && !isBlocked) {
            slots.push({
              start: new Date(slotStartUtc).toISOString(),
              end: new Date(slotEndUtc).toISOString(),
              day_of_week: dayOfWeek,
            });
          }
        }

        // Move cursor by 30 minutes (slot interval)
        cursor += 30 * 60_000;
      }
    }
  }

  return NextResponse.json({ slots });
}

/**
 * Convert ART local time (dateStr + timeStr) to UTC timestamp in ms.
 * Argentina is always UTC-3 (no DST since 2009).
 */
function artTimeToUtc(dateStr: string, timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const h = String(hours).padStart(2, "0");
  const m = String(minutes).padStart(2, "0");
  // Parse as UTC, then add 3 hours to convert ART→UTC
  return new Date(`${dateStr}T${h}:${m}:00Z`).getTime() + ART_OFFSET_MS;
}

/**
 * Get day of week (0=Sun, 6=Sat) from a YYYY-MM-DD string.
 * Uses UTC parse which is fine since we only care about the calendar date.
 */
function getDayOfWeekFromDateStr(dateStr: string): number {
  // Add T12:00:00Z to avoid timezone edge cases with midnight
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

/**
 * Generate array of YYYY-MM-DD strings from date_from to date_to inclusive.
 */
function generateDateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);

  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}
