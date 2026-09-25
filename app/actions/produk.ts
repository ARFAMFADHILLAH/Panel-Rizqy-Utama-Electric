"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import { toInt, toText } from "@/lib/format";
import { isSkuTaken, uniqueProductSlug } from "@/lib/slug";
import { deleteUploadedImage, normalizeImageUrl, saveProductImage } from "@/lib/upload";
import type { ActionState, Category } from "@/lib/types";

type ProductRow = {
  name: string;
  category_id: number;
  price: number;
  stock: number;
  description: string | null;
  image: string | null;
  featured: number;
  is_active: number;
};

/** Batas kolom `int unsigned` di MySQL. Lewati batas ini akan jadi error 500. */
const MAX_UNSIGNED_INT = 4294967295;

/** Batas kolom varchar(255) dan TEXT (65.535 byte) di MySQL. */
const MAX_VARCHAR = 255;
const MAX_TEXT_BYTES = 65535;

function readProduct(formData: FormData, current?: ProductRow) {
  const name = toText(formData.get("name"));
  const slugInput = toText(formData.get("slug"));
  const sku = toText(formData.get("sku"));
  const categoryId = toInt(formData.get("category_id"));
  const price = toInt(formData.get("price"));
  const stock = toInt(formData.get("stock"));
  const description = toText(formData.get("description"));
  const imageUrlInput = toText(formData.get("image_url"));
  const featured = formData.get("featured") === "on" ? 1 : 0;
  const isActive = formData.get("is_active") === "on" ? 1 : 0;

  if (!name) return { error: "Nama produk wajib diisi." };
  if (name.length > 255) return { error: "Nama produk maksimal 255 karakter." };
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return { error: "Kategori wajib dipilih." };
  }
  if (!Number.isInteger(price) || price < 0) {
    return { error: "Harga harus berupa angka bulat >= 0." };
  }
  if (price > MAX_UNSIGNED_INT) {
    return { error: "Harga maksimal Rp 4.294.967.295." };
  }
  if (!Number.isInteger(stock) || stock < 0) {
    return { error: "Stok harus berupa angka bulat >= 0." };
  }
  if (stock > MAX_UNSIGNED_INT) {
    return { error: "Stok maksimal 4.294.967.295." };
  }
  if (sku.length > MAX_VARCHAR) {
    return { error: "SKU maksimal 255 karakter." };
  }
  if (Buffer.byteLength(description, "utf8") > MAX_TEXT_BYTES) {
    return { error: "Deskripsi terlalu panjang (maksimal 65.535 byte)." };
  }

  return {
    name,
    slugInput,
    sku,
    categoryId,
    price,
    stock,
    description: description || null,
    imageUrlInput,
    featured,
    isActive,
    current,
  };
}

async function categoryExists(id: number): Promise<boolean> {
  const rows = await query<Category[]>("SELECT id FROM categories WHERE id = ? LIMIT 1", [id]);
  return rows.length > 0;
}

async function resolveImage(
  formData: FormData,
  currentImage: string | null,
  current?: ProductRow,
): Promise<{ image: string | null } | { error: string }> {
  if (formData.get("remove_image") === "on") return { image: null };

  const file = formData.get("image_file");
  if (file instanceof File && file.size > 0) {
    const uploaded = await saveProductImage(file);
    if (!uploaded.ok) return { error: uploaded.error };
    return { image: uploaded.url };
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
    return { image: normalized };
  }

  return { image: current ? currentImage : null };
}

export async function createProductAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await assertAdmin();

  const parsed = readProduct(formData);
  if ("error" in parsed) return { error: parsed.error };

  if (!(await categoryExists(parsed.categoryId))) {
    return { error: "Kategori tidak ditemukan." };
  }
  if (parsed.sku && (await isSkuTaken(parsed.sku))) {
    return { error: `SKU "${parsed.sku}" sudah dipakai produk lain.` };
  }

  const image = await resolveImage(formData, null);
  if ("error" in image) return { error: image.error };

  const slug = await uniqueProductSlug(parsed.slugInput || parsed.name);

  await query(
    `INSERT INTO products
       (category_id, name, slug, sku, description, price, stock, image, featured, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      parsed.categoryId,
      parsed.name,
      slug,
      parsed.sku || null,
      parsed.description,
      parsed.price,
      parsed.stock,
      image.image,
      parsed.featured,
      parsed.isActive,
    ],
  );

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
    "SELECT name, category_id, price, stock, description, image, featured, is_active FROM products WHERE id = ? LIMIT 1",
    [id],
  );
  const current = existing[0];
  if (!current) return { error: "Produk tidak ditemukan." };

  const parsed = readProduct(formData, current);
  if ("error" in parsed) return { error: parsed.error };

  if (!(await categoryExists(parsed.categoryId))) {
    return { error: "Kategori tidak ditemukan." };
  }
  if (parsed.sku && (await isSkuTaken(parsed.sku, id))) {
    return { error: `SKU "${parsed.sku}" sudah dipakai produk lain.` };
  }

  const image = await resolveImage(formData, current.image, current);
  if ("error" in image) return { error: image.error };

  const slug = await uniqueProductSlug(parsed.slugInput || parsed.name, id);

  await query(
    `UPDATE products
        SET category_id = ?, name = ?, slug = ?, sku = ?, description = ?,
            price = ?, stock = ?, image = ?, featured = ?, is_active = ?
      WHERE id = ?`,
    [
      parsed.categoryId,
      parsed.name,
      slug,
      parsed.sku || null,
      parsed.description,
      parsed.price,
      parsed.stock,
      image.image,
      parsed.featured,
      parsed.isActive,
      id,
    ],
  );

  revalidatePath("/admin");
  revalidatePath("/admin/produk");
  revalidatePath(`/admin/produk/${id}/edit`);

  // Kalau gambar diganti, file lama tidak boleh menggantung di server.
  if (current.image && current.image !== image.image) {
    const stillUsed = await query<{ n: number }[]>(
      "SELECT COUNT(*) AS n FROM products WHERE image = ? LIMIT 1",
      [current.image],
    );
    if (!Number(stillUsed[0]?.n ?? 0)) {
      await deleteUploadedImage(current.image);
    }
  }

  redirect("/admin/produk");
}

export async function toggleProductAction(formData: FormData): Promise<void> {
  await assertAdmin();

  const id = toInt(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  await query("UPDATE products SET is_active = 1 - is_active WHERE id = ?", [id]);

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
