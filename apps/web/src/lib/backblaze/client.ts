import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const UPLOAD_URL_EXPIRES_SECONDS = 15 * 60;
const READ_URL_EXPIRES_SECONDS = 2 * 60 * 60;

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
