import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendTransactionalEmail } from "@/lib/email/resend";
import { buildSupportRequestEmail } from "@/lib/email/templates";

const SUPPORT_INBOX = process.env.SUPPORT_EMAIL ?? "apunteshub@gmail.com";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TOPICS: Record<string, string> = {
  buscando: "No encuentro lo que busco",
  compra: "Problema con una compra o pago",
  cuenta: "Mi cuenta o acceso",
  vender: "Vender apuntes, cursos o clases",
  tecnico: "Algo no funciona",
  otro: "Otra consulta",
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as {
    email?: unknown;
    name?: unknown;
    topic?: unknown;
    message?: unknown;
    company?: unknown; // honeypot
  } | null;

  if (!payload) return jsonError("No pudimos leer tu mensaje. Probá de nuevo.", 400);

  // Honeypot: los bots completan este campo oculto.
  if (typeof payload.company === "string" && payload.company.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return jsonError("Ingresá un email válido para que podamos responderte.", 400);
  }

  const topicKey = typeof payload.topic === "string" ? payload.topic : "otro";
  const topicLabel = TOPICS[topicKey] ?? TOPICS.otro;

  const rawMessage = typeof payload.message === "string" ? payload.message.trim() : "";
  if (rawMessage.length < 10) {
    return jsonError("Contanos un poco más (al menos 10 caracteres).", 400);
  }
  if (rawMessage.length > 4000) {
    return jsonError("El mensaje es demasiado largo. Resumilo un poco.", 400);
  }

  const rawName = typeof payload.name === "string" ? payload.name.trim() : "";
  const name = rawName.length > 0 ? rawName.slice(0, 120) : null;

  // Si hay sesión, adjuntamos el id del usuario para dar contexto al equipo.
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }

  const emailContent = buildSupportRequestEmail({
    fromName: name,
    fromEmail: email,
    topicLabel,
    message: rawMessage,
    userId,
  });

  try {
    await sendTransactionalEmail({
      to: SUPPORT_INBOX,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
      replyTo: email,
      idempotencyKey: `support-${randomUUID()}`,
    });
  } catch (error) {
    console.error("[support] no se pudo enviar el email", error);
    return jsonError("No pudimos enviar tu mensaje. Probá de nuevo en un momento.", 502);
  }

  return NextResponse.json({ ok: true });
}
