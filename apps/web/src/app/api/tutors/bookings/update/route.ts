import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function hashString(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

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
  action: "cancel" | "complete" | "details";
  meeting_url?: string;
  location_details?: string;
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

  if (!["cancel", "complete", "details"].includes(action)) {
    return NextResponse.json(
      { error: "action debe ser cancel, complete o details" },
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

  // ── DETALLES (LINK/UBICACION) ───────────────────────────────
  if (action === "details") {
    if (!isTutor) {
      return NextResponse.json(
        { error: "Solo el profesor puede editar los detalles de la clase" },
        { status: 403 }
      );
    }

    if (booking.status !== "confirmed") {
      return NextResponse.json(
        { error: "Solo se pueden editar clases confirmadas" },
        { status: 400 }
      );
    }

    const { meeting_url, location_details } = body;
    const newMeetingUrl = meeting_url ? meeting_url.trim() : null;
    const newLocationDetails = location_details ? location_details.trim() : null;

    if (newMeetingUrl) {
      try {
        const url = new URL(newMeetingUrl);
        if (url.protocol !== "https:") {
          throw new Error("Invalid protocol");
        }
      } catch {
        return NextResponse.json(
          { error: "La URL de la reunión no es válida. Debe incluir https://" },
          { status: 400 }
        );
      }
    }

    // Fetch existing details to see if they changed
    const { data: currentBooking, error: currentError } = await admin
      .from("tutor_bookings")
      .select("meeting_url, location_details, scheduled_at, duration_minutes, subjects(name), profiles!student_id(display_name, email), profiles!tutor_id(display_name)")
      .eq("id", booking_id)
      .single();

    if (currentError || !currentBooking) {
      return NextResponse.json({ error: "Error al recuperar datos actuales" }, { status: 500 });
    }

    const hasChanged =
      currentBooking.meeting_url !== newMeetingUrl ||
      currentBooking.location_details !== newLocationDetails;

    if (!hasChanged) {
      return NextResponse.json({ success: true, emailed: false, message: "No hay cambios" });
    }

    const { error: updateError } = await admin
      .from("tutor_bookings")
      .update({ meeting_url: newMeetingUrl, location_details: newLocationDetails })
      .eq("id", booking_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    let emailed = false;
    // Only send email if at least one of the fields has data
    const shouldSendEmail = Boolean(newMeetingUrl || newLocationDetails);

    // Fetch clean profiles directly
    const [tutorRes, studentRes, studentAuthRes] = await Promise.all([
      admin.from("profiles").select("display_name").eq("id", booking.tutor_id).single(),
      admin.from("profiles").select("display_name").eq("id", booking.student_id).single(),
      admin.auth.admin.getUserById(booking.student_id)
    ]);
    
    const tutorName = tutorRes.data?.display_name || "Profesor";
    const studentName = studentRes.data?.display_name || "Alumno";
    const studentEmail = studentAuthRes.data.user?.email;

    if (shouldSendEmail && studentEmail) {
      const subjectName = Array.isArray(currentBooking.subjects) 
        ? currentBooking.subjects[0]?.name 
        : (currentBooking.subjects as Record<string, unknown>)?.name ?? "Materia";
      
      const dateObj = currentBooking.scheduled_at ? new Date(currentBooking.scheduled_at) : new Date();
      const dateLabel = dateObj.toLocaleDateString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        weekday: "long",
        day: "numeric",
        month: "long"
      });
      const timeLabel = dateObj.toLocaleTimeString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        hour: "2-digit",
        minute: "2-digit"
      });
      const successUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://apunteshub.com"}/checkout/clase/success?booking_id=${booking_id}`;

      try {
        const { buildStudentBookingDetailsEmail } = await import("@/lib/email/templates");
        const { sendTransactionalEmail } = await import("@/lib/email/resend");
        
        const emailContent = buildStudentBookingDetailsEmail({
          studentName,
          tutorName,
          subjectName,
          dateLabel,
          timeLabel,
          meetingUrl: newMeetingUrl,
          locationDetails: newLocationDetails,
          successUrl,
        });

        const contentHash = hashString((newMeetingUrl || "") + (newLocationDetails || ""));
        const idempotencyKey = `tutor-booking-details-student-${booking_id}-${contentHash}`;

        await sendTransactionalEmail({
          to: studentEmail,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
          idempotencyKey
        });
        emailed = true;
      } catch (e) {
        console.error("Error dispatching booking details email", e);
      }
    }

    return NextResponse.json({
      success: true,
      emailed,
      message: "Detalles actualizados."
    });
  }

  return NextResponse.json({ error: "Acción no soportada" }, { status: 400 });
}
