import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: { device_row_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (!body.device_row_id) {
    return NextResponse.json({ error: "missing_device_row_id" }, { status: 400 });
  }

  // Look up the device first to get its underlying Supabase session_id.
  // RLS guarantees we can only see rows that belong to us.
  const { data: device, error: lookupError } = await supabase
    .from("user_devices")
    .select("id, session_id")
    .eq("id", body.device_row_id)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }
  if (!device) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Kill the actual auth session so that device gets logged out on its
  // next request. RPC is SECURITY DEFINER but enforces auth.uid() match.
  if (device.session_id) {
    const { error: rpcError } = await supabase.rpc("revoke_my_session", {
      p_session_id: device.session_id,
    });
    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }
  }

  // Then drop the device row. RLS already restricts this to the owner.
  const { error: deleteError } = await supabase
    .from("user_devices")
    .delete()
    .eq("id", body.device_row_id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
