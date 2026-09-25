import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { storefrontUrl } from "@/lib/format";
import type { Category, Product } from "@/lib/types";
import { updateProductAction } from "@/app/actions/produk";
import PageHeader from "@/components/admin/PageHeader";
import ProductForm, { type ProductFormValues } from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";

export const metadata = { title: "Edit Produk" };

type Params = Promise<{ id: string }>;

export default async function EditProductPage({ params }: { params: Params }) {
  await verifySession();
  const { id } = await params;

  const productId = Number(id);
  if (!Number.isInteger(productId) || productId <= 0) notFound();

  const rows = await query<Product[]>("SELECT * FROM products WHERE id = ? LIMIT 1", [
    productId,
  ]);
  const product = rows[0];
  if (!product) notFound();

  const categories = await query<Category[]>(
    "SELECT id, name, slug FROM categories ORDER BY name ASC",
  );

  const values: ProductFormValues = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    category_id: product.category_id,
    price: product.price,
    stock: product.stock,
    description: product.description,
    image: product.image,
    featured: Boolean(product.featured),
    is_active: Boolean(product.is_active),
  };

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          <a href="/admin/produk" className="hover:text-brand-600">
            Produk
          </a>
          <span className="mx-2">/</span>
          <span className="font-semibold text-navy-900">Edit</span>
        </p>

        <a
          href={`${storefrontUrl()}/produk/${product.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-brand-600 hover:underline"
        >
          Lihat di toko ↗
        </a>
      </div>

      <PageHeader title={product.name} description={`Slug: ${product.slug}`} />

      <ProductForm
        categories={categories}
        product={values}
        formAction={updateProductAction}
        submitText="Simpan Perubahan"
        cancelHref="/admin/produk"
      />
    </div>
  );
}
