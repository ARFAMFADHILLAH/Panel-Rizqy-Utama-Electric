"use server";

import { revalidatePath } from "next/cache";
import { assertAdmin } from "@/lib/auth";
import { aiDisabledReason } from "@/lib/ai/access";
import type { AiProposal, ImportProductsProposal } from "@/lib/ai/proposal";
import { checkLowStockAndNotify, notifyProductChanged } from "@/lib/notify";
import {
  checkProductConflicts,
  createProductRecord,
  updateProductRecord,
  validateProductPayload,
} from "@/lib/product-service";

/**
 * Eksekusi proposal AI Agent setelah admin menekan "Konfirmasi".
 *
 * Proposal datang dari client (stateless, tanpa penyimpanan server) — jadi
 * SEMUA field divalidasi ulang dari nol memakai jalur yang sama dengan form
 * admin (validateProductPayload + checkProductConflicts). Input yang tidak
 * dikenal langsung ditolak; tidak ada jalan pintas penulisan.
 */

export type ConfirmAiResult =
  | {
      ok: true;
      message: string;
      created?: number;
      updated?: number;
      skipped?: number;
    }
  | { ok: false; error: string };

const MAX_IMPORT_ROWS = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function confirmAiAction(proposal: AiProposal): Promise<ConfirmAiResult> {
  const user = await assertAdmin();

  const denied = aiDisabledReason(user.email);
  if (denied) return { ok: false, error: denied };

  if (!isRecord(proposal)) {
    return { ok: false, error: "Proposal tidak valid." };
  }

  try {
    switch (proposal.kind) {
      case "create_product": {
        const validated = validateProductPayload(proposal.input ?? {});
        if ("error" in validated) return { ok: false, error: validated.error };

        const conflict = await checkProductConflicts(validated.data);
        if (conflict) return { ok: false, error: conflict };

        const created = await createProductRecord(validated.data);
        if ("error" in created) return { ok: false, error: created.error };

        void notifyProductChanged({
          action: "created",
          name: validated.data.name,
          price: validated.data.price,
          stock: validated.data.stock,
          sku: validated.data.sku,
          actor: user.email,
        });

        revalidatePath("/", "layout");
        return {
          ok: true,
          message: `Produk "${validated.data.name}" berhasil ditambahkan.`,
          created: 1,
        };
      }

      case "update_product": {
        const id = Number(proposal.productId);
        if (!Number.isInteger(id) || id <= 0) {
          return { ok: false, error: "ID produk tidak valid." };
        }

        const validated = validateProductPayload(proposal.input ?? {});
        if ("error" in validated) return { ok: false, error: validated.error };

        const conflict = await checkProductConflicts(validated.data, id);
        if (conflict) return { ok: false, error: conflict };

        const updated = await updateProductRecord(id, validated.data);
        if ("error" in updated) return { ok: false, error: updated.error };

        void notifyProductChanged({
          action: "updated",
          name: validated.data.name,
          price: validated.data.price,
          stock: validated.data.stock,
          sku: validated.data.sku,
          actor: user.email,
        });

        revalidatePath("/", "layout");
        return {
          ok: true,
          message: `Produk "${validated.data.name}" berhasil diperbarui.`,
          updated: 1,
        };
      }

      case "import_products": {
        const result = await runImport(proposal, user.email);
        if ("error" in result) return result;

        revalidatePath("/", "layout");
        return result;
      }

      default:
        return { ok: false, error: "Jenis proposal tidak dikenal." };
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (detail.startsWith("Unauthorized")) {
      return { ok: false, error: "Sesi admin tidak valid. Muat ulang halaman." };
    }
    return { ok: false, error: `Gagal menyimpan: ${detail}` };
  }
}

async function runImport(
  proposal: ImportProductsProposal,
  actor: string,
): Promise<ConfirmAiResult> {
  if (typeof proposal.sheetName !== "string" || proposal.sheetName.trim() === "") {
    return { ok: false, error: "Proposal impor tidak punya nama sheet." };
  }
  const categoryId = Number(proposal.categoryId);
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return { ok: false, error: "Kategori tujuan tidak valid." };
  }
  if (!Array.isArray(proposal.rows)) {
    return { ok: false, error: "Proposal impor tidak punya daftar baris." };
  }
  if (proposal.rows.length > MAX_IMPORT_ROWS) {
    return { ok: false, error: `Maksimal ${MAX_IMPORT_ROWS} baris per impor.` };
  }
  if (proposal.rows.length === 0) {
    return { ok: false, error: "Tidak ada baris untuk diimpor." };
  }

  let created = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const row of proposal.rows) {
    const validated = validateProductPayload({
      name: isRecord(row) ? row.name : "",
      sku: isRecord(row) ? row.sku : undefined,
      categoryId,
      price: isRecord(row) ? row.price : NaN,
      stock: isRecord(row) ? row.stock : NaN,
      description: isRecord(row) ? row.description : undefined,
    });

    if ("error" in validated) {
      skipped += 1;
      failures.push(
        `baris sheet ${isRecord(row) ? row.sheetRow : "?"}: ${validated.error}`,
      );
      continue;
    }

    const written = await createProductRecord(validated.data);
    if ("error" in written) {
      skipped += 1;
      failures.push(
        `baris sheet ${isRecord(row) ? row.sheetRow : "?"}: ${written.error}`,
      );
      continue;
    }

    created += 1;
    void notifyProductChanged({
      action: "created",
      name: validated.data.name,
      price: validated.data.price,
      stock: validated.data.stock,
      sku: validated.data.sku,
      actor,
      sheet: proposal.sheetName,
    });
  }

  await checkLowStockAndNotify();

  const parts = [
    `Impor dari sheet "${proposal.sheetName}" selesai: ${created} produk ditambahkan.`,
  ];
  if (skipped > 0) {
    parts.push(`${skipped} baris dilewati. ${failures.slice(0, 5).join("; ")}${
      failures.length > 5 ? "; …" : ""
    }`);
  }

  return { ok: true, message: parts.join(" "), created, skipped };
}
