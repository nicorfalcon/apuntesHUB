import {
  DeleteObjectCommand,
  GetObjectCommand,
  type GetObjectCommandOutput,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const UPLOAD_URL_EXPIRES_SECONDS = 15 * 60;
const READ_URL_EXPIRES_SECONDS = 20 * 60;
const HLS_SEGMENT_READ_URL_EXPIRES_SECONDS = 10 * 60;

let cachedClient: S3Client | null = null;

function requireEnv(name: string) {
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
    credentials: {
      accessKeyId: requireEnv("B2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("B2_SECRET_ACCESS_KEY"),
    },
  });

  return cachedClient;
}

export async function createCourseVideoUploadUrl({
  key,
  contentType,
}: {
  key: string;
  contentType: string;
  size: number;
}) {
  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(getClient(), command, {
    expiresIn: UPLOAD_URL_EXPIRES_SECONDS,
  });
}

export async function createCourseVideoReadUrl(key: string) {
  const command = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  });

  return getSignedUrl(getClient(), command, {
    expiresIn: READ_URL_EXPIRES_SECONDS,
  });
}

export async function createCourseHlsSegmentReadUrl(key: string) {
  const command = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  });

  return getSignedUrl(getClient(), command, {
    expiresIn: HLS_SEGMENT_READ_URL_EXPIRES_SECONDS,
  });
}

async function objectBodyToBytes(body: GetObjectCommandOutput["Body"]) {
  if (!body) {
    throw new Error("El objeto privado no tiene body.");
  }

  const transformableBody = body as {
    transformToByteArray?: () => Promise<Uint8Array>;
  };

  if (typeof transformableBody.transformToByteArray === "function") {
    return transformableBody.transformToByteArray();
  }

  const chunks: Uint8Array[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array | Buffer | string>) {
    if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk));
    } else {
      chunks.push(chunk);
    }
  }

  return Buffer.concat(chunks);
}

export async function readPrivateObjectBytes(key: string) {
  const command = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  });
  const response = await getClient().send(command);

  return objectBodyToBytes(response.Body);
}

export async function readPrivateObjectText(key: string) {
  const bytes = await readPrivateObjectBytes(key);
  return Buffer.from(bytes).toString("utf8");
}

export async function getCourseVideoMetadata(key: string) {
  const command = new HeadObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  });

  return getClient().send(command);
}

export async function deleteCourseVideo(key: string) {
  const command = new DeleteObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  });

  await getClient().send(command);
}
