import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildConversationTitle,
  createConversation,
  listResumeConversations,
  userHasCompletedPurchase,
} from "@/lib/ai/conversations";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError("No autenticado", 401);

  const resumeId = request.nextUrl.searchParams.get("resumeId");
  if (!isUuid(resumeId)) return jsonError("resumeId inválido.", 400);

  const canAccess = await userHasCompletedPurchase(supabase, user.id, resumeId);
  if (!canAccess) return jsonError("No tenés acceso a este apunte.", 403);

  const { conversations, error } = await listResumeConversations(supabase, resumeId);
  if (error) return jsonError(error, 500);

  return NextResponse.json({ conversations });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError("No autenticado", 401);

  const body = (await request.json().catch(() => null)) as
    | { resumeId?: unknown; title?: unknown; initialQuery?: unknown }
    | null;
  if (!body) return jsonError("Body inválido.", 400);

  const resumeId = body.resumeId;
  if (resumeId !== null && resumeId !== undefined && !isUuid(resumeId)) {
    return jsonError("resumeId inválido.", 400);
  }

  if (isUuid(resumeId)) {
    const canAccess = await userHasCompletedPurchase(supabase, user.id, resumeId);
    if (!canAccess) return jsonError("No tenés acceso a este apunte.", 403);
  }

  const rawTitle =
    typeof body.title === "string"
      ? body.title
      : typeof body.initialQuery === "string"
        ? body.initialQuery
        : "";

  const { conversationId, error } = await createConversation(supabase, {
    userId: user.id,
    resumeId: isUuid(resumeId) ? resumeId : null,
    title: buildConversationTitle(rawTitle),
  });

  if (error) return jsonError(error, 500);

  return NextResponse.json({ conversationId }, { status: 201 });
}
