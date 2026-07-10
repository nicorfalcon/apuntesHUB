#!/usr/bin/env node
// Limpia las imágenes de vista previa de apuntes BORRADOS (soft-delete: deleted_at
// no nulo). El endpoint ya no las sirve (404ea los borrados), así que esto es solo
// housekeeping de storage + filas. Además resetea preview_status a 'none' para que,
// si el apunte se re-publica alguna vez, se regenere la preview desde cero.
//
// Uso:
//   npm run preview:cleanup [-- --dry-run] [--limit N]

import process from "node:process";
import { loadEnvFiles, createAdminClient } from "./lib/hls-conversion.mjs";

const PREVIEWS_BUCKET = "resume-previews";

function parseArgs(argv) {
  const args = { dryRun: false, limit: 200, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--limit") args.limit = Number(argv[++i]);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      "Uso: npm run preview:cleanup [-- --dry-run] [--limit N]\n" +
        "Borra imágenes+filas de preview de apuntes con deleted_at y resetea su estado."
    );
    return;
  }

  await loadEnvFiles();
  const supabase = await createAdminClient();

  // Apuntes borrados que todavía tienen artefactos de preview.
  const { data: deleted, error } = await supabase
    .from("resumes")
    .select("id")
    .not("deleted_at", "is", null)
    .neq("preview_status", "none")
    .limit(Number.isFinite(args.limit) && args.limit > 0 ? args.limit : 200);

  if (error) {
    console.error("Error al consultar apuntes borrados:", error.message);
    process.exit(1);
  }

  const ids = (deleted ?? []).map((r) => r.id);
  console.log(`Apuntes borrados con preview a limpiar: ${ids.length}`);
  if (ids.length === 0) return;

  let cleaned = 0;
  for (const resumeId of ids) {
    const { data: pages } = await supabase
      .from("resume_preview_pages")
      .select("storage_path")
      .eq("resume_id", resumeId);

    const paths = (pages ?? []).map((p) => p.storage_path);

    if (args.dryRun) {
      console.log(`  [dry-run] ${resumeId}: ${paths.length} imágenes`);
      continue;
    }

    if (paths.length > 0) {
      const { error: rmErr } = await supabase.storage
        .from(PREVIEWS_BUCKET)
        .remove(paths);
      if (rmErr) {
        console.error(`  ✗ ${resumeId}: no pude borrar imágenes: ${rmErr.message}`);
        continue;
      }
    }

    await supabase.from("resume_preview_pages").delete().eq("resume_id", resumeId);
    await supabase
      .from("resumes")
      .update({ preview_status: "none", preview_page_count: null })
      .eq("id", resumeId);

    cleaned += 1;
    console.log(`  ✓ ${resumeId}: ${paths.length} imágenes borradas`);
  }

  if (!args.dryRun) {
    console.log(`\nHecho. Limpiados: ${cleaned}/${ids.length}.`);
  }
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
