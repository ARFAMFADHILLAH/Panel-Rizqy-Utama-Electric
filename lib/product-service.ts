import "server-only";

import { query } from "@/lib/db";
import { checkLowStockAndNotify } from "@/lib/notify";
import { isSkuTaken, uniqueProductSlug } from "@/lib/slug";
import { deleteUploadedImage } from "@/lib/upload";
import type { Category } from "@/lib/types";

/**
 * Batas kolom `integer` — sama untuk Postgres maupun MySQL `int`.
 * Lewati batas ini akan jadi error 500.
 */
export const MAX_INT = 2147483647;

/** Batas kolom varchar(255) dan TEXT (65.535 byte) di MySQL. */
export const MAX_VARCHAR = 255;
export const MAX_TEXT_BYTES = 65535;

export type ProductPayload = {
  name: string;
  slugInput: string | null;
  sku: string | null;
  categoryId: number;
  price: number;
  stock: number;
  description: string | null;
  featured: boolean;
  isActive: boolean;
};

export type RawProductInput = {
  name: unknown;
  slugInput?: unknown;
  sku?: unknown;
  categoryId: unknown;
  price: unknown;
  stock: unknown;
  description?: unknown;
  featured?: unknown;
  isActive?: unknown;
};

export type ValidationResult = { error: string } | { data: ProductPayload };

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalText(value: unknown): string | null {
  const text = asString(value);
  return text === "" ? null : text;
}

function asInteger(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? Math.trunc(value) : NaN;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return 0;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : NaN;
  }
  if (typeof value === "boolean") return value ? 1 : 0;
  return NaN;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "on", "ya", "yes"].includes(normalized)) return true;
    if (["0", "false", "off", "tidak", "no", ""].includes(normalized)) return false;
  }
  return fallback;
}

/**
 * Validasi aturan produk yang dipakai bersama oleh form admin dan AI Agent.
 * Pesan error sengaja sama persis dengan perilaku form (lihat docs/PRD.md)
 * supaya pengguna tidak melihat perbedaan perilaku antar jalur penulisan.
 */
export function validateProductPayload(raw: RawProductInput): ValidationResult {
  const name = asString(raw.name);
  const slugInput = asOptionalText(raw.slugInput);
  const sku = asOptionalText(raw.sku);
  const categoryId = asInteger(raw.categoryId);
  const price = asInteger(raw.price);
  const stock = asInteger(raw.stock);
  const description = asOptionalText(raw.description);
  const featured = asBoolean(raw.featured, false);
  const isActive = asBoolean(raw.isActive, true);

  if (!name) return { error: "Nama produk wajib diisi." };
  if (name.length > MAX_VARCHAR) return { error: "Nama produk maksimal 255 karakter." };
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return { error: "Kategori wajib dipilih." };
  }
  if (!Number.isInteger(price) || price < 0) {
    return { error: "Harga harus berupa angka bulat >= 0." };
  }
  if (price > MAX_INT) return { error: "Harga maksimal Rp 2.147.483.647." };
  if (!Number.isInteger(stock) || stock < 0) {
    return { error: "Stok harus berupa angka bulat >= 0." };
  }
  if (stock > MAX_INT) return { error: "Stok maksimal 2.147.483.647." };
  if (sku && sku.length > MAX_VARCHAR) return { error: "SKU maksimal 255 karakter." };
  if (description && Buffer.byteLength(description, "utf8") > MAX_TEXT_BYTES) {
    return { error: "Deskripsi terlalu panjang (maksimal 65.535 byte)." };
  }

  return {
    data: { name, slugInput, sku, categoryId, price, stock, description, featured, isActive },
  };
}

export async function categoryExists(id: number): Promise<boolean> {
  const rows = await query<Category[]>("SELECT id FROM categories WHERE id = ? LIMIT 1", [id]);
  return rows.length > 0;
}

/**
 * Pemeriksaan sebelum tulis: kategori harus ada dan SKU belum dipakai.
 * `ignoreId` dipakai saat update supaya SKU produk sendiri tidak dianggap bentrok.
 */
export async function checkProductConflicts(
  data: ProductPayload,
  ignoreId?: number,
): Promise<string | null> {
  if (!(await categoryExists(data.categoryId))) return "Kategori tidak ditemukan.";
  if (data.sku && (await isSkuTaken(data.sku, ignoreId))) {
    return `SKU "${data.sku}" sudah dipakai produk lain.`;
  }
  return null;
}

export type WriteResult = { ok: true } | { error: string };

/**
 * Cek stok menipis setelah penulisan produk. Email dikirim fire-and-forget
 * oleh lib/notify (dengan throttle) — kegagalan di sini tidak boleh
 * menggagalkan operasi produk yang sudah berhasil.
 */
function afterProductWrite(): void {
  void checkLowStockAndNotify();
}

export async function createProductRecord(
  data: ProductPayload,
  image: string | null = null,
): Promise<WriteResult> {
  const conflict = await checkProductConflicts(data);
  if (conflict) return { error: conflict };

  const slug = await uniqueProductSlug(data.slugInput || data.name);

  await query(
    `INSERT INTO products
       (category_id, name, slug, sku, description, price, stock, image, featured, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.categoryId,
      data.name,
      slug,
      data.sku,
      data.description,
      data.price,
      data.stock,
      image,
      data.featured,
      data.isActive,
    ],
  );

  afterProductWrite();
  return { ok: true };
}

type CurrentProductRow = { image: string | null };

/**
 * Update produk. `image` undefined = gambar tidak diubah; null = gambar dihapus.
 * File gambar lama dihapus dari disk hanya bila tidak dipakai produk lain.
 */
export async function updateProductRecord(
  id: number,
  data: ProductPayload,
  image?: string | null,
): Promise<WriteResult> {
  const existing = await query<CurrentProductRow[]>(
    "SELECT image FROM products WHERE id = ? LIMIT 1",
    [id],
  );
  const current = existing[0];
  if (!current) return { error: "Produk tidak ditemukan." };

  const conflict = await checkProductConflicts(data, id);
  if (conflict) return { error: conflict };

  const nextImage = image === undefined ? current.image : image;
  const slug = await uniqueProductSlug(data.slugInput || data.name, id);

  await query(
    `UPDATE products
        SET category_id = ?, name = ?, slug = ?, sku = ?, description = ?,
            price = ?, stock = ?, image = ?, featured = ?, is_active = ?,
            updated_at = now()
      WHERE id = ?`,
    [
      data.categoryId,
      data.name,
      slug,
      data.sku,
      data.description,
      data.price,
      data.stock,
      nextImage,
      data.featured,
      data.isActive,
      id,
    ],
  );

  if (current.image && current.image !== nextImage) {
    const stillUsed = await query<{ n: number }[]>(
      "SELECT COUNT(*) AS n FROM products WHERE image = ? LIMIT 1",
      [current.image],
    );
    if (!Number(stillUsed[0]?.n ?? 0)) {
      await deleteUploadedImage(current.image);
    }
  }

  afterProductWrite();
  return { ok: true };
}
