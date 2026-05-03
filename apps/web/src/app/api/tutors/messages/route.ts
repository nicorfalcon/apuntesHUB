import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface SendMessageBody {
  booking_id?: string;
  body?: string;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as SendMessageBody | null;
  const bookingId = payload?.booking_id;
  const body = payload?.body?.trim();

  if (!bookingId || !body) {
    return NextResponse.json(
      { error: "Falta el mensaje o la conversación." },
      { status: 400 }
    );
  }

  if (body.length < 1 || body.length > 1000) {
    return NextResponse.json(
      { error: "El mensaje debe tener hasta 1000 caracteres." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("tutor_bookings")
    .select("id, tutor_id, student_id")
    .eq("id", bookingId)
    .single();

  if (!booking || ![booking.tutor_id, booking.student_id].includes(user.id)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { data: message, error } = await admin
    .from("tutor_messages")
    .insert({
      booking_id: bookingId,
      sender_id: user.id,
      body,
    })
    .select("id")
    .single();

  if (error || !message) {
    return NextResponse.json(
      { error: error?.message ?? "No pudimos enviar el mensaje." },
      { status: 500 }
    );
  }

  await admin
    .from("tutor_bookings")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", bookingId);

  return NextResponse.json({ message_id: message.id });
}

