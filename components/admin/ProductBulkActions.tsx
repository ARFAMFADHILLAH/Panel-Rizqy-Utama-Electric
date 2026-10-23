"use client";

import { useMemo, useState } from "react";
import { bulkDeleteProductAction } from "@/app/actions/produk";
import SubmitButton from "@/components/admin/SubmitButton";

type Props = {
  productIds: number[];
};

export default function ProductBulkActions({ productIds }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const selectedCount = selected.size;
  const totalOnPage = productIds.length;
  const allSelected = totalOnPage > 0 && productIds.every((id) => selected.has(id));
  const partiallySelected = !allSelected && productIds.some((id) => selected.has(id));

  const selectedList = useMemo(() => Array.from(selected), [selected]);

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const id of productIds) next.delete(id);
      } else {
        for (const id of productIds) next.add(id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  return (
    <>
      <div className="mb-3 flex items-center gap-3 rounded-md border border-navy-100 bg-navy-50 px-3 py-2">
        <label className="flex items-center gap-2 text-sm text-navy-800">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = partiallySelected;
            }}
            onChange={toggleAll}
            disabled={totalOnPage === 0}
            className="h-4 w-4 rounded border-gray-300"
          />
          <span className="font-medium">Pilih semua di halaman ini</span>
        </label>
        {selectedCount > 0 ? (
          <span className="text-sm text-gray-500">{selectedCount} produk dipilih</span>
        ) : null}
      </div>

      {selectedCount > 0 ? (
        <form
          id="bulk-delete-form"
          action={bulkDeleteProductAction}
          onSubmit={(event) => {
            const message = `Hapus ${selectedCount} produk terpilih? Tindakan ini tidak bisa dibatalkan.`;
            if (!confirm(message)) event.preventDefault();
            else setSelected(new Set());
          }}
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-2.5"
        >
          {selectedList.map((id) => (
            <input key={id} type="hidden" name="ids" value={id} />
          ))}

          <p className="text-sm font-medium text-red-700">
            {selectedCount} produk siap dihapus
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
            >
              Batal
            </button>
            <SubmitButton
              pendingText="Menghapus…"
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Hapus terpilih
            </SubmitButton>
          </div>
        </form>
      ) : null}

    </>
  );
}




