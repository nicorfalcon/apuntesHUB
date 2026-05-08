import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ count: 0 });
  }

  const { data: bookings } = await supabase
    .from("tutor_bookings")
    .select("id")
    .or(`tutor_id.eq.${user.id},student_id.eq.${user.id}`)
    .in("status", ["confirmed", "completed", "cancelled"]);

  const bookingIds = (bookings ?? []).map((b) => b.id);
  if (bookingIds.length === 0) {
    return NextResponse.json({ count: 0 });
  }

  const { count } = await supabase
    .from("tutor_messages")
    .select("id", { count: "exact", head: true })
    .in("booking_id", bookingIds)
    .neq("sender_id", user.id)
    .is("read_at", null);

  return NextResponse.json({ count: count ?? 0 });
}
