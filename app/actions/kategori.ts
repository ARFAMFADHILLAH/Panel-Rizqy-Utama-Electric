"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { toInt, toText } from "@/lib/format";
import { uniqueCategorySlug } from "@/lib/slug";
import type { ActionState } from "@/lib/types";

export async function createCategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertAdmin();

  const name = toText(formData.get("name"));
  if (!name) return { error: "Nama kategori wajib diisi." };
  if (name.length > 255) return { error: "Nama kategori maksimal 255 karakter." };

  const slug = await uniqueCategorySlug(toText(formData.get("slug")) || name);

  await query("INSERT INTO categories (name, slug) VALUES (?, ?)", [name, slug]);

  revalidatePath("/admin");
  revalidatePath("/admin/kategori");
  revalidatePath("/admin/produk");

  return { message: `Kategori "${name}" ditambahkan.` };
}

export async function updateCategoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertAdmin();

  const id = toInt(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { error: "ID kategori tidak valid." };

  const existing = await query<{ id: number }[]>(
    "SELECT id FROM categories WHERE id = ? LIMIT 1",
    [id],
  );
  if (!existing[0]) return { error: "Kategori tidak ditemukan." };

  const name = toText(formData.get("name"));
  if (!name) return { error: "Nama kategori wajib diisi." };
  if (name.length > 255) return { error: "Nama kategori maksimal 255 karakter." };

  const slug = await uniqueCategorySlug(toText(formData.get("slug")) || name, id);

  await query(
    "UPDATE categories SET name = ?, slug = ?, updated_at = now() WHERE id = ?",
    [name, slug, id],
  );

  revalidatePath("/admin");
  revalidatePath("/admin/kategori");
  revalidatePath(`/admin/kategori/${id}/edit`);
  revalidatePath("/admin/produk");

  return { message: `Kategori "${name}" diperbarui.` };
}

export async function toggleCategoryAction(formData: FormData): Promise<void> {
  await assertAdmin();

  const id = toInt(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  await query(
    "UPDATE categories SET is_active = NOT is_active, updated_at = now() WHERE id = ?",
    [id],
  );

  revalidatePath("/admin");
  revalidatePath("/admin/kategori");
  revalidatePath("/admin/produk");
  revalidatePath("/admin/produk/baru");
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  await assertAdmin();

  const id = toInt(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  const used = await query<{ total: number }[]>(
    "SELECT COUNT(*) AS total FROM products WHERE category_id = ?",
    [id],
  );

  if ((used[0]?.total ?? 0) > 0) {
    return;
  }

  await query("DELETE FROM categories WHERE id = ?", [id]);

  revalidatePath("/admin");
  revalidatePath("/admin/kategori");
  revalidatePath("/admin/produk");
}
