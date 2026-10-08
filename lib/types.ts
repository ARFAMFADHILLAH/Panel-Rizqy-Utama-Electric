export type Category = {
  id: number;
  name: string;
  slug: string;
  product_count?: number;
};

export type Product = {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  sku: string | null;
  description: string | null;
  price: number;
  stock: number;
  image: string | null;
  featured: boolean;
  is_active: boolean;
  category_name?: string;
  category_slug?: string;
  updated_at?: Date | string;
};

export type AdminUser = {
  id: number;
  name: string;
  email: string;
  /** boolean di Postgres, 1/0 di MySQL — baca dengan kebenaran (truthy). */
  is_admin: number | boolean;
};

export type DashboardStats = {
  total_products: number;
  active_products: number;
  total_categories: number;
  out_of_stock: number;
};

export type ActionState = {
  error?: string;
  message?: string;
};
