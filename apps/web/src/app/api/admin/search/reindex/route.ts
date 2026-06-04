// Endpoint protegido para sincronizar el índice de Meilisearch (PoC browse).
//
// Operaciones:
//   - Reindex puntual de un apunte:   POST { resumeId }            (action "index", default)
//   - Remover un apunte del índice:   POST { resumeId, action: "remove" }
//   - Reindex masivo de publicados:   POST { action: "reindex-all" }
//
// Autorización:
//   - Reindex/remove puntual: lo puede hacer el SELLER dueño del apunte
//     (autenticado) o un portador del secret admin.
//   - Reindex masivo: SOLO con el secret admin (Authorization: Bearer <secret>,
//     env MEILISEARCH_ADMIN_SECRET).
//
// El índice nunca es fuente de permisos: indexResumeInSearch revalida contra
// Supabase. Logs seguros (sin contenido/keys).

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import {
  indexResumeInSearch,
  removeResumeFromSearch,
  reindexPublishedResumes,
  isMeilisearchConfigured,
} from "@/lib/search/meilisearch";

export const maxDuration = 300;

type Action = "index" | "remove" | "reindex-all";

function hasValidAdminSecret(request: NextRequest): boolean {
  const expected = process.env.MEILISEARCH_ADMIN_SECRET;
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : "";
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!isMeilisearchConfigured()) {
    return NextResponse.json(
      { error: "Meilisearch no está configurado" },
      { status: 503 }
    );
  }

  let body: { resumeId?: string; action?: Action };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const action: Action = body.action ?? "index";
  const isAdmin = hasValidAdminSecret(request);

  // Reindex masivo: solo admin.
  if (action === "reindex-all") {
    if (!isAdmin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
    try {
      const summary = await reindexPublishedResumes();
      console.info("[admin:search] reindex-all done", summary);
      return NextResponse.json({ ok: true, ...summary });
    } catch (err) {
      console.warn("[admin:search] reindex-all failed", {
        message: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        { error: "Falló el reindexado" },
        { status: 500 }
      );
    }
  }

  // Operaciones puntuales requieren resumeId.
  const resumeId = (body.resumeId ?? "").trim();
  if (!resumeId) {
    return NextResponse.json(
      { error: "resumeId es requerido" },
      { status: 400 }
    );
  }

  // Autorización puntual: admin o seller dueño del apunte.
  if (!isAdmin) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const { data: resume, error } = await supabase
      .from("resumes")
      .select("id, seller_id")
      .eq("id", resumeId)
      .maybeSingle();
    if (error || !resume) {
      return NextResponse.json(
        { error: "Apunte no encontrado" },
        { status: 404 }
      );
    }
    if ((resume as { seller_id: string }).seller_id !== user.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }
  }

  try {
    if (action === "remove") {
      await removeResumeFromSearch(resumeId);
      console.info("[admin:search] removed from index", { resumeId });
      return NextResponse.json({ ok: true, status: "removed" });
    }
    const result = await indexResumeInSearch(resumeId);
    console.info("[admin:search] indexed", { resumeId, status: result.status });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.warn("[admin:search] operation failed", {
      resumeId,
      action,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Falló la operación de búsqueda" },
      { status: 500 }
    );
  }
}
