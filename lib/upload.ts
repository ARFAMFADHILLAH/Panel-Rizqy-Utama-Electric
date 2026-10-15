import "server-only";

import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const MAX_BYTES = 2 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Gambar produk disimpan di Supabase Storage, bukan filesystem lokal — panel
 * berjalan di serverless (Vercel) yang filesystem-nya read-only dan tidak
 * persisten. Bucket wajib publik agar URL-nya bisa dirender oleh toko pada
 * origin berbeda. Kolom products.image menyimpan URL publik ini.
 */
function bucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET ?? "product-images";
}

let client: SupabaseClient | undefined;

function storage(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase Storage belum dikonfigurasi. Isi SUPABASE_URL dan "
        + "SUPABASE_SERVICE_ROLE_KEY di .env.local.",
    );
  }
  if (!client) {
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

/** Awalan URL publik objek di bucket — juga penanda file milik panel ini. */
function publicPrefix(): string | null {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  return url ? `${url}/storage/v1/object/public/${bucket()}/` : null;
}

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Simpan gambar ke Supabase Storage dan kembalikan URL publiknya.
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

  const prefix = publicPrefix();
  if (!prefix) {
    return { ok: false, error: "SUPABASE_URL belum dikonfigurasi." };
  }

  const filename = `${Date.now()}-${randomUUID().slice(0, 8)}.${extension}`;

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const { error } = await storage()
      .storage.from(bucket())
      .upload(filename, bytes, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
    if (error) {
      return { ok: false, error: `Gagal mengunggah gambar: ${error.message}` };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Gagal mengunggah gambar: ${message}` };
  }

  return { ok: true, url: `${prefix}${filename}` };
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

/** Ambil nama objek bila URL termasuk bucket panel ini; selain itu null. */
function uploadedFilename(url: string | null): string | null {
  if (!url) return null;
  const prefix = publicPrefix();
  if (!prefix || !url.startsWith(prefix)) return null;

  const filename = url.slice(prefix.length);
  if (!filename || filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    return null;
  }
  return filename;
}

/**
 * Hapus file gambar milik panel ini saja. URL eksternal (misalnya gambar di
 * hosting/CDN lain) dibiarkan apa adanya.
 */
export async function deleteUploadedImage(url: string | null): Promise<boolean> {
  const filename = uploadedFilename(url);
  if (!filename) return false;

  try {
    const { error } = await storage().storage.from(bucket()).remove([filename]);
    return !error;
  } catch {
    return false;
  }
}
