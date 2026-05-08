import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/tutors/bookings/update
 *
 * Actualiza un booking existente. Acciones soportadas:
 *
 *   action: "cancel"
 *     - Profesor: puede cancelar siempre. Marca como cancelled.
 *       (El reembolso se gestiona manualmente o vía MP refund API en una fase futura.)
 *     - Alumno: solo puede cancelar si faltan >= 24 horas para la clase.
 *       Si faltan < 24 horas, el profesor se queda con la plata.
 *
 *   action: "complete"
 *     - Solo el profesor puede marcar como completada.
 *     - Solo desde status 'confirmed'.
 *
 * Body: { booking_id, action }
 */

interface UpdateBookingBody {
  booking_id: string;
  action: "cancel" | "complete";
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: UpdateBookingBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { booking_id, action } = body;

  if (!booking_id || !action) {
    return NextResponse.json(
      { error: "booking_id y action son requeridos" },
      { status: 400 }
    );
  }

  if (!["cancel", "complete"].includes(action)) {
    return NextResponse.json(
      { error: "action debe ser cancel o complete" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Obtener el booking con admin para tener todos los datos
  const { data: booking, error: fetchError } = await admin
    .from("tutor_bookings")
    .select("id, tutor_id, student_id, status, scheduled_at, amount")
    .eq("id", booking_id)
    .single();

  if (fetchError || !booking) {
    return NextResponse.json(
      { error: "Reserva no encontrada" },
      { status: 404 }
    );
  }

  // Verificar que el usuario es parte de este booking
  const isTutor = user.id === booking.tutor_id;
  const isStudent = user.id === booking.student_id;

  if (!isTutor && !isStudent) {
    return NextResponse.json(
      { error: "No tenés acceso a esta reserva" },
      { status: 403 }
    );
  }

  // ── CANCELAR ──────────────────────────────────────────────
  if (action === "cancel") {
    // Solo se pueden cancelar bookings confirmed o pending_payment
    if (!["confirmed", "pending_payment"].includes(booking.status)) {
      return NextResponse.json(
        { error: `No se puede cancelar una reserva con estado '${booking.status}'` },
        { status: 400 }
      );
    }

    if (isStudent && booking.status === "confirmed") {
      // Alumno solo puede cancelar si faltan >= 24 horas
      const scheduledAt = new Date(booking.scheduled_at!);
      const hoursUntilClass =
        (scheduledAt.getTime() - Date.now()) / (1000 * 60 * 60);

      if (hoursUntilClass < 24) {
        return NextResponse.json(
          {
            error:
              "No podés cancelar con menos de 24 horas de anticipación. " +
              "Contactá al profesor si necesitás reprogramar.",
          },
          { status: 400 }
        );
      }
    }

    // Si el profesor cancela una clase confirmed, se debe reembolsar.
    // Por ahora marcamos cancelled y dejamos el reembolso para gestión manual
    // o integración futura con la API de refund de MercadoPago.
    const cancelledByRole = isTutor ? "tutor" : "student";

    const { error: updateError } = await admin
      .from("tutor_bookings")
      .update({
        status: "cancelled",
      })
      .eq("id", booking_id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      cancelled_by: cancelledByRole,
      refund_required: isTutor && booking.status === "confirmed",
      message: isTutor && booking.status === "confirmed"
        ? "Reserva cancelada. El alumno recibirá un reembolso."
        : "Reserva cancelada.",
    });
  }

  // ── COMPLETAR ─────────────────────────────────────────────
  if (action === "complete") {
    if (!isTutor) {
      return NextResponse.json(
        { error: "Solo el profesor puede marcar una clase como completada" },
        { status: 403 }
      );
    }

    if (booking.status !== "confirmed") {
      return NextResponse.json(
        { error: "Solo se pueden completar clases confirmadas" },
        { status: 400 }
      );
    }

    const { error: updateError } = await admin
      .from("tutor_bookings")
      .update({ status: "completed" })
      .eq("id", booking_id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Clase marcada como completada.",
    });
  }

  return NextResponse.json({ error: "Acción no soportada" }, { status: 400 });
}
