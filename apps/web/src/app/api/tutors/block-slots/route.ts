import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  timeToArgentinaDate,
  getWeekStartYmd,
  addDaysYmd,
} from "@/lib/timezone";

/**
 * GET /api/tutors/block-slots
 * Lista todos los bloqueos del tutor autenticado.
 *
 * POST /api/tutors/block-slots
 * Crea un bloqueo de horario para el tutor autenticado.
 *
 * Body (opción A — alto nivel, recomendado):
 *   { type: "custom"|"day"|"week", date: "YYYY-MM-DD", start_time?: "HH:MM", end_time?: "HH:MM", reason?: string }
 *
 * Body (opción B — bajo nivel, legacy):
 *   { starts_at: ISO, ends_at: ISO, block_type?: string, reason?: string }
 *
 * DELETE /api/tutors/block-slots
 * Elimina un bloqueo existente del tutor autenticado.
 * Body: { block_id: string }
 */

// ── GET ────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Verify tutor
  const { data: profile } = await admin
    .from("profiles")
    .select("is_tutor")
    .eq("id", user.id)
    .single();

  if (!profile?.is_tutor) {
    return NextResponse.json(
      { error: "Solo los profesores pueden ver bloqueos" },
      { status: 403 }
    );
  }

  // Fetch blocks owned by this tutor (future and recent, max 90 days back)
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const { data: blocks, error } = await admin
    .from("tutor_blocked_slots")
    .select("id, starts_at, ends_at, block_type, reason, created_at")
    .eq("tutor_id", user.id)
    .gte("ends_at", cutoff)
    .order("starts_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ blocks: blocks ?? [] });
}

// ── POST ───────────────────────────────────────────────────────

interface HighLevelBody {
  type: "custom" | "day" | "week";
  date: string; // YYYY-MM-DD
  start_time?: string; // HH:MM (required for custom)
  end_time?: string; // HH:MM (required for custom)
  reason?: string;
}

interface LowLevelBody {
  starts_at: string;
  ends_at: string;
  block_type?: string;
  reason?: string;
}

function isHighLevel(b: unknown): b is HighLevelBody {
  return typeof b === "object" && b !== null && "type" in b && "date" in b;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  // Verify tutor
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

  let startsAtIso: string;
  let endsAtIso: string;
  let blockType: string;
  let reason: string | null;

  if (isHighLevel(rawBody)) {
    // ── High-level payload ──
    const { type, date, start_time, end_time, reason: r } = rawBody;
    reason = r || null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "Formato de fecha inválido. Usar YYYY-MM-DD." },
        { status: 400 }
      );
    }

    if (!["custom", "day", "week"].includes(type)) {
      return NextResponse.json(
        { error: "type debe ser custom, day o week" },
        { status: 400 }
      );
    }

    if (type === "custom") {
      if (!start_time || !end_time) {
        return NextResponse.json(
          { error: "custom requiere start_time y end_time" },
          { status: 400 }
        );
      }
      if (!/^\d{1,2}:\d{2}$/.test(start_time) || !/^\d{1,2}:\d{2}$/.test(end_time)) {
        return NextResponse.json(
          { error: "Formato de hora inválido. Usar HH:MM." },
          { status: 400 }
        );
      }

      const startDate = timeToArgentinaDate(date, start_time);
      const endDate = timeToArgentinaDate(date, end_time);

      if (endDate.getTime() <= startDate.getTime()) {
        return NextResponse.json(
          { error: "end_time debe ser posterior a start_time" },
          { status: 400 }
        );
      }

      // Guard: max 24 hours for a custom block
      if (endDate.getTime() - startDate.getTime() > 24 * 60 * 60 * 1000) {
        return NextResponse.json(
          { error: "Un bloqueo custom no puede superar 24 horas" },
          { status: 400 }
        );
      }

      startsAtIso = startDate.toISOString();
      endsAtIso = endDate.toISOString();
      blockType = "custom";

    } else if (type === "day") {
      // Half-open interval: [date 00:00, next day 00:00)
      const nextDay = addDaysYmd(date, 1);
      const startDate = timeToArgentinaDate(date, "00:00");
      const endDate = timeToArgentinaDate(nextDay, "00:00");

      startsAtIso = startDate.toISOString();
      endsAtIso = endDate.toISOString();
      blockType = "day";

    } else {
      // type === "week": half-open [monday 00:00, next monday 00:00)
      const weekStart = getWeekStartYmd(date);
      const nextMonday = addDaysYmd(weekStart, 7);

      const startDate = timeToArgentinaDate(weekStart, "00:00");
      const endDate = timeToArgentinaDate(nextMonday, "00:00");

      startsAtIso = startDate.toISOString();
      endsAtIso = endDate.toISOString();
      blockType = "week";
    }

  } else {
    // ── Low-level payload (legacy / backwards compat) ──
    const b = rawBody as LowLevelBody;
    if (!b.starts_at || !b.ends_at) {
      return NextResponse.json(
        { error: "starts_at y ends_at son requeridos" },
        { status: 400 }
      );
    }

    blockType = b.block_type || "custom";
    reason = b.reason || null;

    if (!["custom", "day", "week"].includes(blockType)) {
      return NextResponse.json(
        { error: "block_type debe ser custom, day o week" },
        { status: 400 }
      );
    }

    const startsAtDate = new Date(b.starts_at);
    const endsAtDate = new Date(b.ends_at);

    if (isNaN(startsAtDate.getTime()) || isNaN(endsAtDate.getTime())) {
      return NextResponse.json(
        { error: "Fechas inválidas" },
        { status: 400 }
      );
    }

    if (endsAtDate.getTime() <= startsAtDate.getTime()) {
      return NextResponse.json(
        { error: "ends_at debe ser posterior a starts_at" },
        { status: 400 }
      );
    }

    // Guard: max 8 days for any block
    if (endsAtDate.getTime() - startsAtDate.getTime() > 8 * 24 * 60 * 60 * 1000) {
      return NextResponse.json(
        { error: "El bloqueo no puede superar 8 días" },
        { status: 400 }
      );
    }

    startsAtIso = startsAtDate.toISOString();
    endsAtIso = endsAtDate.toISOString();
  }

  // Insert block — tutor_id is always user.id, never from the payload
  const { data: block, error } = await supabase
    .from("tutor_blocked_slots")
    .insert({
      tutor_id: user.id,
      starts_at: startsAtIso,
      ends_at: endsAtIso,
      block_type: blockType,
      reason,
    })
    .select("id, starts_at, ends_at, block_type, reason")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ block });
}

// ── DELETE ──────────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Verify tutor
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("is_tutor")
    .eq("id", user.id)
    .single();

  if (!profile?.is_tutor) {
    return NextResponse.json(
      { error: "Solo los profesores pueden eliminar bloqueos" },
      { status: 403 }
    );
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

  // Delete and confirm a row was actually removed
  const { data: deleted, error } = await supabase
    .from("tutor_blocked_slots")
    .delete()
    .eq("id", body.block_id)
    .eq("tutor_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!deleted) {
    return NextResponse.json(
      { error: "Bloqueo no encontrado" },
      { status: 404 }
    );
  }

  return NextResponse.json({ deleted: true });
}
