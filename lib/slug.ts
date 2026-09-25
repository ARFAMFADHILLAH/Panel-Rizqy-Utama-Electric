import "server-only";

import { query } from "@/lib/db";
import { slugify } from "@/lib/slugify";

const MAX_ATTEMPTS = 200;

async function claimSlug(
  table: "products" | "categories",
  base: string,
  ignoreId?: number,
): Promise<string> {
  let candidate = base;
  let suffix = 2;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const rows =
      ignoreId === undefined
        ? await query<{ id: number }[]>(`SELECT id FROM ${table} WHERE slug = ? LIMIT 1`, [
            candidate,
          ])
        : await query<{ id: number }[]>(
            `SELECT id FROM ${table} WHERE slug = ? AND id <> ? LIMIT 1`,
            [candidate, ignoreId],
          );

    if (rows.length === 0) return candidate;

    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return `${base}-${Date.now()}`;
}

export async function uniqueProductSlug(desired: string, ignoreId?: number): Promise<string> {
  return claimSlug("products", slugify(desired) || "produk", ignoreId);
}

export async function uniqueCategorySlug(desired: string, ignoreId?: number): Promise<string> {
  return claimSlug("categories", slugify(desired) || "kategori", ignoreId);
}

/** True bila SKU sudah dipakai produk lain. SKU kosong dianggap selalu unik. */
export async function isSkuTaken(sku: string, ignoreId?: number): Promise<boolean> {
  const rows =
    ignoreId === undefined
      ? await query<{ id: number }[]>("SELECT id FROM products WHERE sku = ? LIMIT 1", [sku])
      : await query<{ id: number }[]>(
          "SELECT id FROM products WHERE sku = ? AND id <> ? LIMIT 1",
          [sku, ignoreId],
        );

  return rows.length > 0;
}
