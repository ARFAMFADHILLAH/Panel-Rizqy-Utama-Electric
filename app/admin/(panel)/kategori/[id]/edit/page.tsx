import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import type { Category } from "@/lib/types";
import { updateCategoryAction } from "@/app/actions/kategori";
import PageHeader from "@/components/admin/PageHeader";
import CategoryForm from "@/components/admin/CategoryForm";

export const dynamic = "force-dynamic";

export const metadata = { title: "Edit Kategori" };

type Params = Promise<{ id: string }>;

export default async function EditCategoryPage({ params }: { params: Params }) {
  await verifySession();
  const { id } = await params;

  const categoryId = Number(id);
  if (!Number.isInteger(categoryId) || categoryId <= 0) notFound();

  const rows = await query<Category[]>(
    "SELECT id, name, slug, is_active FROM categories WHERE id = ? LIMIT 1",
    [categoryId],
  );
  const category = rows[0];
  if (!category) notFound();

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-6">
        <p className="text-sm text-gray-500">
          <a href="/admin/kategori" className="hover:text-brand-600">
            Kategori
          </a>
          <span className="mx-2">/</span>
          <span className="font-semibold text-navy-900">Edit</span>
        </p>
      </div>

      <PageHeader
        title={category.name}
        description={`Slug: ${category.slug} · Status: ${Boolean(category.is_active) ? "Aktif" : "Nonaktif"}`}
      />

      <div className="max-w-xl rounded-md border border-gray-200 bg-white p-5 sm:p-6">
        <CategoryForm
          category={{ id: category.id, name: category.name, slug: category.slug }}
          formAction={updateCategoryAction}
          submitText="Simpan Perubahan"
          cancelHref="/admin/kategori"
        />
      </div>
    </div>
  );
}
