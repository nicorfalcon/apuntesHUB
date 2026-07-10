import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  AI_CONVERSATION_TITLE_MAX,
  getConversationWithMessages,
} from "@/lib/ai/conversations";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function cleanTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const title = value.replace(/\s+/g, " ").trim().slice(0, AI_CONVERSATION_TITLE_MAX);
  return title.length > 0 ? title : null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!UUID_RE.test(params.id)) return jsonError("Conversación inválida.", 400);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError("No autenticado", 401);

  const { conversation, messages, error } = await getConversationWithMessages(
    supabase,
    params.id
  );
  if (error) return jsonError(error, 500);
  if (!conversation) return jsonError("Conversación no encontrada.", 404);

  return NextResponse.json({ conversation, messages });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!UUID_RE.test(params.id)) return jsonError("Conversación inválida.", 400);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError("No autenticado", 401);

  const body = (await request.json().catch(() => null)) as { title?: unknown } | null;
  if (!body) return jsonError("Body inválido.", 400);

  const title = cleanTitle(body.title);
  if (!title) return jsonError("El título es obligatorio.", 400);

  const { error } = await supabase
    .from("ai_conversations")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", params.id);

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!UUID_RE.test(params.id)) return jsonError("Conversación inválida.", 400);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError("No autenticado", 401);

  const { error } = await supabase
    .from("ai_conversations")
    .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", params.id);

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ ok: true });
}
