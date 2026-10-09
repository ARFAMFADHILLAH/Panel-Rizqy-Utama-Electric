"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { toInt, toText } from "@/lib/format";
import {
  createProductRecord,
  updateProductRecord,
  validateProductPayload,
} from "@/lib/product-service";
import { deleteUploadedImage, normalizeImageUrl, saveProductImage } from "@/lib/upload";
import type { ActionState } from "@/lib/types";

type ProductRow = {
  image: string | null;
};

function readProduct(formData: FormData) {
  return validateProductPayload({
    name: formData.get("name"),
    slugInput: formData.get("slug"),
    sku: formData.get("sku"),
    categoryId: formData.get("category_id"),
    price: formData.get("price"),
    stock: formData.get("stock"),
    description: formData.get("description"),
    featured: formData.get("featured") === "on",
    isActive: formData.get("is_active") === "on",
  });
}

async function resolveImage(
  formData: FormData,
  currentImage: string | null,
  isUpdate: boolean,
): Promise<{ image: string | null; isNewFile: boolean } | { error: string }> {
  if (formData.get("remove_image") === "on") return { image: null, isNewFile: false };

  const file = formData.get("image_file");
  if (file instanceof File && file.size > 0) {
    const uploaded = await saveProductImage(file);
    if (!uploaded.ok) return { error: uploaded.error };
    return { image: uploaded.url, isNewFile: true };
  }

  const imageUrlInput = toText(formData.get("image_url"));
  if (imageUrlInput) {
    if (imageUrlInput.length > 255) {
      return { error: "URL gambar maksimal 255 karakter." };
    }
    const normalized = normalizeImageUrl(imageUrlInput);
    if (!normalized) {
      return { error: "image_url harus berupa URL http(s) yang lengkap atau path diawali /." };
    }
    return { image: normalized, isNewFile: false };
  }

  return { image: isUpdate ? currentImage : null, isNewFile: false };
}

export async function createProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertAdmin();

  const parsed = readProduct(formData);
  if ("error" in parsed) return { error: parsed.error };

  const image = await resolveImage(formData, null, false);
  if ("error" in image) return { error: image.error };

  const created = await createProductRecord(parsed.data, image.image);
  if ("error" in created) {
    // File baru tidak jadi terpakai — jangan sampai menggantung di disk.
    if (image.isNewFile && image.image) await deleteUploadedImage(image.image);
    return { error: created.error };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/produk");
  redirect("/admin/produk");
}

export async function updateProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertAdmin();

  const id = toInt(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { error: "ID produk tidak valid." };

  const existing = await query<ProductRow[]>(
    "SELECT image FROM products WHERE id = ? LIMIT 1",
    [id],
  );
  const current = existing[0];
  if (!current) return { error: "Produk tidak ditemukan." };

  const parsed = readProduct(formData);
  if ("error" in parsed) return { error: parsed.error };

  const image = await resolveImage(formData, current.image, true);
  if ("error" in image) return { error: image.error };

  const updated = await updateProductRecord(id, parsed.data, image.image);
  if ("error" in updated) {
    if (image.isNewFile && image.image) await deleteUploadedImage(image.image);
    return { error: updated.error };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/produk");
  revalidatePath(`/admin/produk/${id}/edit`);

  redirect("/admin/produk");
}

export async function toggleProductAction(formData: FormData): Promise<void> {
  await assertAdmin();

  const id = toInt(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  await query("UPDATE products SET is_active = NOT is_active, updated_at = now() WHERE id = ?", [
    id,
  ]);

  revalidatePath("/admin");
  revalidatePath("/admin/produk");
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  await assertAdmin();

  const id = toInt(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  const rows = await query<{ image: string | null }[]>(
    "SELECT image FROM products WHERE id = ? LIMIT 1",
    [id],
  );
  const image = rows[0]?.image ?? null;

  await query("DELETE FROM products WHERE id = ?", [id]);

  // Bersihkan file gambar hanya kalau tidak ada produk lain yang memakainya.
  if (image) {
    const stillUsed = await query<{ n: number }[]>(
      "SELECT COUNT(*) AS n FROM products WHERE image = ? LIMIT 1",
      [image],
    );
    if (!Number(stillUsed[0]?.n ?? 0)) {
      await deleteUploadedImage(image);
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/produk");
}
