import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getQuestionAccess,
  type MaterialQuestionsClient,
} from "@/lib/material-questions";
import { validateMaterialQuestionText } from "@/lib/material-questions/validation";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
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
  const body = validateMaterialQuestionText(payload?.body, 1, 2000, "El mensaje");
  if (body.error) return jsonError(body.error, 400);

  const admin = createAdminClient() as MaterialQuestionsClient;
  const access = await getQuestionAccess(admin, user.id, id);

  if (!access.question) return jsonError("Consulta no encontrada.", 404);
  if (access.question.status === "hidden") {
    return jsonError("La consulta está cerrada.", 403);
  }

  let role: "buyer" | "owner";
  if (access.isQuestionAuthor) {
    if (access.question.status === "resolved") {
      return jsonError(
        "Marcaste esta consulta como resuelta. Si necesitás otra cosa, abrí una consulta nueva.",
        403
      );
    }
    role = "buyer";
  } else if (access.canAnswer) {
    role = "owner";
  } else {
    return jsonError(
      "Solo el comprador original o el dueño/autor pueden continuar este hilo.",
      403
    );
  }

  const followupId = randomUUID();
  const { error } = await supabase
    .from("material_question_followups")
    .insert({
      id: followupId,
      question_id: id,
      author_id: user.id,
      role,
      body: body.value,
    });

  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ id: followupId, role }, { status: 201 });
}
