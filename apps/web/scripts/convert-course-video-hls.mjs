#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import process from "node:process";
import {
  DEFAULT_HLS_TIME_SECONDS,
  assertFfmpegAvailable,
  createAdminClient,
  loadEnvFiles,
  maybeActivateAsset,
  processAsset,
} from "./lib/hls-conversion.mjs";

function printHelp() {
  console.log(`Uso:
  npm run hls:convert -- --course-id COURSE_ID --module-id MODULE_ID

Opciones:
  --course-id <uuid>    Curso grabado dueño del módulo.
  --module-id <uuid>    Módulo cuyo MP4 actual se convertirá a HLS.
  --hls-time <segundos> Duración de segmento entre 6 y 10. Default: 10.
  --activate            Intentar activar el asset si no hay otro activo.
  --help                Muestra esta ayuda.

Crea un asset nuevo en course_video_assets y procesa el MP4 actual del módulo
a HLS AES-128. Por default el asset queda is_active=false (uso debug/manual).`);
}

function parseArgs(argv) {
  const args = {
    courseId: "",
    moduleId: "",
    hlsTime: DEFAULT_HLS_TIME_SECONDS,
    activate: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }

    if (arg === "--course-id") {
      args.courseId = argv[index + 1] ?? "";
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

    if (arg === "--activate") {
      args.activate = true;
      continue;
    }

    throw new Error(`Argumento no reconocido: ${arg}`);
  }

  return args;
}

async function getCourseModule({ supabase, courseId, moduleId }) {
  const { data, error } = await supabase
    .from("course_modules")
    .select("id, course_id, duration_seconds, video_storage_key")
    .eq("id", moduleId)
    .eq("course_id", courseId)
    .single();

  if (error || !data) {
    throw new Error("No encontré el módulo para el curso indicado.");
  }

  if (!data.video_storage_key) {
    throw new Error("El módulo no tiene video_storage_key para convertir.");
  }

  return data;
}

async function createProcessingAsset({
  supabase,
  moduleId,
  originalVideoStorageKey,
}) {
  const assetId = randomUUID();
  const { error } = await supabase.from("course_video_assets").insert({
    id: assetId,
    module_id: moduleId,
    original_video_storage_key: originalVideoStorageKey,
    processing_status: "processing",
    is_active: false,
  });

  if (error) {
    throw new Error(`No pude crear course_video_assets: ${error.message}`);
  }

  return assetId;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (!args.courseId || !args.moduleId) {
    throw new Error("Tenés que pasar --course-id y --module-id.");
  }

  if (!Number.isFinite(args.hlsTime) || args.hlsTime < 6 || args.hlsTime > 10) {
    throw new Error("--hls-time debe estar entre 6 y 10 segundos.");
  }

  await loadEnvFiles();
  const ffmpegBin = process.env.FFMPEG_PATH || "ffmpeg";
  await assertFfmpegAvailable(ffmpegBin);

  const supabase = await createAdminClient();

  console.log("Buscando módulo y MP4 original...");
  const courseModule = await getCourseModule({
    supabase,
    courseId: args.courseId,
    moduleId: args.moduleId,
  });

  const assetId = await createProcessingAsset({
    supabase,
    moduleId: args.moduleId,
    originalVideoStorageKey: courseModule.video_storage_key,
  });

  const result = await processAsset({
    supabase,
    ffmpegBin,
    hlsTime: args.hlsTime,
    asset: {
      id: assetId,
      module_id: args.moduleId,
      original_video_storage_key: courseModule.video_storage_key,
    },
    courseId: args.courseId,
  });

  console.log("Asset HLS listo.");
  console.log(`asset_id: ${result.assetId}`);
  console.log(`playlist: ${result.storageKeys.playlistKey}`);
  console.log(`segment_prefix: ${result.storageKeys.segmentPrefix}`);

  if (args.activate) {
    const activated = await maybeActivateAsset({
      supabase,
      assetId: result.assetId,
      moduleId: args.moduleId,
    });
    console.log(
      activated
        ? "Asset activado (is_active=true)."
        : "Asset NO activado: ya existe otro asset activo para este módulo."
    );
  } else {
    console.log("Asset queda inactivo. Pasá --activate o activalo manualmente.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
