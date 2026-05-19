import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const admin = createAdminClient();

  // Verificar que la key pertenece al usuario autenticado
  const { data: key } = await admin
    .from("user_api_keys")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (!key) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const { error } = await admin
    .from("user_api_keys")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
