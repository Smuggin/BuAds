/**
 * AES-256-GCM encryption for the Meta access token at rest (MetaToken.accessTokenEnc).
 * Key from META_TOKEN_ENC_KEY (32 bytes base64). Server-only — never imported by client.
 * Layout: [12-byte iv][16-byte authTag][ciphertext].
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key(): Buffer {
  const b64 = process.env.META_TOKEN_ENC_KEY;
  if (!b64) throw new Error("META_TOKEN_ENC_KEY is not set");
  const k = Buffer.from(b64, "base64");
  if (k.length !== 32) throw new Error("META_TOKEN_ENC_KEY must be 32 bytes (base64)");
  return k;
}

export function encryptToken(plain: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]);
}

export function decryptToken(buf: Buffer): string {
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
