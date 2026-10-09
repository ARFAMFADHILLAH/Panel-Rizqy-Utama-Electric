"use client";

import { useState, useTransition } from "react";
import { confirmAiAction } from "@/app/actions/ai";
import type { AiProposal } from "@/lib/ai/proposal";

type Props = {
  proposal: AiProposal;
};

const LABELS: Record<AiProposal["kind"], string> = {
  create_product: "Tambah Produk Baru",
  update_product: "Ubah Produk",
  import_products: "Impor Produk dari Sheet",
};

function Baris({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-medium text-navy-900">{value}</span>
    </div>
  );
}

export default function AiProposalCard({ proposal }: Props) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const confirm = () => {
    setResult(null);
    startTransition(async () => {
      const response = await confirmAiAction(proposal);
      if (response.ok) {
        setResult({ ok: true, text: response.message });
      } else {
        setResult({ ok: false, text: response.error });
      }
    });
  };

  return (
    <div className="my-2 rounded-md border-2 border-brand-300 bg-brand-50/60 p-3 text-sm">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-brand-700">
        {LABELS[proposal.kind]} — perlu konfirmasi
      </p>

      {proposal.kind === "create_product" ? (
        <div className="divide-y divide-brand-100">
          <Baris label="Nama" value={proposal.input.name} />
          <Baris label="SKU" value={proposal.input.sku || "(tanpa SKU)"} />
          <Baris
            label="Harga"
            value={`Rp ${proposal.input.price.toLocaleString("id-ID")}`}
          />
          <Baris label="Stok" value={proposal.input.stock.toLocaleString("id-ID")} />
          <Baris
            label="Status"
            value={`${proposal.input.isActive === false ? "Nonaktif" : "Aktif"}${
              proposal.input.featured ? " + Unggulan" : ""
            }`}
          />
        </div>
      ) : null}

      {proposal.kind === "update_product" ? (
        <div className="divide-y divide-brand-100">
          <Baris label="Produk ID" value={String(proposal.productId)} />
          <Baris label="Nama baru" value={proposal.input.name} />
          <Baris
            label="Harga baru"
            value={`Rp ${proposal.input.price.toLocaleString("id-ID")}`}
          />
          <Baris label="Stok baru" value={proposal.input.stock.toLocaleString("id-ID")} />
        </div>
      ) : null}

      {proposal.kind === "import_products" ? (
        <div>
          <Baris label="Sheet" value={proposal.sheetName} />
          <Baris label="Kategori ID" value={String(proposal.categoryId)} />
          <Baris label="Baris siap impor" value={String(proposal.rows.length)} />
          <Baris label="Baris dilewati" value={String(proposal.skipped.length)} />
          <div className="mt-2 max-h-40 overflow-y-auto rounded border border-brand-100 bg-white p-2 text-xs">
            {proposal.rows.slice(0, 20).map((row) => (
              <p key={row.sheetRow} className="truncate text-gray-600">
                <span className="text-gray-400">#{row.sheetRow}</span> {row.name} — Rp{" "}
                {row.price.toLocaleString("id-ID")} (stok {row.stock})
              </p>
            ))}
            {proposal.rows.length > 20 ? (
              <p className="mt-1 text-gray-400">… dan {proposal.rows.length - 20} lainnya</p>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={confirm}
          disabled={pending || result?.ok}
          className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Menyimpan…" : result?.ok ? "Tersimpan" : "Konfirmasi"}
        </button>
        <a
          href="/admin/produk"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-navy-600 hover:underline"
        >
          Buka halaman Produk
        </a>
      </div>

      {result ? (
        <p
          className={`mt-2 rounded px-2 py-1 text-xs ${
            result.ok
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-700"
          }`}
        >
          {result.text}
        </p>
      ) : null}
    </div>
  );
}