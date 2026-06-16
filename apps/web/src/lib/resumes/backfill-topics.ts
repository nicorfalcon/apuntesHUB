// Backfill de "Temas del apunte" (resumes.topics) para apuntes YA ingestados.
//
// Un apunte ingestado ya tiene los títulos de sección guardados en
// document_chunks.section_title (el "índice"/TOC). Este módulo los lee de la BD
// y los mergea a resumes.topics SIN re-ingestar (no baja el PDF ni re-genera
// embeddings). Misma política que el auto-completado en la ingesta: NUNCA pisa
// los temas que cargó el vendedor, solo rellena lugares libres.
//
// Server-only: usa el admin client (service role). No loguea contenido.

import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeSectionTitles } from "@/lib/search/chunk-terms";
import { mergeResumeTopics, normalizeResumeTopics } from "./topics";

// Tope de chunks a leer por apunte para derivar títulos. Igual criterio que la
// derivación de términos en meilisearch.ts: acota el trabajo, no afecta nada más.
const MAX_CHUNKS_FOR_TITLES = 600;

// Tamaño de lote para el backfill masivo.
const BACKFILL_BATCH_SIZE = 100;

export type TopicsBackfillStatus =
  | "updated" // se agregaron temas nuevos
  | "unchanged" // no había nada nuevo que agregar
  | "no-chunks" // el apunte no tiene títulos de sección aprovechables
  | "not-found"; // el apunte no existe

export type TopicsBackfillResult = {
  status: TopicsBackfillStatus;
  added: number;
};

/** Lee los títulos de sección (TOC) ya guardados en los chunks del apunte. */
async function readSectionTitles(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  resumeId: string
): Promise<string[]> {
  const { data, error } = await admin
    .from("document_chunks")
    .select("section_title")
    .eq("resume_id", resumeId)
    .order("chunk_index", { ascending: true })
    .limit(MAX_CHUNKS_FOR_TITLES);
  if (error || !data) return [];
  return normalizeSectionTitles(
    (data as Array<{ section_title: string | null }>).map((r) => r.section_title)
  );
}

/** Backfill de un apunte usando un admin client ya creado. */
async function backfillOne(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  resumeId: string
): Promise<TopicsBackfillResult> {
  const { data: resume, error } = await admin
    .from("resumes")
    .select("id, topics")
    .eq("id", resumeId)
    .maybeSingle();
  if (error || !resume) return { status: "not-found", added: 0 };

  const derived = await readSectionTitles(admin, resumeId);
  if (derived.length === 0) return { status: "no-chunks", added: 0 };

  const existing = normalizeResumeTopics(
    (resume as { topics: string[] | null }).topics ?? []
  );
  const merged = mergeResumeTopics(existing, derived);
  if (merged.length <= existing.length) {
    return { status: "unchanged", added: 0 };
  }

  const { error: updateError } = await admin
    .from("resumes")
    .update({ topics: merged })
    .eq("id", resumeId);
  if (updateError) {
    throw new Error(`topics backfill update failed: ${updateError.message}`);
  }

  return { status: "updated", added: merged.length - existing.length };
}

/**
 * Backfill puntual: completa topics de UN apunte ya ingestado a partir de los
 * títulos de sección guardados en sus chunks. No re-ingesta.
 */
export async function backfillResumeTopicsFromChunks(
  resumeId: string
): Promise<TopicsBackfillResult> {
  const admin = createAdminClient();
  return backfillOne(admin, resumeId);
}

export type TopicsBackfillSummary = {
  total: number;
  updated: number;
  unchanged: number;
};

/**
 * Backfill masivo: recorre TODOS los apuntes publicados y no eliminados y
 * completa sus topics desde los títulos de sección. No re-ingesta. Devuelve un
 * resumen (seguro de loguear).
 */
export async function backfillAllPublishedResumesTopics(): Promise<TopicsBackfillSummary> {
  const admin = createAdminClient();
  let total = 0;
  let updated = 0;
  let unchanged = 0;
  let offset = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await admin
      .from("resumes")
      .select("id")
      .eq("status", "published")
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .range(offset, offset + BACKFILL_BATCH_SIZE - 1);

    if (error) throw new Error(`backfill query failed: ${error.message}`);

    const rows = (data ?? []) as Array<{ id: string }>;
    if (rows.length === 0) break;

    for (const row of rows) {
      total += 1;
      const result = await backfillOne(admin, row.id);
      if (result.status === "updated") updated += 1;
      else unchanged += 1;
    }

    if (rows.length < BACKFILL_BATCH_SIZE) break;
    offset += BACKFILL_BATCH_SIZE;
  }

  return { total, updated, unchanged };
}
