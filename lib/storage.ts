/**
 * Object storage via the S3 protocol (Supabase Storage S3-compatible endpoint,
 * or any S3 bucket). Server-only — credentials must never reach the client.
 * Bytes live in the bucket; metadata lives in the `Attachment` table.
 */
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const ENDPOINT = process.env.S3_ENDPOINT; // e.g. https://<ref>.storage.supabase.co/storage/v1/s3
const REGION = process.env.S3_REGION ?? "us-east-1";
const ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;
export const STORAGE_BUCKET = process.env.S3_BUCKET ?? "attachments";
// Optional explicit public base; otherwise derived from the Supabase S3 endpoint.
const PUBLIC_BASE = process.env.S3_PUBLIC_BASE_URL;

let client: S3Client | null = null;

/** True when S3 storage is configured (endpoint + credentials present). */
export function storageConfigured(): boolean {
  return !!(ENDPOINT && ACCESS_KEY_ID && SECRET_ACCESS_KEY);
}

function s3(): S3Client {
  if (!ENDPOINT || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    throw new Error(
      "S3 storage not configured — set S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY",
    );
  }
  client ??= new S3Client({
    region: REGION,
    endpoint: ENDPOINT,
    forcePathStyle: true, // required by Supabase Storage's S3 gateway
    credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
  });
  return client;
}

/**
 * Resolve a public URL for a stored object.
 * Supabase: swap the S3 path suffix for the public-object path. Custom S3:
 * set S3_PUBLIC_BASE_URL to "<base>/<bucket>" (or "<base>").
 */
function publicUrl(path: string): string {
  if (PUBLIC_BASE) return `${PUBLIC_BASE.replace(/\/$/, "")}/${path}`;
  if (ENDPOINT && /\/storage\/v1\/s3\/?$/.test(ENDPOINT)) {
    const base = ENDPOINT.replace(/\/storage\/v1\/s3\/?$/, "/storage/v1/object/public");
    return `${base}/${STORAGE_BUCKET}/${path}`;
  }
  // Generic path-style fallback.
  return `${ENDPOINT?.replace(/\/$/, "")}/${STORAGE_BUCKET}/${path}`;
}

export type UploadResult = { bucket: string; path: string; url: string };

/**
 * Upload bytes to the bucket and return a resolvable URL.
 * `path` is the object key (e.g. "products/SRM-01/uuid-name.png").
 */
export async function uploadToBucket(
  path: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<UploadResult> {
  await s3().send(
    new PutObjectCommand({
      Bucket: STORAGE_BUCKET,
      Key: path,
      Body: body,
      ContentType: contentType,
    }),
  );
  return { bucket: STORAGE_BUCKET, path, url: publicUrl(path) };
}

/** Remove an object from the bucket (best-effort). */
export async function removeFromBucket(path: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: STORAGE_BUCKET, Key: path }));
}

/** Sanitize a filename into a safe object-key segment. */
export function safeKeySegment(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 80);
}
