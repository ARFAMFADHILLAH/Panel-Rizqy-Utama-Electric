import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const MAX_BYTES = 2 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Folder upload sengaja TIDAK memakai public/. Next.js memotret isi public/
 * saat build, sehingga file yang diunggah saat runtime tidak dilayani oleh
 * `next start` dan selalu 404. File dilayani lewat route handler
 * /uploads/[...path] supaya langsung bisa diakses tanpa rebuild.
 */
function uploadDir(): string {
  return path.join(process.cwd(), "uploads");
}

function publicBase(): string {
  return (process.env.ADMIN_PUBLIC_URL ?? "http://localhost:3001").replace(/\/+$/, "");
}

export function contentTypeFor(filename: string): string | null {
  switch (path.extname(filename).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    default:
      return null;
  }
}

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Simpan file gambar ke folder uploads/ dan kembalikan URL publiknya.
 * Nama file dibuat sendiri — nama asli dari browser tidak pernah dipakai.
 */
export async function saveProductImage(file: File): Promise<UploadResult> {
  const extension = ALLOWED[(file.type || "").toLowerCase()];
  if (!extension) {
    return { ok: false, error: "Format gambar harus JPEG, PNG, WEBP, atau GIF." };
  }
  if (file.size <= 0) {
    return { ok: false, error: "File gambar kosong." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Ukuran gambar maksimal 2 MB." };
  }

  const filename = `${Date.now()}-${randomUUID().slice(0, 8)}.${extension}`;
  const dir = uploadDir();
  await mkdir(dir, { recursive: true });

  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), bytes, { flag: "wx" });

  return { ok: true, url: `${publicBase()}/uploads/${filename}` };
}

/** Terima URL absolut http(s) atau path relatif yang diawali "/". */
export function normalizeImageUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Kolom products.image bertipe varchar(255).
  if (trimmed.length > 255) return null;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  if (/^https?:\/\/[^\s]+$/i.test(trimmed)) return trimmed;
  return null;
}

/** Cegah path traversal: hanya nama file sederhana tanpa awalan titik. */
function isSafeFilename(filename: string): boolean {
  return Boolean(
    filename &&
      !filename.includes("/") &&
      !filename.includes("\\") &&
      !filename.includes("..") &&
      !filename.startsWith("."),
  );
}

/** Ubah nama file dari URL panel menjadi path absolut yang aman, atau null. */
export function resolveUploadPath(url: string | null): string | null {
  if (!url) return null;

  const prefix = `${publicBase()}/uploads/`;
  if (!url.startsWith(prefix)) return null;

  const filename = url.slice(prefix.length);
  if (!isSafeFilename(filename) || !contentTypeFor(filename)) return null;

  const dir = uploadDir();
  const target = path.join(dir, filename);
  if (path.dirname(target) !== dir) return null;
  return target;
}

/** Baca file upload untuk dilayani route handler. */
export async function readUploadedImage(
  filename: string,
): Promise<{ ok: true; bytes: Buffer; type: string } | { ok: false }> {
  const type = contentTypeFor(filename);
  if (!type || !isSafeFilename(filename)) return { ok: false };

  const dir = uploadDir();
  const target = path.join(dir, filename);
  if (path.dirname(target) !== dir) return { ok: false };

  try {
    return { ok: true, bytes: await readFile(target), type };
  } catch {
    return { ok: false };
  }
}

/**
 * Hapus file gambar milik panel ini saja. URL eksternal (misalnya gambar di
 * hosting/CDN lain) dibiarkan apa adanya.
 */
export async function deleteUploadedImage(url: string | null): Promise<boolean> {
  const target = resolveUploadPath(url);
  if (!target) return false;

  try {
    await unlink(target);
    return true;
  } catch {
    return false;
  }
}
