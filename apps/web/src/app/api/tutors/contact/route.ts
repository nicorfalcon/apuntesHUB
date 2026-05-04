import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface ContactTutorBody {
  tutor_id?: string;
  subject_id?: string;
  message?: string;
  duration_minutes?: number;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as ContactTutorBody | null;
  const tutorId = body?.tutor_id;
  const subjectId = body?.subject_id;
  const message = body?.message?.trim();
  const durationMinutes = body?.duration_minutes ?? 60;

  if (!tutorId || !subjectId || !message) {
    return NextResponse.json(
      { error: "Faltan datos para contactar al profesor." },
      { status: 400 }
    );
  }

  if (tutorId === user.id) {
    return NextResponse.json(
      { error: "No podés contactarte a vos mismo como profesor." },
      { status: 400 }
    );
  }

  if (message.length < 10 || message.length > 1000) {
    return NextResponse.json(
      { error: "El mensaje debe tener entre 10 y 1000 caracteres." },
      { status: 400 }
    );
  }

  if (![30, 60, 90, 120].includes(durationMinutes)) {
    return NextResponse.json(
      { error: "La duración elegida no es válida." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const [{ data: tutor }, { data: tutorSubject }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, is_tutor")
      .eq("id", tutorId)
      .eq("is_tutor", true)
      .single(),
    admin
      .from("tutor_subjects")
      .select("id, hourly_rate_ars")
      .eq("tutor_id", tutorId)
      .eq("subject_id", subjectId)
      .eq("is_active", true)
      .single(),
  ]);

  if (!tutor || !tutorSubject) {
    return NextResponse.json(
      { error: "El profesor o la materia ya no están disponibles." },
      { status: 404 }
    );
  }

  const { data: booking, error: bookingError } = await admin
    .from("tutor_bookings")
    .insert({
      tutor_id: tutorId,
      student_id: user.id,
      subject_id: subjectId,
      duration_minutes: durationMinutes,
      status: "requested",
      initial_message: message,
      hourly_rate_ars: tutorSubject.hourly_rate_ars,
    })
    .select("id")
    .single();

  if (bookingError || !booking) {
    return NextResponse.json(
      { error: bookingError?.message ?? "No pudimos crear la solicitud." },
      { status: 500 }
    );
  }

  const { error: messageError } = await admin.from("tutor_messages").insert({
    booking_id: booking.id,
    sender_id: user.id,
    body: message,
  });

  if (messageError) {
    await admin.from("tutor_bookings").delete().eq("id", booking.id);
    return NextResponse.json(
      { error: "No pudimos enviar el primer mensaje." },
      { status: 500 }
    );
  }

  return NextResponse.json({ booking_id: booking.id });
}

