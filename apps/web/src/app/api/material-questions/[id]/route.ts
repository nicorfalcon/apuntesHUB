import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getQuestionAccess,
  type MaterialQuestionStatus,
  type MaterialQuestionsClient,
} from "@/lib/material-questions";
import { validateMaterialQuestionText } from "@/lib/material-questions/validation";

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

  const payload = (await request.json().catch(() => null)) as
    | {
        status?: MaterialQuestionStatus;
        title?: unknown;
        body?: unknown;
        isAnonymousToBuyers?: unknown;
      }
    | null;

  if (!payload) return jsonError("Body inválido.", 400);

  const admin = createAdminClient() as MaterialQuestionsClient;
  const access = await getQuestionAccess(admin, user.id, id);

  if (!access.question) return jsonError("Consulta no encontrada.", 404);
  if (!access.canView) return jsonError("No autorizado.", 403);

  const isStatusUpdate = payload.status !== undefined;
  const isContentUpdate =
    payload.title !== undefined ||
    payload.body !== undefined ||
    payload.isAnonymousToBuyers !== undefined;

  if (isStatusUpdate && isContentUpdate) {
    return jsonError("No mezcles edición de contenido con cambio de estado.", 400);
  }

  if (isContentUpdate) {
    if (!access.isQuestionAuthor || access.question.status !== "open") {
      return jsonError(
        "Solo podés editar tu consulta mientras está pendiente y sin respuesta.",
        403
      );
    }

    const [{ count: answersCount }, { count: followupsCount }] = await Promise.all([
      admin
        .from("material_question_answers")
        .select("id", { count: "exact", head: true })
        .eq("question_id", id),
      admin
        .from("material_question_followups")
        .select("id", { count: "exact", head: true })
        .eq("question_id", id),
    ]);

    if ((answersCount ?? 0) > 0 || (followupsCount ?? 0) > 0) {
      return jsonError(
        "No podés editar una consulta que ya tiene respuesta o seguimiento.",
        409
      );
    }

    const title = validateMaterialQuestionText(payload.title, 8, 140, "El título");
    if (title.error) return jsonError(title.error, 400);

    const body = validateMaterialQuestionText(payload.body, 10, 2000, "El detalle");
    if (body.error) return jsonError(body.error, 400);

    if (typeof payload.isAnonymousToBuyers !== "boolean") {
      return jsonError("isAnonymousToBuyers debe ser boolean.", 400);
    }

    const { error } = await supabase
      .from("material_questions")
      .update({
        title: title.value,
        body: body.value,
        is_anonymous_to_buyers: payload.isAnonymousToBuyers,
      })
      .eq("id", id);

    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ ok: true });
  }

  if (!payload.status || !STATUSES.has(payload.status)) {
    return jsonError("Estado inválido.", 400);
  }

  const canUpdate =
    (access.canModerate && payload.status !== "resolved") ||
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return jsonError("Consulta inválida.", 400);

  const supabase = (await createClient()) as MaterialQuestionsClient;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError("No autorizado", 401);

  const admin = createAdminClient() as MaterialQuestionsClient;
  const access = await getQuestionAccess(admin, user.id, id);

  if (!access.question) return jsonError("Consulta no encontrada.", 404);

  const canModerateDelete = access.canModerate;
  const canDeleteOwn = access.isQuestionAuthor && access.question.status === "open";

  if (!canModerateDelete && !canDeleteOwn) {
    return jsonError("No tenés permiso para borrar esta consulta.", 403);
  }

  if (canDeleteOwn && !canModerateDelete) {
    const [{ count: answersCount }, { count: followupsCount }] = await Promise.all([
      admin
        .from("material_question_answers")
        .select("id", { count: "exact", head: true })
        .eq("question_id", id),
      admin
        .from("material_question_followups")
        .select("id", { count: "exact", head: true })
        .eq("question_id", id),
    ]);

    if ((answersCount ?? 0) > 0 || (followupsCount ?? 0) > 0) {
      return jsonError(
        "No podés borrar una consulta que ya tiene respuesta o seguimiento.",
        409
      );
    }
  }

  const { error } = await supabase.from("material_questions").delete().eq("id", id);

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true });
}
