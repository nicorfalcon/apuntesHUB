import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getQuestionAccess,
  type MaterialQuestionStatus,
  type MaterialQuestionsClient,
} from "@/lib/material-questions";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUSES = new Set<MaterialQuestionStatus>([
  "open",
  "answered",
  "resolved",
  "hidden",
]);

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return jsonError("Consulta inválida.", 400);

  const supabase = (await createClient()) as MaterialQuestionsClient;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError("No autorizado", 401);

  const payload = (await request.json().catch(() => null)) as {
    status?: MaterialQuestionStatus;
  } | null;

  if (!payload?.status || !STATUSES.has(payload.status)) {
    return jsonError("Estado inválido.", 400);
  }

  const admin = createAdminClient() as MaterialQuestionsClient;
  const access = await getQuestionAccess(admin, user.id, id);

  if (!access.question) return jsonError("Consulta no encontrada.", 404);
  if (!access.canView) return jsonError("No autorizado.", 403);

  const canUpdate =
    access.canModerate ||
    (access.isQuestionAuthor &&
      access.question.status !== "hidden" &&
      payload.status === "resolved");

  if (!canUpdate) {
    return jsonError("No tenés permiso para cambiar este estado.", 403);
  }

  const { error } = await supabase
    .from("material_questions")
    .update({ status: payload.status })
    .eq("id", id);

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true });
}
