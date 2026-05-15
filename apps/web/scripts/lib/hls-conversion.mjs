import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import {
  deletePrivateObjectsByPrefix,
  downloadPrivateObjectToFile,
  uploadPrivateObjectFromFile,
} from "./backblaze-private.mjs";

export const KEY_URI_PLACEHOLDER = "__HLS_KEY_URI__";
export const DEFAULT_HLS_TIME_SECONDS = 10;

const SCRIPT_LIB_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = path.resolve(SCRIPT_LIB_DIR, "..");
const WEB_DIR = path.resolve(SCRIPTS_DIR, "..");
const REPO_ROOT = path.resolve(WEB_DIR, "../..");

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const withoutExport = trimmed.startsWith("export ")
    ? trimmed.slice("export ".length).trim()
    : trimmed;
  const separatorIndex = withoutExport.indexOf("=");
  if (separatorIndex < 1) return null;

  const key = withoutExport.slice(0, separatorIndex).trim();
  let value = withoutExport.slice(separatorIndex + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

export async function loadEnvFiles() {
  const envFiles = [
    path.join(REPO_ROOT, ".env"),
    path.join(REPO_ROOT, ".env.local"),
    path.join(WEB_DIR, ".env"),
    path.join(WEB_DIR, ".env.local"),
  ];
  const loadedValues = new Map();

  for (const envFile of envFiles) {
    if (!existsSync(envFile)) continue;
    const contents = await readFile(envFile, "utf8");

    for (const line of contents.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (parsed) loadedValues.set(parsed.key, parsed.value);
    }
  }

  for (const [key, value] of loadedValues) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta configurar ${name}`);
  return value;
}

function getSupabaseUrl() {
  return process.env.SUPABASE_URL ?? requireEnv("NEXT_PUBLIC_SUPABASE_URL");
}

export async function createAdminClient() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(getSupabaseUrl(), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: options.stdio ?? "inherit",
      ...options,
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} terminó con código ${code ?? "desconocido"}.`));
    });
  });
}

export async function assertFfmpegAvailable(ffmpegBin) {
  await runCommand(ffmpegBin, ["-version"], { stdio: "ignore" }).catch(() => {
    throw new Error(
      `No encontré ${ffmpegBin}. Instalá FFmpeg o seteá FFMPEG_PATH con el binario correcto.`
    );
  });
}

export function truncateError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 2000);
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function buildStorageKeys({ courseId, moduleId, assetId }) {
  const assetPrefix = `courses/${courseId}/modules/${moduleId}/hls/${assetId}`;

  return {
    assetPrefix,
    playlistKey: `${assetPrefix}/index.m3u8`,
    segmentPrefix: `${assetPrefix}/segment_`,
    keyStorageKey: `${assetPrefix}/enc.key`,
  };
}

export async function writeEncryptionFiles({ workDir }) {
  const keyPath = path.join(workDir, "enc.key");
  const keyInfoPath = path.join(workDir, "key_info.txt");
  const iv = randomBytes(16).toString("hex");

  await writeFile(keyPath, randomBytes(16), { mode: 0o600 });
  await writeFile(
    keyInfoPath,
    `${KEY_URI_PLACEHOLDER}\n${keyPath}\n${iv}\n`,
    { mode: 0o600 }
  );

  return { keyPath, keyInfoPath };
}

export async function convertToHls({
  ffmpegBin,
  inputPath,
  outputDir,
  keyInfoPath,
  hlsTime,
}) {
  await mkdir(outputDir, { recursive: true });

  await runCommand(ffmpegBin, [
    "-hide_banner",
    "-y",
    "-i",
    inputPath,
    "-c:v",
    "h264",
    "-preset",
    "veryfast",
    "-crf",
    "22",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-ac",
    "2",
    "-hls_time",
    String(hlsTime),
    "-hls_playlist_type",
    "vod",
    "-hls_flags",
    "independent_segments",
    "-hls_key_info_file",
    keyInfoPath,
    "-hls_segment_filename",
    path.join(outputDir, "segment_%05d.ts"),
    path.join(outputDir, "index.m3u8"),
  ]);
}

export async function getGeneratedFiles(outputDir) {
  const files = await readdir(outputDir);
  const segmentFiles = files
    .filter((file) => /^segment_\d+\.ts$/.test(file))
    .sort();

  if (!files.includes("index.m3u8")) {
    throw new Error("FFmpeg no generó index.m3u8.");
  }

  if (segmentFiles.length === 0) {
    throw new Error("FFmpeg no generó segmentos HLS.");
  }

  return {
    playlistPath: path.join(outputDir, "index.m3u8"),
    segmentFiles,
  };
}

export function getPlaylistDurationSeconds(playlist) {
  const duration = playlist
    .split(/\r?\n/)
    .filter((line) => line.startsWith("#EXTINF:"))
    .map((line) => Number(line.replace("#EXTINF:", "").split(",")[0]))
    .filter((value) => Number.isFinite(value) && value > 0)
    .reduce((sum, value) => sum + value, 0);

  return duration > 0 ? Math.round(duration) : null;
}

export async function uploadHlsFiles({
  outputDir,
  keyPath,
  playlistPath,
  segmentFiles,
  storageKeys,
}) {
  async function uploadWithLog({
    logLabel,
    uploadLabel,
    key,
    filePath,
    contentType,
    cacheControl,
  }) {
    const fileStat = await stat(filePath);
    console.log(`Subiendo ${logLabel}: ${key} (${formatBytes(fileStat.size)})`);

    await uploadPrivateObjectFromFile({
      key,
      filePath,
      contentType,
      cacheControl,
      uploadLabel,
    });
  }

  await uploadWithLog({
    logLabel: "key",
    uploadLabel: "key",
    key: storageKeys.keyStorageKey,
    filePath: keyPath,
    contentType: "application/octet-stream",
    cacheControl: "private, no-store",
  });

  for (const [index, segmentFile] of segmentFiles.entries()) {
    const segmentNumber = index + 1;

    await uploadWithLog({
      logLabel: `segmento ${segmentNumber}/${segmentFiles.length}`,
      uploadLabel: `segment ${segmentNumber}/${segmentFiles.length}`,
      key: `${storageKeys.assetPrefix}/${segmentFile}`,
      filePath: path.join(outputDir, segmentFile),
      contentType: "video/mp2t",
      cacheControl: "private, max-age=31536000, immutable",
    });
  }

  await uploadWithLog({
    logLabel: "playlist",
    uploadLabel: "playlist",
    key: storageKeys.playlistKey,
    filePath: playlistPath,
    contentType: "application/vnd.apple.mpegurl",
    cacheControl: "private, no-store",
  });
}

function assertSafeHlsCleanupPrefix({ prefix, courseId, moduleId, assetId }) {
  const expectedPrefix = `courses/${courseId}/modules/${moduleId}/hls/${assetId}/`;

  if (
    prefix !== expectedPrefix ||
    !prefix.includes("/hls/") ||
    !prefix.includes(assetId) ||
    !prefix.startsWith(expectedPrefix)
  ) {
    throw new Error(`Prefix HLS inseguro para cleanup: ${prefix}`);
  }
}

export async function cleanupPartialHlsUpload({
  courseId,
  moduleId,
  assetId,
  storageKeys,
}) {
  const prefix = `${storageKeys.assetPrefix}/`;

  try {
    assertSafeHlsCleanupPrefix({ prefix, courseId, moduleId, assetId });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    console.error(`Cleanup manual requerido en B2: ${prefix}`);
    return;
  }

  try {
    console.warn(`Intentando cleanup best-effort en B2: ${prefix}`);
    const deletedCount = await deletePrivateObjectsByPrefix({ prefix });
    console.warn(
      `Cleanup B2 completado para ${prefix}. Objetos borrados: ${deletedCount}`
    );
  } catch (error) {
    console.error(
      `No pude completar el cleanup automático de B2: ${
        error instanceof Error ? error.message : error
      }`
    );
    console.error(`Cleanup manual requerido en B2: ${prefix}`);
  }
}

export async function markAssetReady({ supabase, assetId, durationSeconds }) {
  const { error } = await supabase
    .from("course_video_assets")
    .update({
      processing_status: "ready",
      error_message: null,
      duration_seconds: durationSeconds,
    })
    .eq("id", assetId);

  if (error) {
    throw new Error(`No pude marcar el asset como ready: ${error.message}`);
  }
}

export async function markAssetFailed({ supabase, assetId, error }) {
  if (!assetId) return;

  const { error: updateError } = await supabase
    .from("course_video_assets")
    .update({
      processing_status: "failed",
      error_message: truncateError(error),
      is_active: false,
    })
    .eq("id", assetId);

  if (updateError) {
    console.error(`No pude marcar el asset como failed: ${updateError.message}`);
  }
}

/**
 * Procesa un asset ya existente (id, module_id, original_video_storage_key conocidos),
 * descargando el MP4, convirtiendo a HLS AES-128, subiendo y marcando ready/failed.
 * El caller es responsable de haberlo dejado en processing_status='processing'.
 */
export async function processAsset({
  supabase,
  ffmpegBin,
  hlsTime,
  asset,
  courseId,
}) {
  const storageKeys = buildStorageKeys({
    courseId,
    moduleId: asset.module_id,
    assetId: asset.id,
  });
  let workDir = "";
  let uploadStarted = false;

  try {
    const { error: setKeysError } = await supabase
      .from("course_video_assets")
      .update({
        hls_playlist_storage_key: storageKeys.playlistKey,
        hls_segment_prefix: storageKeys.segmentPrefix,
        hls_key_storage_key: storageKeys.keyStorageKey,
      })
      .eq("id", asset.id);

    if (setKeysError) {
      throw new Error(
        `No pude guardar storage keys del asset: ${setKeysError.message}`
      );
    }

    workDir = await mkdtemp(path.join(tmpdir(), "apunteshub-hls-"));
    const inputPath = path.join(workDir, "input-video");
    const outputDir = path.join(workDir, "hls");

    console.log("Descargando MP4 privado desde B2...");
    await downloadPrivateObjectToFile({
      key: asset.original_video_storage_key,
      destinationPath: inputPath,
    });

    console.log("Generando key AES-128 y playlist HLS...");
    const { keyPath, keyInfoPath } = await writeEncryptionFiles({ workDir });
    await convertToHls({
      ffmpegBin,
      inputPath,
      outputDir,
      keyInfoPath,
      hlsTime,
    });

    const { playlistPath, segmentFiles } = await getGeneratedFiles(outputDir);
    const playlist = await readFile(playlistPath, "utf8");
    const durationSeconds = getPlaylistDurationSeconds(playlist);

    if (!playlist.includes(KEY_URI_PLACEHOLDER)) {
      throw new Error("La playlist generada no contiene __HLS_KEY_URI__.");
    }

    console.log(
      `Subiendo key, ${segmentFiles.length} segmentos y playlist a B2...`
    );
    uploadStarted = true;
    await uploadHlsFiles({
      outputDir,
      keyPath,
      playlistPath,
      segmentFiles,
      storageKeys,
    });

    await markAssetReady({ supabase, assetId: asset.id, durationSeconds });

    return { assetId: asset.id, durationSeconds, storageKeys };
  } catch (error) {
    if (uploadStarted) {
      await cleanupPartialHlsUpload({
        courseId,
        moduleId: asset.module_id,
        assetId: asset.id,
        storageKeys,
      });
    }

    await markAssetFailed({ supabase, assetId: asset.id, error });
    throw error;
  } finally {
    if (workDir) {
      await rm(workDir, { recursive: true, force: true });
    }
  }
}

/**
 * Activa el asset solo si no hay otro asset activo para el mismo módulo.
 * Devuelve true si quedó activo, false si ya había uno activo o si hubo conflicto.
 */
export async function maybeActivateAsset({ supabase, assetId, moduleId }) {
  const { data: activeOthers, error: selectError } = await supabase
    .from("course_video_assets")
    .select("id")
    .eq("module_id", moduleId)
    .eq("is_active", true)
    .neq("id", assetId)
    .limit(1);

  if (selectError) {
    console.warn(
      `No pude verificar assets activos para módulo ${moduleId}: ${selectError.message}`
    );
    return false;
  }

  if (activeOthers && activeOthers.length > 0) {
    return false;
  }

  const { error: updateError } = await supabase
    .from("course_video_assets")
    .update({
      is_active: true,
      activated_at: new Date().toISOString(),
    })
    .eq("id", assetId)
    .eq("is_active", false);

  if (updateError) {
    console.warn(
      `No activé el asset ${assetId} (posible carrera): ${updateError.message}`
    );
    return false;
  }

  return true;
}
