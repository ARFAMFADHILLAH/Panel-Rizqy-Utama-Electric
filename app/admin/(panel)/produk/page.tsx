import Link from "next/link";
import { query } from "@/lib/db";
import { formatRp } from "@/lib/format";
import { verifySession } from "@/lib/auth";
import type { Category, Product } from "@/lib/types";
import { deleteProductAction, toggleProductAction } from "@/app/actions/produk";
import PageHeader from "@/components/admin/PageHeader";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";

export const dynamic = "force-dynamic";

export const metadata = { title: "Produk" };

type SearchParams = Promise<{ q?: string; kategori?: string }>;

export default async function ProductListPage({ searchParams }: { searchParams: SearchParams }) {
  await verifySession();
  const { q, kategori } = await searchParams;

  const categories = await query<Category[]>(
    "SELECT id, name, slug FROM categories ORDER BY name ASC",
  );

  const where: string[] = ["1 = 1"];
  const params: (string | number)[] = [];

  if (q && q.trim() !== "") {
    where.push("(p.name LIKE ? OR p.sku LIKE ?)");
    params.push(`%${q.trim()}%`, `%${q.trim()}%`);
  }
  if (kategori) {
    where.push("c.slug = ?");
    params.push(kategori);
  }

  const products = await query<Product[]>(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p
       JOIN categories c ON c.id = p.category_id
      WHERE ${where.join(" AND ")}
      ORDER BY p.updated_at DESC, p.id DESC`,
    params,
  );

  const activeCategory = categories.find((c) => c.slug === kategori);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Produk"
        description={`${products.length} produk${activeCategory ? ` di ${activeCategory.name}` : ""}.`}
        action={
          <Link
            href="/admin/produk/baru"
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600"
          >
            + Produk Baru
          </Link>
        }
      />

      <form method="get" className="mb-5 flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <label htmlFor="q" className="mb-1.5 block text-sm font-medium text-navy-800">
            Cari
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q ?? ""}
            placeholder="Nama atau SKU produk…"
            className="w-full rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="min-w-[170px]">
          <label htmlFor="kategori" className="mb-1.5 block text-sm font-medium text-navy-800">
            Kategori
          </label>
          <select
            id="kategori"
            name="kategori"
            defaultValue={kategori ?? ""}
            className="w-full rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Semua kategori</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="rounded-md bg-navy-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-700"
        >
          Terapkan
        </button>

        {q || kategori ? (
          <Link
            href="/admin/produk"
            className="rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
          >
            Reset
          </Link>
        ) : null}
      </form>

      {products.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-white py-20 text-center">
          <p className="font-semibold text-navy-900">Produk tidak ditemukan</p>
          <p className="mt-1 text-sm text-gray-500">
            Ubah filter pencarian, atau tambahkan produk baru.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-navy-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Produk</th>
                  <th className="px-4 py-3 font-semibold">Kategori</th>
                  <th className="px-4 py-3 text-right font-semibold">Harga</th>
                  <th className="px-4 py-3 text-right font-semibold">Stok</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((product) => (
                  <tr key={product.id} className="align-middle hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-50">
                          {product.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={product.image}
                              alt={product.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center text-[10px] text-gray-300">
                              —
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/admin/produk/${product.id}/edit`}
                            className="block truncate font-medium text-navy-900 hover:text-brand-600"
                          >
                            {product.name}
                          </Link>
                          <p className="truncate text-xs text-gray-400">
                            {product.sku || product.slug}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-gray-500">{product.category_name}</td>

                    <td className="px-4 py-3 text-right font-medium text-navy-900">
                      {formatRp(product.price)}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <span
                        className={
                          product.stock > 0 ? "text-green-600" : "font-medium text-red-500"
                        }
                      >
                        {product.stock.toLocaleString("id-ID")}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            product.is_active
                              ? "bg-green-50 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {product.is_active ? "Aktif" : "Nonaktif"}
                        </span>
                        {product.featured ? (
                          <span className="rounded-sm bg-navy-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            Unggulan
                          </span>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <form action={toggleProductAction}>
                          <input type="hidden" name="id" value={product.id} />
                          <button
                            type="submit"
                            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-navy-800 transition hover:bg-navy-50"
                          >
                            {product.is_active ? "Nonaktifkan" : "Aktifkan"}
                          </button>
                        </form>

                        <Link
                          href={`/admin/produk/${product.id}/edit`}
                          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-navy-800 transition hover:bg-navy-50"
                        >
                          Edit
                        </Link>

                        <form action={deleteProductAction}>
                          <input type="hidden" name="id" value={product.id} />
                          <ConfirmSubmit
                            message={`Hapus produk "${product.name}"? Tindakan ini tidak bisa dibatalkan.`}
                          >
                            Hapus
                          </ConfirmSubmit>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
