import "server-only";

import { tool } from "ai";
import { z } from "zod";
import { query } from "@/lib/db";
import { formatRp } from "@/lib/format";
import { isSkuTaken } from "@/lib/slug";
import {
  checkProductConflicts,
  validateProductPayload,
} from "@/lib/product-service";
import { findConfig, listSheets, readSheet, sheetConfigs, SheetsError } from "@/lib/sheets";
import type { AiProposal, ImportProposalRow } from "@/lib/ai/proposal";

/**
 * Tool yang tersedia untuk AI Agent Inventory.
 *
 * Dua kategori:
 *  - baca: langsung dieksekusi, query berparameter (tidak pernah string SQL
 *    dari input model).
 *  - propose*: TIDAK menulis apa pun. Tool ini memvalidasi input, lalu
 *    mengembalikan objek proposal yang dirender sebagai kartu konfirmasi di
 *    chat. Penulisan database hanya terjadi di confirmAiAction setelah admin
 *    menekan tombol — dengan validasi ulang dari nol.
 */

const productSchema = z.object({
  name: z.string().min(1).max(255).describe("Nama produk"),
  categoryId: z.number().int().positive().describe("ID kategori (dari listCategories)"),
  price: z.number().int().min(0).max(2147483647).describe("Harga rupiah, angka bulat"),
  stock: z.number().int().min(0).max(2147483647).describe("Jumlah stok"),
  sku: z.string().max(255).optional().describe("SKU unik, opsional"),
  description: z.string().max(65000).optional().describe("Deskripsi produk, opsional"),
  slug: z.string().max(255).optional().describe("Slug manual, opsional (otomatis bila kosong)"),
  featured: z.boolean().optional().describe("Tandai produk unggulan (default false)"),
  isActive: z
    .boolean()
    .optional()
    .describe("Status tampil di toko (default true / aktif)"),
});

type ProductSchemaInput = z.infer<typeof productSchema>;

function toPayload(input: ProductSchemaInput) {
  return validateProductPayload({
    name: input.name,
    slugInput: input.slug,
    sku: input.sku,
    categoryId: input.categoryId,
    price: input.price,
    stock: input.stock,
    description: input.description,
    featured: input.featured,
    isActive: input.isActive,
  });
}

type ProductListRow = {
  id: number;
  name: string;
  sku: string | null;
  price: number;
  stock: number;
  is_active: boolean | number;
  category_name: string;
  updated_at: Date | string | null;
};

const MAX_IMPORT_ROWS = 100;

export function buildTools() {
  return {
    listSheets: tool({
      description:
        "Daftar Google Sheet yang tersedia di panel ini (mis. Alat Ukur, AC). Panggil dulu sebelum readSheet.",
      inputSchema: z.object({}),
      execute: async () => {
        const sheets = await listSheets();
        if (sheets.length === 0) {
          return {
            ok: false,
            error:
              "Belum ada spreadsheet yang dikonfigurasi. Isi GOOGLE_SHEETS_CONFIG dan "
              + "GOOGLE_SERVICE_ACCOUNT_EMAIL/GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY di .env.local.",
          };
        }
        return { ok: true, sheets };
      },
    }),

    readSheet: tool({
      description:
        "Baca isi satu Google Sheet (baris pertama = header). Return header + baris data. "
        + "Pakai ini untuk melihat data produk terbaru sebelum membuat laporan atau proposal impor.",
      inputSchema: z.object({
        name: z.string().min(1).describe("Nama sheet persis dari listSheets, mis. 'Alat Ukur'"),
        maxRows: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe("Batas baris yang dibaca (default 200, maks 200)"),
      }),
      execute: async ({ name, maxRows }) => {
        try {
          const data = await readSheet(name, maxRows);
          if (data.headers.length === 0) {
            return { ok: false, error: `Sheet "${name}" kosong (tidak ada baris header).` };
          }
          return { ok: true, ...data };
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : String(error) };
        }
      },
    }),

    listProducts: tool({
      description:
        "Cari produk di database panel. Bisa filter nama/SKU (q), kategori, stok menipis, "
        + "dan batas hasil. Untuk laporan stok pakai lowStockOnly: true.",
      inputSchema: z.object({
        q: z.string().max(255).optional().describe("Pencarian nama ATAU SKU"),
        category: z.string().max(255).optional().describe("Slug kategori"),
        lowStockOnly: z
          .boolean()
          .optional()
          .describe("Hanya produk dengan stok <= batas (untuk laporan stok menipis)"),
        limit: z.number().int().min(1).max(100).optional().describe("Batas hasil, default 50"),
      }),
      execute: async ({ q, category, lowStockOnly, limit }) => {
        const threshold = Number(process.env.LOW_STOCK_THRESHOLD ?? "5");
        const max = limit ?? 50;

        const where: string[] = ["1 = 1"];
        const params: (string | number)[] = [];

        if (q && q.trim() !== "") {
          where.push("(p.name LIKE ? OR p.sku LIKE ?)");
          params.push(`%${q.trim()}%`, `%${q.trim()}%`);
        }
        if (category && category.trim() !== "") {
          where.push("c.slug = ?");
          params.push(category.trim());
        }
        if (lowStockOnly) {
          where.push("p.stock <= ?");
          params.push(Number.isInteger(threshold) ? threshold : 5);
        }

        const rows = await query<ProductListRow[]>(
          `SELECT p.id, p.name, p.sku, p.price, p.stock, p.is_active, p.updated_at,
                  c.name AS category_name
             FROM products p
             JOIN categories c ON c.id = p.category_id
            WHERE ${where.join(" AND ")}
            ORDER BY p.stock ASC, p.name ASC
            LIMIT ?`,
          [...params, max],
        );

        return {
          ok: true,
          count: rows.length,
          products: rows.map((row) => ({
            id: row.id,
            name: row.name,
            sku: row.sku,
            category: row.category_name,
            price: formatRp(row.price),
            priceRaw: row.price,
            stock: row.stock,
            active: Boolean(row.is_active),
          })),
        };
      },
    }),

    getProduct: tool({
      description: "Detail satu produk berdasar ID atau SKU (untuk cek/ubah).",
      inputSchema: z.object({
        id: z.number().int().positive().optional().describe("ID produk"),
        sku: z.string().max(255).optional().describe("SKU produk"),
      }),
      execute: async ({ id, sku }) => {
        if (!id && !sku) {
          return { ok: false, error: "Isi id atau sku salah satu." };
        }
        const rows = await query<ProductListRow[]>(
          `SELECT p.id, p.name, p.sku, p.price, p.stock, p.is_active, p.updated_at,
                  c.name AS category_name, c.id AS category_id, p.description
             FROM products p
             JOIN categories c ON c.id = p.category_id
            WHERE ${id ? "p.id = ?" : "p.sku = ?"}
            LIMIT 1`,
          [id ?? sku ?? ""],
        );
        const row = rows[0];
        if (!row) return { ok: false, error: "Produk tidak ditemukan." };
        const extra = row as ProductListRow & { category_id: number; description: string | null };
        return {
          ok: true,
          product: {
            id: extra.id,
            name: extra.name,
            sku: extra.sku,
            categoryId: extra.category_id,
            category: extra.category_name,
            price: formatRp(extra.price),
            priceRaw: extra.price,
            stock: extra.stock,
            description: extra.description,
            active: Boolean(extra.is_active),
          },
        };
      },
    }),

    listCategories: tool({
      description: "Semua kategori beserta id-nya. Dipakai untuk dapat categoryId saat propose*.",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = await query<{ id: number; name: string; slug: string; product_count: number }[]>(
          `SELECT c.id, c.name, c.slug,
                  (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count
             FROM categories c
            ORDER BY c.name ASC`,
        );
        return {
          ok: true,
          categories: rows.map((row) => ({
            id: row.id,
            name: row.name,
            slug: row.slug,
            productCount: row.product_count,
          })),
        };
      },
    }),

    getDashboardStats: tool({
      description: "Statistik katalog: total produk, aktif, kategori, stok habis, stok menipis.",
      inputSchema: z.object({}),
      execute: async () => {
        const threshold = Number(process.env.LOW_STOCK_THRESHOLD ?? "5");
        const safeThreshold = Number.isInteger(threshold) ? threshold : 5;
        const [stats] = await query<{
          total_products: number;
          active_products: number;
          total_categories: number;
          out_of_stock: number;
          low_stock: number;
        }[]>(
          `SELECT
             (SELECT COUNT(*) FROM products)                        AS total_products,
             (SELECT COUNT(*) FROM products WHERE is_active = TRUE) AS active_products,
             (SELECT COUNT(*) FROM categories)                      AS total_categories,
             (SELECT COUNT(*) FROM products WHERE stock = 0)        AS out_of_stock,
             (SELECT COUNT(*) FROM products WHERE stock <= ?)       AS low_stock`,
          [safeThreshold],
        );
        return { ok: true, stats, lowStockThreshold: safeThreshold };
      },
    }),

    proposeCreateProduct: tool({
      description:
        "SIAPKAN proposal tambah produk baru (belum disimpan!). Validasi dijalankan, lalu "
        + "kembalikan kartu proposal untuk dikonfirmasi admin. Tidak menulis database.",
      inputSchema: productSchema,
      execute: async (input: ProductSchemaInput): Promise<
        | { ok: true; proposal: AiProposal; summary: string[]; conflicts: null }
        | { ok: false; error: string }
      > => {
        const validated = toPayload(input);
        if ("error" in validated) return { ok: false, error: validated.error };

        const conflict = await checkProductConflicts(validated.data);
        if (conflict) return { ok: false, error: conflict };

        const proposal: AiProposal = {
          kind: "create_product",
          input: {
            name: validated.data.name,
            slugInput: validated.data.slugInput,
            sku: validated.data.sku,
            categoryId: validated.data.categoryId,
            price: validated.data.price,
            stock: validated.data.stock,
            description: validated.data.description,
            featured: validated.data.featured,
            isActive: validated.data.isActive,
          },
        };

        return {
          ok: true,
          proposal,
          conflicts: null,
          summary: [
            `Produk: ${validated.data.name}`,
            `SKU: ${validated.data.sku || "(tanpa SKU)"}`,
            `Kategori ID: ${validated.data.categoryId}`,
            `Harga: ${formatRp(validated.data.price)}`,
            `Stok: ${validated.data.stock}`,
            `Status: ${validated.data.isActive ? "Aktif" : "Nonaktif"}${
              validated.data.featured ? " + Unggulan" : ""
            }`,
          ],
        };
      },
    }),

    proposeUpdateProduct: tool({
      description:
        "SIAPKAN proposal ubah produk berdasar ID (belum disimpan!). Semua field wajib dikirim "
        + "ulang dengan nilai BARU (ambil nilai sekarang dari getProduct dulu). Tidak menulis database.",
      inputSchema: productSchema.extend({
        productId: z.number().int().positive().describe("ID produk yang mau diubah"),
      }),
      execute: async (input: ProductSchemaInput & { productId: number }): Promise<
        | {
            ok: true;
            proposal: AiProposal;
            summary: string[];
            changes: { field: string; from: string; to: string }[];
          }
        | { ok: false; error: string }
      > => {
        const existing = await query<
          { id: number; name: string; sku: string | null; price: number; stock: number; category_id: number; description: string | null; featured: boolean | number; is_active: boolean | number }[]
        >(
          "SELECT id, name, sku, price, stock, category_id, description, featured, is_active "
            + "FROM products WHERE id = ? LIMIT 1",
          [input.productId],
        );
        const current = existing[0];
        if (!current) return { ok: false, error: `Produk ID ${input.productId} tidak ditemukan.` };

        const validated = toPayload(input);
        if ("error" in validated) return { ok: false, error: validated.error };

        const conflict = await checkProductConflicts(validated.data, input.productId);
        if (conflict) return { ok: false, error: conflict };

        const changes: { field: string; from: string; to: string }[] = [];
        if (validated.data.name !== current.name) {
          changes.push({ field: "Nama", from: current.name, to: validated.data.name });
        }
        if ((validated.data.sku ?? null) !== current.sku) {
          changes.push({ field: "SKU", from: current.sku ?? "(kosong)", to: validated.data.sku ?? "(kosong)" });
        }
        if (validated.data.price !== current.price) {
          changes.push({ field: "Harga", from: formatRp(current.price), to: formatRp(validated.data.price) });
        }
        if (validated.data.stock !== current.stock) {
          changes.push({ field: "Stok", from: String(current.stock), to: String(validated.data.stock) });
        }
        if (validated.data.categoryId !== current.category_id) {
          changes.push({ field: "Kategori ID", from: String(current.category_id), to: String(validated.data.categoryId) });
        }
        if ((validated.data.description ?? null) !== (current.description ?? null)) {
          changes.push({ field: "Deskripsi", from: "(lihat panel)", to: validated.data.description ? "diubah" : "dikosongkan" });
        }
        if (validated.data.featured !== Boolean(current.featured)) {
          changes.push({ field: "Unggulan", from: Boolean(current.featured) ? "ya" : "tidak", to: validated.data.featured ? "ya" : "tidak" });
        }
        if (validated.data.isActive !== Boolean(current.is_active)) {
          changes.push({ field: "Status", from: Boolean(current.is_active) ? "Aktif" : "Nonaktif", to: validated.data.isActive ? "Aktif" : "Nonaktif" });
        }

        if (changes.length === 0) {
          return { ok: false, error: "Tidak ada perubahan — semua nilai sama dengan data saat ini." };
        }

        const proposal: AiProposal = {
          kind: "update_product",
          productId: input.productId,
          input: {
            name: validated.data.name,
            slugInput: validated.data.slugInput,
            sku: validated.data.sku,
            categoryId: validated.data.categoryId,
            price: validated.data.price,
            stock: validated.data.stock,
            description: validated.data.description,
            featured: validated.data.featured,
            isActive: validated.data.isActive,
          },
        };

        return { ok: true, proposal, summary: [`${validated.data.name} (ID ${input.productId})`], changes };
      },
    }),

    proposeImportSheet: tool({
      description:
        "SIAPKAN proposal impor baris Google Sheet jadi produk panel (maks 100 baris, belum "
        + "disimpan!). Pemetaan kolom (nama/harga/stok/sku) diambil dari konfigurasi sheet, "
        + "bisa dioverride lewat nameColumn/priceColumn/stockColumn/skuColumn. Kolom stok "
        + "boleh tidak ada — pakai defaultStock (atau nilai dari konfigurasi). Baris dengan SKU "
        + "duplikat atau nama/harga tidak valid dilewati. Tidak menulis database.",
      inputSchema: z.object({
        sheetName: z.string().min(1).describe("Nama sheet dari listSheets"),
        categoryId: z.number().int().positive().describe("Kategori tujuan untuk semua baris"),
        nameColumn: z
          .string()
          .optional()
          .describe("Nama kolom berisi kode/nama produk. Pakai bila konfigurasi tak cocok."),
        priceColumn: z.string().optional().describe("Nama kolom harga jual."),
        stockColumn: z
          .string()
          .optional()
          .describe("Nama kolom stok. Isi 'none' kalau sheet memang tidak punya kolom stok."),
        skuColumn: z.string().optional().describe("Nama kolom SKU. Default: sama dengan nama."),
        descriptionColumn: z.string().optional().describe("Nama kolom deskripsi. Auto-detect."),
        defaultStock: z
          .number()
          .int()
          .min(0)
          .max(2147483647)
          .optional()
          .describe("Stok bila kolom stok tidak ada (pakai 0 bila kosong)."),
        maxRows: z
          .number()
          .int()
          .min(1)
          .max(MAX_IMPORT_ROWS)
          .optional()
          .describe(`Batas baris diimpor (maks ${MAX_IMPORT_ROWS})`),
      }),
      execute: async (input: {
        sheetName: string;
        categoryId: number;
        nameColumn?: string;
        priceColumn?: string;
        stockColumn?: string;
        skuColumn?: string;
        descriptionColumn?: string;
        defaultStock?: number;
        maxRows?: number;
      }): Promise<
        | {
            ok: true;
            proposal: AiProposal;
            summary: string[];
            skipped: { sheetRow: number; reason: string }[];
            total: number;
          }
        | { ok: false; error: string }
      > => {
        const category = await query<{ id: number; name: string }[]>(
          "SELECT id, name FROM categories WHERE id = ? LIMIT 1",
          [input.categoryId],
        );
        if (!category[0]) {
          const all = await query<{ id: number; name: string }[]>(
            "SELECT id, name FROM categories ORDER BY name ASC",
          );
          return {
            ok: false,
            error:
              `Kategori ID ${input.categoryId} tidak ditemukan. Kategori tersedia: `
              + all.map((c) => `${c.id}=${c.name}`).join(", "),
          };
        }

        let data;
        try {
          data = await readSheet(input.sheetName, MAX_IMPORT_ROWS + 1);
        } catch (error) {
          return { ok: false, error: error instanceof Error ? error.message : String(error) };
        }

        if (data.rows.length === 0) {
          return { ok: false, error: `Sheet "${input.sheetName}" tidak punya baris data.` };
        }

        let config;
        try {
          config = findConfig(input.sheetName);
        } catch (error) {
          if (error instanceof SheetsError) return { ok: false, error: error.message };
          throw error;
        }
        const columnMap = config.columns ?? {};

        const headers = data.headers;
        const resolveColumn = (
          explicit: string | undefined,
          fromConfig: string | null | undefined,
          keywords: string[],
        ): string | null => {
          if (explicit && explicit.trim().toLowerCase() === "none") return null;
          for (const candidate of [explicit, fromConfig]) {
            if (candidate && candidate.trim()) {
              const match = headers.find(
                (h) => h.toLowerCase() === candidate.trim().toLowerCase(),
              );
              if (match) return match;
            }
          }
          for (const keyword of keywords) {
            const match = headers.find((h) => h.toLowerCase().includes(keyword));
            if (match) return match;
          }
          return null;
        };

        const nameCol = resolveColumn(input.nameColumn, columnMap.name, [
          "tipe",
          "nama",
          "name",
          "produk",
          "product",
          "item",
        ]);
        const priceCol = resolveColumn(input.priceColumn, columnMap.price, [
          "harga tetap (offline",
          "harga",
          "price",
          "jual",
        ]);
        const stockCol = resolveColumn(input.stockColumn, columnMap.stock, [
          "stok",
          "stock",
          "qty",
          "jumlah",
          "sisa",
        ]);
        const skuCol = resolveColumn(input.skuColumn, columnMap.sku, ["sku", "kode"]);
        const descCol = resolveColumn(
          input.descriptionColumn,
          columnMap.description,
          ["deskripsi", "description", "desc"],
        );

        if (!nameCol || !priceCol) {
          const missing: string[] = [];
          if (!nameCol) missing.push("nama");
          if (!priceCol) missing.push("harga");
          return {
            ok: false,
            error:
              `Kolom ${missing.join(", ")} tidak ditemukan di header. `
              + `Header yang ada: ${headers.join(" | ")}. `
              + `Kirim ulang dengan nameColumn/priceColumn yang tepat.`,
          };
        }

        const normalize = (value: string): string => value.replace(/\s+/g, " ").trim();
        const fallbackStock = Math.min(
          Math.max(0, Math.trunc(input.defaultStock ?? config.defaultStock ?? 0)),
          2147483647,
        );
        const seriesMode = config.seriesRows === true;

        const parseNumber = (raw: string): number | null => {
          const cleaned = raw.replace(/[^\d-]/g, "");
          if (cleaned === "" || cleaned === "-") return null;
          const value = Number(cleaned);
          return Number.isFinite(value) ? Math.trunc(value) : null;
        };

        const namePrefix = config.namePrefix?.trim() ?? "";
        const composeName = (code: string, series: string | null): string => {
          const cleanCode = normalize(code);
          let base = cleanCode;
          if (series) {
            const lower = cleanCode.toLowerCase();
            if (lower !== series.toLowerCase() && !lower.startsWith(`${series.toLowerCase()} `)) {
              base = `${series} ${cleanCode}`;
            }
          }
          return namePrefix ? `${namePrefix} ${base}` : base;
        };

        const limit = Math.min(input.maxRows ?? MAX_IMPORT_ROWS, MAX_IMPORT_ROWS);
        const rows: ImportProposalRow[] = [];
        const skipped: { sheetRow: number; reason: string }[] = [];
        const seenSku = new Set<string>();
        let currentSeries: string | null = null;
        let seriesLabelCount = 0;

        for (let i = 0; i < data.rows.length; i += 1) {
          const sheetRow = i + 2; // +1 header, +1 mulai dari 1
          const row = data.rows[i];

          const code = normalize(row[nameCol] ?? "");
          const priceRaw = (row[priceCol] ?? "").trim();
          const price = parseNumber(priceRaw);

          if (!code) {
            skipped.push({ sheetRow, reason: "nama kosong" });
            continue;
          }

          if (price === null || price < 0) {
            if (seriesMode) {
              currentSeries = code;
              seriesLabelCount += 1;
              continue;
            }
            skipped.push({ sheetRow, reason: `harga tidak valid ("${priceRaw}")` });
            continue;
          }

          let stock: number;
          if (stockCol) {
            const parsedStock = parseNumber(row[stockCol] ?? "");
            if (parsedStock === null || parsedStock < 0) {
              skipped.push({
                sheetRow,
                reason: `stok tidak valid ("${row[stockCol] ?? ""}")`,
              });
              continue;
            }
            stock = parsedStock;
          } else {
            stock = fallbackStock;
          }

          const sku = skuCol ? (row[skuCol] ?? "").trim() || code : code;
          if (sku) {
            if (seenSku.has(sku)) {
              skipped.push({ sheetRow, reason: `SKU "${sku}" dobel di sheet` });
              continue;
            }
            if (await isSkuTaken(sku)) {
              skipped.push({ sheetRow, reason: `SKU "${sku}" sudah ada di panel` });
              continue;
            }
            seenSku.add(sku);
          }

          if (rows.length >= limit) {
            skipped.push({ sheetRow, reason: `melebihi batas ${limit} baris` });
            continue;
          }

          rows.push({
            name: composeName(code, currentSeries),
            price,
            stock,
            sku,
            description: descCol ? (row[descCol] ?? "").trim() || null : null,
            sheetRow,
          });
        }

        if (rows.length === 0) {
          return {
            ok: false,
            error:
              "Tidak ada baris yang bisa diimpor. Alasan per baris: "
              + skipped.map((s) => `baris ${s.sheetRow}: ${s.reason}`).join("; "),
          };
        }

        const stockNote = stockCol ? `kolom ${stockCol}` : `default ${fallbackStock} (tanpa kolom stok)`;
        const proposal: AiProposal = {
          kind: "import_products",
          sheetName: data.name,
          categoryId: input.categoryId,
          rows,
          skipped,
        };

        return {
          ok: true,
          proposal,
          total: rows.length,
          skipped,
          summary: [
            `Sheet: ${data.name} → kategori ${category[0].name}`,
            `Nama: kolom ${nameCol}`
              + (namePrefix ? ` + prefix "${namePrefix}"` : "")
              + (currentSeries ? ` + seri (${currentSeries} ...)` : ""),
            `Harga: kolom ${priceCol} | Stok: ${stockNote}`,
            `Siap diimpor: ${rows.length} produk`
              + (seriesLabelCount ? ` (melewati ${seriesLabelCount} baris label seri)` : ""),
            `Dilewati: ${skipped.length} baris`,
            `Contoh: ${rows
              .slice(0, 3)
              .map((r) => `${r.name} (${formatRp(r.price)}, stok ${r.stock})`)
              .join("; ")}`,
          ],
        };
      },
    }),
  };
}

/** Konfigurasi sheet untuk ditampilkan di halaman chat. */
export function sheetNamesForPrompt(): string[] {
  try {
    return sheetConfigs().map((c) => c.name);
  } catch {
    return [];
  }
}
