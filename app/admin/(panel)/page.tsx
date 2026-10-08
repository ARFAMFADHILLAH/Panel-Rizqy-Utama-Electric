import Link from "next/link";
import { query } from "@/lib/db";
import { formatDateTime, formatRp, storefrontUrl } from "@/lib/format";
import { verifySession } from "@/lib/auth";
import type { DashboardStats, Product } from "@/lib/types";
import PageHeader from "@/components/admin/PageHeader";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard" };

const CARDS = [
  { key: "total_products", label: "Jumlah Produk", href: "/admin/produk", accent: "text-navy-900" },
  { key: "active_products", label: "Produk Aktif", href: "/admin/produk", accent: "text-green-600" },
  { key: "total_categories", label: "Kategori", href: "/admin/kategori", accent: "text-navy-600" },
  { key: "out_of_stock", label: "Stok Habis", href: "/admin/produk", accent: "text-red-500" },
] as const;

export default async function DashboardPage() {
  const user = await verifySession();

  const [stats] = await query<DashboardStats[]>(
    `SELECT
       (SELECT COUNT(*) FROM products)                      AS total_products,
       (SELECT COUNT(*) FROM products WHERE is_active = TRUE) AS active_products,
       (SELECT COUNT(*) FROM categories)                     AS total_categories,
       (SELECT COUNT(*) FROM products WHERE stock = 0)       AS out_of_stock`,
  );

  const recent = await query<Product[]>(
    `SELECT p.*, c.name AS category_name
       FROM products p
       JOIN categories c ON c.id = p.category_id
      ORDER BY p.updated_at DESC, p.id DESC
      LIMIT 8`,
  );

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title={`Halo, ${user.name}`}
        description="Ringkasan katalog toko hari ini."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/produk/baru"
              className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600"
            >
              + Produk Baru
            </Link>
            <a
              href={storefrontUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-navy-200 bg-white px-4 py-2 text-sm font-semibold text-navy-800 transition hover:bg-navy-50"
            >
              Lihat Toko
            </a>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {CARDS.map((card) => (
          <Link
            key={card.key}
            href={card.href}
            className="rounded-md border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md lg:p-5"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              {card.label}
            </p>
            <p className={`mt-2 text-2xl font-bold lg:text-3xl ${card.accent}`}>
              {(stats?.[card.key] ?? 0).toLocaleString("id-ID")}
            </p>
          </Link>
        ))}
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-navy-900">Produk Terakhir Diubah</h2>
          <Link href="/admin/produk" className="text-sm font-medium text-brand-600 hover:underline">
            Lihat semua
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="rounded-md border border-dashed border-gray-300 bg-white py-16 text-center">
            <p className="font-semibold text-navy-900">Belum ada produk</p>
            <p className="mt-1 text-sm text-gray-500">
              Tambahkan produk pertama untuk mulai berjualan.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-gray-200 bg-navy-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Produk</th>
                    <th className="px-4 py-3 font-semibold">Kategori</th>
                    <th className="px-4 py-3 text-right font-semibold">Harga</th>
                    <th className="px-4 py-3 text-right font-semibold">Stok</th>
                    <th className="px-4 py-3 font-semibold">Diubah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recent.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/produk/${product.id}/edit`}
                          className="font-medium text-navy-900 hover:text-brand-600"
                        >
                          {product.name}
                        </Link>
                        {!product.is_active ? (
                          <span className="ml-2 rounded-sm bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-500">
                            Nonaktif
                          </span>
                        ) : null}
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
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {formatDateTime(product.updated_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
