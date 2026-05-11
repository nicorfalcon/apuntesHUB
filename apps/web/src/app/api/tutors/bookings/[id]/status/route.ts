import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  
  if (!id) {
    return NextResponse.json({ error: "id es requerido" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: booking, error } = await supabase
    .from("tutor_bookings")
    .select("status")
    .eq("id", id)
    .or(`student_id.eq.${user.id},tutor_id.eq.${user.id}`)
    .single();

  // If error or not found, RLS might be hiding it (or it doesn't exist)
  if (error || !booking) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  return NextResponse.json({ status: booking.status });
}
