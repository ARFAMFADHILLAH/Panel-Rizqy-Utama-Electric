/**
 * Tipe proposal aksi tulis dari AI Agent. Sengaja ditaruh di file tanpa
 * import "server-only" karena dipakai oleh komponen chat (client) maupun
 * Server Action konfirmasi.
 *
 * Proposal TIDAK pernah menulis database. Ia hanya data JSON yang sudah
 * divalidasi oleh tool, ditampilkan sebagai kartu di chat, lalu dieksekusi
 * oleh confirmAiAction setelah admin menekan "Konfirmasi" — di mana seluruh
 * field divalidasi ulang dari nol.
 */

export type ProductProposalInput = {
  name: string;
  slugInput?: string | null;
  sku?: string | null;
  categoryId: number;
  price: number;
  stock: number;
  description?: string | null;
  featured?: boolean;
  isActive?: boolean;
};

export type CreateProductProposal = {
  kind: "create_product";
  input: ProductProposalInput;
  sheetName?: string;
};

export type UpdateProductProposal = {
  kind: "update_product";
  productId: number;
  input: ProductProposalInput;
};

export type ImportProposalRow = {
  name: string;
  price: number;
  stock: number;
  sku: string | null;
  description: string | null;
  sheetRow: number;
};

export type ImportProductsProposal = {
  kind: "import_products";
  sheetName: string;
  categoryId: number;
  rows: ImportProposalRow[];
  skipped: { sheetRow: number; reason: string }[];
};

export type AiProposal = CreateProductProposal | UpdateProductProposal | ImportProductsProposal;

export const AI_PROPOSAL_KINDS = ["create_product", "update_product", "import_products"] as const;
