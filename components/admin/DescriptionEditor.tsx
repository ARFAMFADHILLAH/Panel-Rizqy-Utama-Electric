"use client";

import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";

type Mode = "write" | "preview";

type Props = {
  defaultValue?: string | null;
};

const toolbarButton =
  "h-7 shrink-0 rounded px-1.5 text-xs font-semibold text-navy-800 transition hover:bg-white hover:shadow-sm sm:px-2";

type DescriptionTemplate = {
  label: string;
  body: string;
  focus?: string;
  primary?: boolean;
};

const DESCRIPTION_TEMPLATES: DescriptionTemplate[] = [
  {
    label: "Template Lengkap",
    primary: true,
    focus: "Tulis ringkasan produk di sini.",
    body: `## Info Penting

- Kondisi: Baru
- Berat Satuan: 
- Min. Beli: 1 Buah
- Kategori: 
- Etalase: 

## Deskripsi

Tulis ringkasan produk di sini.

## Keunggulan Utama

- 
- 
- 

## Spesifikasi Teknis

- Merek/Model: 
- Ukuran: 
- Daya: 
- Bahan: 
- Kelengkapan: 

## Isi dalam Kemasan

- 1x `,
  },
  {
    label: "Info Penting",
    body: "## Info Penting\n\n- Kondisi: Baru\n- Berat Satuan: \n- Min. Beli: 1 Buah\n- Kategori: \n- Etalase: ",
  },
  {
    label: "Keunggulan Utama",
    body: "## Keunggulan Utama\n\n- ",
  },
  {
    label: "Spesifikasi Teknis",
    body: "## Spesifikasi Teknis\n\n- Merek/Model: \n- Ukuran: \n- Daya: \n- Bahan: \n- Kelengkapan: ",
  },
  {
    label: "Isi Kemasan",
    body: "## Isi dalam Kemasan\n\n- 1x ",
  },
  {
    label: "Garansi & Catatan",
    body: "## Garansi & Catatan\n\n- Masa garansi: \n- Ketentuan: ",
  },
];

export default function DescriptionEditor({ defaultValue }: Props) {
  const [value, setValue] = useState(defaultValue ?? "");
  const [mode, setMode] = useState<Mode>("write");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function restoreSelection(start: number, end: number) {
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(start, end);
    });
  }

  function applyInline(before: string, after: string, placeholder: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end) || placeholder;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);

    setValue(next);
    restoreSelection(start + before.length, start + before.length + selected.length);
  }

  function applyLinePrefix(prefix: (index: number) => string, pattern: RegExp) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const nextBreak = value.indexOf("\n", end);
    const lineEnd = nextBreak === -1 ? value.length : nextBreak;
    const block = value.slice(lineStart, lineEnd);

    if (start === end && block.trim() === "") {
      const inserted = prefix(0);
      const next = value.slice(0, lineStart) + inserted + value.slice(lineStart);
      setValue(next);
      restoreSelection(lineStart + inserted.length, lineStart + inserted.length);
      return;
    }

    const lines = block.split("\n");
    const contentLines = lines.filter((line) => line.trim() !== "");
    const shouldRemove =
      contentLines.length > 0 && contentLines.every((line) => pattern.test(line));
    const nextBlock = lines
      .map((line, index) => {
        if (line.trim() === "") return line;
        return shouldRemove ? line.replace(pattern, "") : `${prefix(index)}${line}`;
      })
      .join("\n");
    const next = value.slice(0, lineStart) + nextBlock + value.slice(lineEnd);

    setValue(next);
    restoreSelection(lineStart, lineStart + nextBlock.length);
  }

  function insertTemplate(template: DescriptionTemplate) {
    const textarea = textareaRef.current;
    const cursor = textarea?.selectionStart ?? value.length;
    const before = value.slice(0, cursor);
    const after = value.slice(cursor);

    const leading =
      before === "" || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
    const trailing =
      after === "" || after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
    const inserted = `${leading}${template.body}${trailing}`;
    const next = `${before}${inserted}${after}`;

    setValue(next);
    setMode("write");

    if (template.focus) {
      const focusIndex = next.indexOf(template.focus);
      if (focusIndex !== -1) {
        restoreSelection(focusIndex, focusIndex + template.focus.length);
        return;
      }
    }

    const firstField = template.body.indexOf(": ");
    const offset = firstField === -1 ? template.body.length : firstField + 2;
    restoreSelection(cursor + leading.length + offset, cursor + leading.length + offset);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!(event.ctrlKey || event.metaKey)) return;

    if (event.key.toLowerCase() === "b") {
      event.preventDefault();
      applyInline("**", "**", "teks tebal");
    }
    if (event.key.toLowerCase() === "i") {
      event.preventDefault();
      applyInline("*", "*", "teks miring");
    }
  }

  return (
    <div>
      <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-navy-800">
        Deskripsi
      </label>

      <div className="overflow-hidden rounded-md border border-gray-300 bg-white transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500">
        <div className="flex items-center gap-1 border-b border-gray-200 bg-gray-50 p-1.5 sm:p-2">
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            <button
              type="button"
              title="Tebal (Ctrl+B)"
              aria-label="Format tebal"
              onClick={() => applyInline("**", "**", "teks tebal")}
              disabled={mode === "preview"}
              className={`${toolbarButton} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <span className="font-bold">B</span>
            </button>
            <button
              type="button"
              title="Miring (Ctrl+I)"
              aria-label="Format miring"
              onClick={() => applyInline("*", "*", "teks miring")}
              disabled={mode === "preview"}
              className={`${toolbarButton} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <span className="italic">I</span>
            </button>
            <button
              type="button"
              title="Judul bagian"
              aria-label="Format judul bagian"
              onClick={() => applyLinePrefix(() => "## ", /^#{1,6}\s+/)}
              disabled={mode === "preview"}
              className={`${toolbarButton} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              H2
            </button>

            <span className="mx-1 hidden h-5 w-px shrink-0 bg-gray-200 sm:block" aria-hidden />

            <button
              type="button"
              title="Daftar poin"
              aria-label="Sisipkan daftar poin"
              onClick={() => applyLinePrefix(() => "- ", /^[-*]\s+/)}
              disabled={mode === "preview"}
              className={`${toolbarButton} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <span aria-hidden>•</span>
              <span className="hidden sm:inline"> Daftar</span>
            </button>
            <button
              type="button"
              title="Daftar bernomor"
              aria-label="Sisipkan daftar bernomor"
              onClick={() => applyLinePrefix((index) => `${index + 1}. `, /^\d+\.\s+/)}
              disabled={mode === "preview"}
              className={`${toolbarButton} disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <span aria-hidden>1.</span>
              <span className="hidden sm:inline"> Daftar</span>
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-1 rounded bg-gray-200/70 p-0.5">
            <button
              type="button"
              onClick={() => setMode("write")}
              aria-pressed={mode === "write"}
              className={`whitespace-nowrap rounded px-2 py-1 text-[11px] font-semibold transition sm:px-2.5 sm:text-xs ${
                mode === "write"
                  ? "bg-white text-navy-900 shadow-sm"
                  : "text-gray-500 hover:text-navy-800"
              }`}
            >
              Tulis
            </button>
            <button
              type="button"
              onClick={() => setMode("preview")}
              aria-pressed={mode === "preview"}
              className={`whitespace-nowrap rounded px-2 py-1 text-[11px] font-semibold transition sm:px-2.5 sm:text-xs ${
                mode === "preview"
                  ? "bg-white text-navy-900 shadow-sm"
                  : "text-gray-500 hover:text-navy-800"
              }`}
            >
              Pratinjau
            </button>
          </div>
        </div>

        {mode === "write" ? (
          <textarea
            id="description"
            ref={textareaRef}
            name="description"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={10}
            className="min-h-[200px] w-full resize-y border-0 bg-white px-3 py-3 text-sm outline-none sm:min-h-[240px] sm:px-4"
            placeholder="Tulis deskripsi produk. Gunakan toolbar untuk menebalkan, membuat daftar, atau menambah judul bagian."
          />
        ) : (
          <>
            <div className="min-h-[200px] px-3 py-3 text-sm leading-relaxed text-gray-700 sm:min-h-[240px] sm:px-4">
              {value.trim() ? (
                <ReactMarkdown
                  remarkPlugins={[remarkBreaks]}
                  skipHtml
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    strong: ({ children }) => (
                      <strong className="font-semibold text-navy-900">{children}</strong>
                    ),
                    em: ({ children }) => <em className="italic">{children}</em>,
                    h1: ({ children }) => (
                      <h1 className="mb-2 mt-3 text-lg font-bold text-navy-900 first:mt-0">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="mb-2 mt-3 text-base font-bold text-navy-900 first:mt-0">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="mb-1.5 mt-3 text-sm font-bold text-navy-900 first:mt-0">
                        {children}
                      </h3>
                    ),
                    ul: ({ children }) => (
                      <ul className="mb-2 list-disc space-y-1 pl-5">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="mb-2 list-decimal space-y-1 pl-5">{children}</ol>
                    ),
                    li: ({ children }) => <li className="pl-0.5">{children}</li>,
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-brand-600 underline underline-offset-2"
                      >
                        {children}
                      </a>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="mb-2 border-l-2 border-gray-300 pl-3 text-gray-500">
                        {children}
                      </blockquote>
                    ),
                    img: () => null,
                  }}
                >
                  {value}
                </ReactMarkdown>
              ) : (
                <p className="text-gray-400">
                  Belum ada deskripsi. Klik <strong>Tulis</strong> untuk mulai.
                </p>
              )}
            </div>
            <textarea name="description" value={value} readOnly hidden />
          </>
        )}
      </div>

      <p className="mt-1 text-[11px] text-gray-400 sm:text-xs">
        Mendukung teks tebal, miring, judul bagian, dan daftar. Baris baru dipertahankan.
      </p>

      <div className="mt-2 rounded-md border border-dashed border-navy-200 bg-navy-50/70 p-2.5 sm:p-3">
        <p className="text-[11px] leading-relaxed text-navy-700 sm:text-xs">
          <span className="font-semibold">Saran:</span> sebutkan merek/tipe, ukuran/daya,
          bahan, keunggulan, dan isi paket. Gunakan poin-poin agar mudah dibaca.
        </p>
        <div className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
          {DESCRIPTION_TEMPLATES.map((template) => (
            <button
              key={template.label}
              type="button"
              onClick={() => insertTemplate(template)}
              className={
                template.primary
                  ? "w-full rounded-md border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 transition hover:border-brand-300 hover:bg-white sm:w-auto"
                  : "w-full rounded-md border border-navy-200 bg-white px-2 py-1 text-[11px] font-semibold leading-tight text-navy-700 transition hover:border-brand-300 hover:text-brand-700 sm:w-auto sm:px-2.5 sm:text-xs"
              }
            >
              + {template.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
