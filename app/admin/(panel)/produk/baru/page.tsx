import { query } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import type { Category } from "@/lib/types";
import { createProductAction } from "@/app/actions/produk";
import PageHeader from "@/components/admin/PageHeader";
import ProductForm from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";

export const metadata = { title: "Produk Baru" };

export default async function NewProductPage() {
  await verifySession();

  const categories = await query<Category[]>(
    "SELECT id, name, slug FROM categories ORDER BY name ASC",
  );

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-6">
        <p className="text-sm text-gray-500">
          <a href="/admin/produk" className="hover:text-brand-600">
            Produk
          </a>
          <span className="mx-2">/</span>
          <span className="font-semibold text-navy-900">Baru</span>
        </p>
      </div>

      <PageHeader
        title="Tambah Produk"
        description="Produk baru langsung tampil di toko bila statusnya Aktif."
      />

      {categories.length === 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Belum ada kategori. Buat kategori dulu sebelum menambah produk.
        </div>
      ) : null}

      <ProductForm
        categories={categories}
        formAction={createProductAction}
        submitText="Simpan Produk"
        cancelHref="/admin/produk"
      />
    </div>
  );
}
