#!/usr/bin/env node

import process from "node:process";
import {
  DEFAULT_HLS_TIME_SECONDS,
  assertFfmpegAvailable,
  createAdminClient,
  loadEnvFiles,
  markAssetFailed,
  maybeActivateAsset,
  processAsset,
} from "./lib/hls-conversion.mjs";

function printHelp() {
  console.log(`Uso:
  npm run hls:process-pending [-- --limit N] [--module-id MODULE_ID]

Opciones:
  --limit N             Máximo de assets a procesar en esta corrida. Default: 5.
  --module-id <uuid>    Procesar sólo assets pending del módulo indicado.
  --hls-time <segundos> Duración de segmento entre 6 y 10. Default: 10.
  --help                Muestra esta ayuda.

Reclama assets en estado 'pending' (FIFO), los marca 'processing', descarga el
MP4 original, genera HLS AES-128, sube a B2 y marca 'ready'. Si el asset es el
primero del módulo (no hay otro activo), lo activa automáticamente.`);
}

function parseArgs(argv) {
  const args = {
    limit: 5,
    moduleId: "",
    hlsTime: DEFAULT_HLS_TIME_SECONDS,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }

    if (arg === "--limit") {
      args.limit = Number(argv[index + 1]);
      index += 1;
      continue;
    }

    if (arg === "--module-id") {
      args.moduleId = argv[index + 1] ?? "";
      index += 1;
      continue;
    }

    if (arg === "--hls-time") {
      args.hlsTime = Number(argv[index + 1]);
      index += 1;
      continue;
    }

    throw new Error(`Argumento no reconocido: ${arg}`);
  }

  return args;
}

async function pickNextPending({ supabase, moduleId }) {
  let query = supabase
    .from("course_video_assets")
    .select("id, module_id, original_video_storage_key, created_at")
    .eq("processing_status", "pending")
    .order("created_at", { ascending: true })
    .limit(1);

  if (moduleId) {
    query = query.eq("module_id", moduleId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`No pude listar assets pending: ${error.message}`);
  }

  return data && data.length > 0 ? data[0] : null;
}

async function claimPending({ supabase, assetId }) {
  const { data, error } = await supabase
    .from("course_video_assets")
    .update({ processing_status: "processing" })
    .eq("id", assetId)
    .eq("processing_status", "pending")
    .select("id");

  if (error) {
    throw new Error(`No pude reclamar asset ${assetId}: ${error.message}`);
  }

  return Array.isArray(data) && data.length > 0;
}

async function getModuleForAsset({ supabase, moduleId }) {
  const { data, error } = await supabase
    .from("course_modules")
    .select("id, course_id, video_storage_key")
    .eq("id", moduleId)
    .single();

  if (error || !data) {
    throw new Error(
      `No encontré course_modules ${moduleId}: ${error?.message ?? "no data"}`
    );
  }

  return data;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (!Number.isFinite(args.limit) || args.limit < 1 || args.limit > 100) {
    throw new Error("--limit debe estar entre 1 y 100.");
  }

  if (!Number.isFinite(args.hlsTime) || args.hlsTime < 6 || args.hlsTime > 10) {
    throw new Error("--hls-time debe estar entre 6 y 10 segundos.");
  }

  await loadEnvFiles();
  const ffmpegBin = process.env.FFMPEG_PATH || "ffmpeg";
  await assertFfmpegAvailable(ffmpegBin);

  const supabase = await createAdminClient();

  let processed = 0;
  let failures = 0;
  const seenAssetIds = new Set();

  while (processed + failures < args.limit) {
    const pending = await pickNextPending({
      supabase,
      moduleId: args.moduleId,
    });

    if (!pending) {
      console.log("No hay más assets pending.");
      break;
    }

    if (seenAssetIds.has(pending.id)) {
      console.log(
        `Asset ${pending.id} ya visto en esta corrida sin avanzar. Cortando para evitar loop.`
      );
      break;
    }
    seenAssetIds.add(pending.id);

    const claimed = await claimPending({ supabase, assetId: pending.id });
    if (!claimed) {
      console.log(`Asset ${pending.id} ya fue reclamado por otro proceso.`);
      continue;
    }

    console.log(`Procesando asset ${pending.id} (módulo ${pending.module_id})...`);

    let courseModule;
    try {
      courseModule = await getModuleForAsset({
        supabase,
        moduleId: pending.module_id,
      });
    } catch (error) {
      await markAssetFailed({ supabase, assetId: pending.id, error });
      failures += 1;
      console.error(error instanceof Error ? error.message : error);
      continue;
    }

    if (
      !courseModule.video_storage_key ||
      courseModule.video_storage_key !== pending.original_video_storage_key
    ) {
      const reason = new Error(
        "stale: course_modules.video_storage_key cambió o falta respecto al asset pending."
      );
      await markAssetFailed({ supabase, assetId: pending.id, error: reason });
      failures += 1;
      console.error(reason.message);
      continue;
    }

    try {
      const result = await processAsset({
        supabase,
        ffmpegBin,
        hlsTime: args.hlsTime,
        asset: pending,
        courseId: courseModule.course_id,
      });

      const activated = await maybeActivateAsset({
        supabase,
        assetId: result.assetId,
        moduleId: pending.module_id,
      });

      console.log(
        `Asset ${result.assetId} listo. ${
          activated
            ? "Activado (is_active=true)."
            : "Inactivo (ya había otro asset activo)."
        }`
      );
      processed += 1;
    } catch (error) {
      failures += 1;
      console.error(
        `Falló asset ${pending.id}: ${
          error instanceof Error ? error.message : error
        }`
      );
    }
  }

  console.log(`Resumen: ${processed} procesado(s), ${failures} fallido(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
