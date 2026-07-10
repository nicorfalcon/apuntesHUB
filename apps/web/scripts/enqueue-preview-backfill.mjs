#!/usr/bin/env node
// Encola la generación de vista previa para los apuntes publicados que todavía no
// la tienen (preview_status = 'none'). Uno-shot: solo marca 'pending'. Después
// correr `npm run preview:process-pending` en tandas para renderizarlos.
//
// Uso:
//   npm run preview:backfill [-- --dry-run]

import process from "node:process";
import { loadEnvFiles, createAdminClient } from "./lib/hls-conversion.mjs";

function parseArgs(argv) {
  const args = { dryRun: false, help: false };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--dry-run") args.dryRun = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      "Uso: npm run preview:backfill [-- --dry-run]\n" +
        "Marca 'pending' los apuntes publicados con preview_status='none' y file_url."
    );
    return;
  }

  await loadEnvFiles();
  const supabase = await createAdminClient();

  const { data: pending, error } = await supabase
    .from("resumes")
    .select("id")
    .eq("status", "published")
    .eq("preview_status", "none")
    .not("file_url", "is", null);

  if (error) {
    console.error("Error al consultar apuntes:", error.message);
    process.exit(1);
  }

  const count = pending?.length ?? 0;
  console.log(`Apuntes a encolar: ${count}`);

  if (args.dryRun || count === 0) {
    if (args.dryRun) console.log("(dry-run: no se modificó nada)");
    return;
  }

  const { error: updErr } = await supabase
    .from("resumes")
    .update({ preview_status: "pending" })
    .eq("status", "published")
    .eq("preview_status", "none")
    .not("file_url", "is", null);

  if (updErr) {
    console.error("Error al encolar:", updErr.message);
    process.exit(1);
  }

  console.log(
    `Encolados ${count} apuntes. Corré 'npm run preview:process-pending' para generarlos.`
  );
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
