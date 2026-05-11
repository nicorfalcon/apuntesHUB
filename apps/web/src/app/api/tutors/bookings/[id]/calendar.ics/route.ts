import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateIcsContent } from "@/lib/calendar";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();

  // Fetch the booking
  const { data: booking, error } = await admin
    .from("tutor_bookings")
    .select(`
      id,
      tutor_id,
      student_id,
      status,
      scheduled_at,
      duration_minutes,
      modality,
      meeting_url,
      location_details,
      initial_message,
      subjects(name),
      student:profiles!student_id(display_name),
      tutor:profiles!tutor_id(display_name)
    `)
    .eq("id", id)
    .single();

  if (error || !booking) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // Authorize
  if (booking.student_id !== user.id && booking.tutor_id !== user.id) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!booking.scheduled_at) {
    return new NextResponse("Booking has no scheduled time", { status: 400 });
  }

  if (booking.status !== "confirmed") {
    return new NextResponse("La reserva todavía no está confirmada", { status: 400 });
  }

  // Resolve Location
  let location = "";
  if (booking.modality === "online") {
    location = booking.meeting_url || "Online - datos pendientes";
  } else if (booking.modality === "presencial") {
    location = booking.location_details || "Ubicación pendiente";
  } else {
    // Ambas or other
    if (booking.meeting_url && booking.location_details) {
      location = `${booking.location_details} (Link: ${booking.meeting_url})`;
    } else {
      location = booking.meeting_url || booking.location_details || "Datos de acceso pendientes";
    }
  }

  // Resolve Names
  const getProfileName = (p: unknown) => {
    if (Array.isArray(p)) return (p[0] as { display_name?: string })?.display_name ?? "Usuario";
    return (p as { display_name?: string })?.display_name ?? "Usuario";
  };
  const tutorName = getProfileName(booking.tutor);
  const studentName = getProfileName(booking.student);
  
  const subjectName = Array.isArray(booking.subjects)
    ? booking.subjects[0]?.name ?? "Materia"
    : (booking.subjects as { name?: string })?.name ?? "Materia";

  // Build Description
  const descParts = [
    `Materia: ${subjectName}`,
    `Profesor: ${tutorName}`,
    `Alumno: ${studentName}`,
    `Modalidad: ${booking.modality || "online"}`,
    `Estado: ${booking.status}`,
  ];

  if (booking.initial_message) {
    descParts.push(`\nNota del alumno: ${booking.initial_message}`);
  }

  const icsContent = generateIcsContent({
    title: `Clase de ${subjectName} con ${tutorName}`,
    description: descParts.join("\n"),
    location,
    startDate: new Date(booking.scheduled_at),
    durationMinutes: booking.duration_minutes ?? 60,
    uid: booking.id,
  });

  return new NextResponse(icsContent, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="clase_${id}.ics"`,
    },
  });
}
