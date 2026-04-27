import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEVICE_COOKIE_NAME, verifyDeviceId } from "@/lib/devices/cookie";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const currentDeviceId = verifyDeviceId(cookieStore.get(DEVICE_COOKIE_NAME)?.value);

  const { data, error } = await supabase
    .from("user_devices")
    .select("id, device_id, label, created_at, last_seen_at")
    .eq("user_id", user.id)
    .order("last_seen_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const devices = (data ?? []).map((d) => ({
    id: d.id,
    label: d.label,
    created_at: d.created_at,
    last_seen_at: d.last_seen_at,
    is_current: currentDeviceId !== null && d.device_id === currentDeviceId,
  }));

  return NextResponse.json({ devices });
}
