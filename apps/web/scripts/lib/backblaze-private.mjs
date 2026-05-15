import { createReadStream, createWriteStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const MAX_UPLOAD_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [1000, 2000];
const BUFFER_UPLOAD_MAX_BYTES = 1024 * 1024;

let cachedClient = null;

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta configurar ${name}`);
  }
  return value;
}

function getBucketName() {
  return requireEnv("B2_BUCKET_NAME");
}

function getClient() {
  if (cachedClient) return cachedClient;

  cachedClient = new S3Client({
    endpoint: requireEnv("B2_ENDPOINT"),
    region: requireEnv("B2_REGION"),
    forcePathStyle: true,
    maxAttempts: 1,
    credentials: {
      accessKeyId: requireEnv("B2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("B2_SECRET_ACCESS_KEY"),
    },
  });

  return cachedClient;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getAwsErrorDetails(error) {
  const metadata = error?.$metadata ?? {};
  const responseHeaders = error?.$response?.headers ?? {};
  const messages = [
    error?.message,
    error?.cause?.message,
    error?.Code,
    error?.code,
  ].filter(Boolean);

  return {
    statusCode:
      metadata.httpStatusCode ??
      error?.$response?.statusCode ??
      error?.statusCode ??
      null,
    requestId:
      metadata.requestId ??
      metadata.extendedRequestId ??
      responseHeaders["x-amz-request-id"] ??
      responseHeaders["x-bz-request-id"] ??
      error?.requestId ??
      null,
    message: [...new Set(messages)].join(" | ") || String(error),
  };
}

function formatUploadFailureMessage({
  uploadLabel,
  key,
  filePath,
  statusCode,
  requestId,
  message,
}) {
  return [
    `Upload failed for ${uploadLabel}`,
    `Object key: ${key}`,
    `Local file: ${filePath}`,
    `Status: ${statusCode ?? "unknown"}`,
    `Request id: ${requestId ?? "unknown"}`,
    `Message: ${message}`,
  ].join("\n");
}

function summarizeUploadError(error) {
  const details = getAwsErrorDetails(error);
  return `status=${details.statusCode ?? "unknown"} request_id=${
    details.requestId ?? "unknown"
  } message=${details.message}`;
}

class UploadObjectError extends Error {
  constructor({ uploadLabel, key, filePath, cause }) {
    const details = getAwsErrorDetails(cause);
    super(
      formatUploadFailureMessage({
        uploadLabel,
        key,
        filePath,
        statusCode: details.statusCode,
        requestId: details.requestId,
        message: details.message,
      })
    );
    this.name = "UploadObjectError";
    this.cause = cause;
    this.objectKey = key;
    this.filePath = filePath;
    this.statusCode = details.statusCode;
    this.requestId = details.requestId;
  }
}

async function createUploadBody(filePath, size) {
  if (size <= BUFFER_UPLOAD_MAX_BYTES) {
    return readFile(filePath);
  }

  return createReadStream(filePath);
}

export async function downloadPrivateObjectToFile({ key, destinationPath }) {
  const command = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  });
  const response = await getClient().send(command);

  if (!response.Body) {
    throw new Error(`El objeto ${key} no tiene body descargable.`);
  }

  await pipeline(response.Body, createWriteStream(destinationPath));
}

export async function uploadPrivateObjectFromFile({
  key,
  filePath,
  contentType,
  cacheControl,
  uploadLabel = "file",
}) {
  const fileStat = await stat(filePath);
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt += 1) {
    try {
      const command = new PutObjectCommand({
        Bucket: getBucketName(),
        Key: key,
        Body: await createUploadBody(filePath, fileStat.size),
        ContentLength: fileStat.size,
        ContentType: contentType,
        CacheControl: cacheControl,
      });

      await getClient().send(command);
      return;
    } catch (error) {
      lastError = error;

      if (attempt < MAX_UPLOAD_ATTEMPTS) {
        const delay = RETRY_DELAYS_MS[attempt - 1] ?? 2000;
        console.warn(
          `Upload retry ${attempt + 1}/${MAX_UPLOAD_ATTEMPTS} for ${uploadLabel}: ${key}. ` +
            `Previous error: ${summarizeUploadError(error)}`
        );
        await sleep(delay);
      }
    }
  }

  throw new UploadObjectError({
    uploadLabel,
    key,
    filePath,
    cause: lastError,
  });
}

export async function deletePrivateObjectsByPrefix({ prefix }) {
  let continuationToken;
  let deletedCount = 0;

  do {
    const listResponse = await getClient().send(
      new ListObjectsV2Command({
        Bucket: getBucketName(),
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );
    const objects = (listResponse.Contents ?? []).filter((object) => object.Key);

    if (objects.length > 0) {
      await getClient().send(
        new DeleteObjectsCommand({
          Bucket: getBucketName(),
          Delete: {
            Objects: objects.map((object) => ({ Key: object.Key })),
            Quiet: true,
          },
        })
      );
      deletedCount += objects.length;
    }

    continuationToken = listResponse.IsTruncated
      ? listResponse.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return deletedCount;
}
