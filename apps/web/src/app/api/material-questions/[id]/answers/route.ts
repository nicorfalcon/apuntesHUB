import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getQuestionAccess,
  type MaterialQuestionsClient,
} from "@/lib/material-questions";
import { notifyBuyersOfMaterialQuestionAnswer } from "@/lib/email/material-question-notifications";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function validateAnswer(value: unknown) {
  if (typeof value !== "string") return { value: "", error: "Respuesta requerida." };
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > 4000) {
    return {
      value: trimmed,
      error: "La respuesta debe tener entre 1 y 4000 caracteres.",
    };
  }
  return { value: trimmed, error: null };
}

export async function POST(
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

  const payload = (await request.json().catch(() => null)) as { body?: unknown } | null;
  const body = validateAnswer(payload?.body);
  if (body.error) return jsonError(body.error, 400);

  const admin = createAdminClient() as MaterialQuestionsClient;
  const access = await getQuestionAccess(admin, user.id, id);

  if (!access.question) return jsonError("Consulta no encontrada.", 404);
  if (!access.canAnswer) {
    return jsonError("Solo el dueño/autor puede responder consultas abiertas.", 403);
  }

  const answerId = randomUUID();
  const { error } = await supabase
    .from("material_question_answers")
    .insert({
      id: answerId,
      question_id: id,
      author_id: user.id,
      body: body.value,
      is_official: true,
    });

  if (error) return jsonError(error.message, 500);

  try {
    await notifyBuyersOfMaterialQuestionAnswer(admin, answerId);
  } catch (notifyError) {
    console.warn("[material-question] answer notify failed", notifyError);
  }

  return NextResponse.json({ id: answerId }, { status: 201 });
}
