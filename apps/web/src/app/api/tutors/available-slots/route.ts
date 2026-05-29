import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { timeToArgentinaDate } from "@/lib/timezone";
import { generateSlots, validateSlotRequest } from "@/lib/tutors/slot-generation";

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

  const validation = validateSlotRequest({
    durationMinutes: duration_minutes,
    dateFrom: date_from,
    dateTo: date_to,
  });
  if ("error" in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const dateStrings = validation.dateStrings;

  const admin = createAdminClient();

  // Expirar bookings pending_payment vencidos (limpieza oportunista)
  await admin.rpc("expire_pending_tutoring_bookings", {
    p_tutor_id: tutor_id,
  });

  // Build ISO range for Supabase queries using ART boundaries
  const rangeStartUtc = timeToArgentinaDate(date_from, "00:00").getTime();
  const rangeEndUtc = timeToArgentinaDate(date_to, "23:59:59").getTime();

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

  // Generate concrete slots for each day in the range (pure engine).
  const slots = generateSlots({
    dateStrings,
    availability,
    occupiedIntervals,
    blockedIntervals,
    durationMinutes: duration_minutes,
    now,
    modality,
  });

  return NextResponse.json({ slots });
}
