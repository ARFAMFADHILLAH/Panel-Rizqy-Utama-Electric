"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { slugify } from "@/lib/slugify";
import type { ActionState, Category } from "@/lib/types";
import SubmitButton from "@/components/admin/SubmitButton";

export type ProductFormValues = {
  id: number;
  name: string;
  slug: string;
  sku: string | null;
  category_id: number;
  price: number;
  stock: number;
  description: string | null;
  image: string | null;
  featured: boolean;
  is_active: boolean;
};

type Props = {
  categories: Category[];
  product?: ProductFormValues;
  formAction: (state: ActionState, formData: FormData) => Promise<ActionState>;
  submitText: string;
  cancelHref: string;
};

const inputClass =
  "w-full rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500";
const labelClass = "mb-1.5 block text-sm font-medium text-navy-800";

export default function ProductForm({
  categories,
  product,
  formAction,
  submitText,
  cancelHref,
}: Props) {
  const [state, action] = useActionState<ActionState, FormData>(formAction, {});
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  const [preview, setPreview] = useState<string | null>(product?.image ?? null);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  return (
    <form action={action} className="space-y-6">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}

      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {state.error}
        </p>
      ) : null}

      <div className="rounded-md border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500">
          Informasi Dasar
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="name" className={labelClass}>
              Nama Produk <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              required
              maxLength={255}
              value={name}
              onChange={(event) => handleNameChange(event.target.value)}
              className={inputClass}
              placeholder="Kabel NYM 3x2,5 mm"
            />
          </div>

          <div>
            <label htmlFor="slug" className={labelClass}>
              Slug
            </label>
            <input
              id="slug"
              name="slug"
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(event.target.value);
              }}
              className={inputClass}
              placeholder="otomatis dari nama"
            />
            <p className="mt-1 text-xs text-gray-400">
              Dibuat otomatis dari nama. Jika slug bentrok, akhiran unik ditambahkan
              otomatis.
            </p>
          </div>

          <div>
            <label htmlFor="sku" className={labelClass}>
              SKU
            </label>
            <input
              id="sku"
              name="sku"
              maxLength={100}
              defaultValue={product?.sku ?? ""}
              className={inputClass}
              placeholder="opsional, harus unik"
            />
          </div>

          <div>
            <label htmlFor="category_id" className={labelClass}>
              Kategori <span className="text-red-500">*</span>
            </label>
            <select
              id="category_id"
              name="category_id"
              required
              defaultValue={product?.category_id ?? ""}
              className={inputClass}
            >
              <option value="" disabled>
                Pilih kategori…
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="description" className={labelClass}>
              Deskripsi
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              defaultValue={product?.description ?? ""}
              className={inputClass}
              placeholder="Spesifikasi, ukuran, merek…"
            />
          </div>
        </div>
      </div>

      <div className="rounded-md border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500">
          Harga &amp; Stok
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="price" className={labelClass}>
              Harga (Rp) <span className="text-red-500">*</span>
            </label>
            <input
              id="price"
              name="price"
              type="number"
              required
              min={0}
              step={1}
              defaultValue={product?.price ?? 0}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="stock" className={labelClass}>
              Stok <span className="text-red-500">*</span>
            </label>
            <input
              id="stock"
              name="stock"
              type="number"
              required
              min={0}
              step={1}
              defaultValue={product?.stock ?? 0}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <div className="rounded-md border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500">Gambar</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="image_file" className={labelClass}>
              Upload Gambar
            </label>
            <input
              id="image_file"
              name="image_file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(event) => {
                const file = event.target.files?.[0];
                setPreview(file ? URL.createObjectURL(file) : (product?.image ?? null));
              }}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-navy-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-navy-700"
            />
            <p className="mt-1 text-xs text-gray-400">JPEG/PNG/WEBP/GIF, maksimal 2 MB.</p>
          </div>

          <div>
            <label htmlFor="image_url" className={labelClass}>
              image_url (alternatif)
            </label>
            <input
              id="image_url"
              name="image_url"
              defaultValue={product?.image ?? ""}
              className={inputClass}
              placeholder="https://… atau /path/gambar.jpg"
            />
            <p className="mt-1 text-xs text-gray-400">
              Dipakai kalau tidak ada file yang diunggah.
            </p>
          </div>
        </div>

        {preview ? (
          <div className="mt-4 flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Pratinjau gambar produk"
              className="h-24 w-24 rounded-md border border-gray-200 object-cover"
            />
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                name="remove_image"
                className="h-4 w-4 rounded border-gray-300"
              />
              Hapus gambar
            </label>
          </div>
        ) : null}
      </div>

      <div className="rounded-md border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500">Status</h2>

        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm text-navy-800">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={product ? product.is_active : true}
              className="h-4 w-4 rounded border-gray-300"
            />
            Aktif (tampil di toko)
          </label>

          <label className="flex items-center gap-2 text-sm text-navy-800">
            <input
              type="checkbox"
              name="featured"
              defaultChecked={product?.featured ?? false}
              className="h-4 w-4 rounded border-gray-300"
            />
            Produk Unggulan
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText="Menyimpan…">{submitText}</SubmitButton>
        <Link
          href={cancelHref}
          className="rounded-md border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
        >
          Batal
        </Link>
      </div>
    </form>
  );
}
