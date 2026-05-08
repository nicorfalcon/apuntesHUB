import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/tutors/block-slots
 * Crea un bloqueo de horario para el tutor autenticado.
 *
 * Body: { starts_at, ends_at, block_type?, reason? }
 *
 * DELETE /api/tutors/block-slots
 * Elimina un bloqueo existente del tutor autenticado.
 *
 * Body: { block_id }
 */

interface BlockSlotBody {
  starts_at: string;
  ends_at: string;
  block_type?: string;
  reason?: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: BlockSlotBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { starts_at, ends_at, block_type = "custom", reason } = body;

  if (!starts_at || !ends_at) {
    return NextResponse.json(
      { error: "starts_at y ends_at son requeridos" },
      { status: 400 }
    );
  }

  if (!["custom", "day", "week"].includes(block_type)) {
    return NextResponse.json(
      { error: "block_type debe ser custom, day o week" },
      { status: 400 }
    );
  }

  const startsAtDate = new Date(starts_at);
  const endsAtDate = new Date(ends_at);

  if (endsAtDate <= startsAtDate) {
    return NextResponse.json(
      { error: "ends_at debe ser posterior a starts_at" },
      { status: 400 }
    );
  }

  // Verificar que el usuario es tutor
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("is_tutor")
    .eq("id", user.id)
    .single();

  if (!profile?.is_tutor) {
    return NextResponse.json(
      { error: "Solo los profesores pueden bloquear horarios" },
      { status: 403 }
    );
  }

  // Insertar bloqueo (RLS ya valida que tutor_id = auth.uid())
  const { data: block, error } = await supabase
    .from("tutor_blocked_slots")
    .insert({
      tutor_id: user.id,
      starts_at: startsAtDate.toISOString(),
      ends_at: endsAtDate.toISOString(),
      block_type,
      reason: reason || null,
    })
    .select("id, starts_at, ends_at, block_type, reason")
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ block });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: { block_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  if (!body.block_id) {
    return NextResponse.json(
      { error: "block_id es requerido" },
      { status: 400 }
    );
  }

  // RLS ya valida que solo el tutor dueño puede eliminar
  const { error } = await supabase
    .from("tutor_blocked_slots")
    .delete()
    .eq("id", body.block_id)
    .eq("tutor_id", user.id);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ deleted: true });
}
