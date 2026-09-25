import { query } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import type { Category } from "@/lib/types";
import { createCategoryAction, deleteCategoryAction } from "@/app/actions/kategori";
import PageHeader from "@/components/admin/PageHeader";
import ConfirmSubmit from "@/components/admin/ConfirmSubmit";
import CategoryForm from "@/components/admin/CategoryForm";

export const dynamic = "force-dynamic";

export const metadata = { title: "Kategori" };

export default async function CategoryPage() {
  await verifySession();

  const categories = await query<Category[]>(
    `SELECT c.id, c.name, c.slug, COUNT(p.id) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id, c.name, c.slug
      ORDER BY c.name ASC`,
  );

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Kategori"
        description={`${categories.length} kategori. Jumlah produk dihitung dari semua produk, termasuk yang nonaktif.`}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        {categories.length === 0 ? (
          <div className="rounded-md border border-dashed border-gray-300 bg-white py-20 text-center">
            <p className="font-semibold text-navy-900">Belum ada kategori</p>
            <p className="mt-1 text-sm text-gray-500">Tambahkan kategori pertama di samping.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-gray-200 bg-navy-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Nama</th>
                    <th className="px-4 py-3 font-semibold">Slug</th>
                    <th className="px-4 py-3 text-right font-semibold">Produk</th>
                    <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {categories.map((category) => {
                    const count = category.product_count ?? 0;
                    return (
                      <tr key={category.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-navy-900">{category.name}</td>
                        <td className="px-4 py-3 text-gray-500">{category.slug}</td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={
                              count > 0 ? "font-medium text-navy-900" : "text-gray-400"
                            }
                          >
                            {count.toLocaleString("id-ID")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {count > 0 ? (
                            <span
                              title="Kategori yang masih punya produk tidak bisa dihapus"
                              className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-400"
                            >
                              Terpakai
                            </span>
                          ) : (
                            <form action={deleteCategoryAction} className="inline-block">
                              <input type="hidden" name="id" value={category.id} />
                              <ConfirmSubmit
                                message={`Hapus kategori "${category.name}"?`}
                                className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Hapus
                              </ConfirmSubmit>
                            </form>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="rounded-md border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-gray-500">
            Tambah Kategori
          </h2>
          <CategoryForm formAction={createCategoryAction} />

          <p className="mt-4 rounded-md bg-navy-50 px-3 py-2.5 text-xs leading-relaxed text-navy-700">
            Kategori yang masih memiliki produk tidak dapat dihapus — pindahkan atau hapus
            produknya dulu.
          </p>
        </div>
      </div>
    </div>
  );
}
