import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import {
  uploadToBucket,
  safeKeySegment,
  storageConfigured,
} from "@/lib/storage";
import type { AttachmentKind } from "@prisma/client";
import { requireAuth } from "@/lib/auth/guard";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const KINDS: AttachmentKind[] = ["PRODUCT_IMAGE", "CREATIVE", "OTHER"];

/**
 * Upload a file to Supabase Storage and record an Attachment row.
 * multipart/form-data: file (required), kind?, sku? (link to a Product image).
 * Returns { id, url }.
 */
export async function POST(req: Request) {
  const denied = await requireAuth();
  if (denied) return denied;
  if (!storageConfigured()) {
    return NextResponse.json(
      { error: "storage not configured — set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY" },
      { status: 503 },
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "empty file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file too large (max 8MB)" }, { status: 413 });
  }

  const kindRaw = String(form.get("kind") ?? "OTHER").toUpperCase();
  const kind: AttachmentKind = KINDS.includes(kindRaw as AttachmentKind)
    ? (kindRaw as AttachmentKind)
    : "OTHER";
  const sku = form.get("sku") ? String(form.get("sku")) : null;

  // Link target first: validate sku before spending an upload.
  const product = sku ? await prisma.product.findUnique({ where: { sku } }) : null;
  if (sku && !product) {
    return NextResponse.json({ error: "unknown sku" }, { status: 404 });
  }

  const folder = kind === "PRODUCT_IMAGE" ? `products/${sku ?? "unsorted"}` : kind.toLowerCase();
  const path = `${folder}/${randomUUID()}-${safeKeySegment(file.name || "upload")}`;
  const buf = Buffer.from(await file.arrayBuffer());

  let uploaded;
  try {
    uploaded = await uploadToBucket(path, buf, file.type || "application/octet-stream");
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "upload failed" },
      { status: 502 },
    );
  }

  const user = await prisma.user.findFirst();
  const attachment = await prisma.attachment.create({
    data: {
      kind,
      bucket: uploaded.bucket,
      path: uploaded.path,
      url: uploaded.url,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      originalName: file.name || null,
      uploadedById: user?.id ?? null,
    },
  });

  if (product) {
    await prisma.product.update({
      where: { id: product.id },
      data: { imageId: attachment.id, imgUrl: attachment.url },
    });
  }

  return NextResponse.json({ id: attachment.id, url: attachment.url });
}
