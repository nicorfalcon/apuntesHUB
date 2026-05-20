import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getQuestionAccess,
  type MaterialQuestionsClient,
} from "@/lib/material-questions";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function ensureCanReact(questionId: string) {
  const supabase = (await createClient()) as MaterialQuestionsClient;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { response: jsonError("No autorizado", 401) };

  const admin = createAdminClient() as MaterialQuestionsClient;
  const access = await getQuestionAccess(admin, user.id, questionId);

  if (!access.question) return { response: jsonError("Consulta no encontrada.", 404) };
  if (!access.canReact) {
    return {
      response: jsonError("Solo compradores con acceso pueden marcar esta duda.", 403),
    };
  }

  return { supabase, user };
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return jsonError("Consulta inválida.", 400);

  const result = await ensureCanReact(id);
  if (result.response) return result.response;

  const { error } = await result.supabase
    .from("material_question_me_toos")
    .upsert(
      { question_id: id, user_id: result.user.id },
      { onConflict: "question_id,user_id", ignoreDuplicates: true }
    );

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return jsonError("Consulta inválida.", 400);

  const supabase = (await createClient()) as MaterialQuestionsClient;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError("No autorizado", 401);

  const { error } = await supabase
    .from("material_question_me_toos")
    .delete()
    .eq("question_id", id)
    .eq("user_id", user.id);

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true });
}
