"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import AiProposalCard from "@/components/admin/ai/AiProposalCard";
import type { AiProposal } from "@/lib/ai/proposal";

type ToolPart = {
  type: string;
  state?: string;
  text?: string;
  input?: unknown;
  output?: unknown;
  toolCallId?: string;
  errorText?: string;
};

const PROPOSE_TOOLS = new Set([
  "proposeCreateProduct",
  "proposeUpdateProduct",
  "proposeImportSheet",
]);

const TOOL_LABELS: Record<string, string> = {
  listSheets: "Melihat daftar spreadsheet",
  readSheet: "Membaca Google Sheet",
  listProducts: "Mencari produk di panel",
  getProduct: "Membuka detail produk",
  listCategories: "Melihat kategori",
  getDashboardStats: "Menyusun statistik katalog",
  proposeCreateProduct: "Menyiapkan proposal tambah produk",
  proposeUpdateProduct: "Menyiapkan proposal ubah produk",
  proposeImportSheet: "Menyiapkan proposal impor sheet",
};

function toolNameOf(part: ToolPart): string {
  if (part.type === "dynamic-tool") {
    const name = (part as ToolPart & { toolName?: string }).toolName;
    return name ?? "tool";
  }
  return part.type.startsWith("tool-") ? part.type.slice(5) : part.type;
}

function isProposal(output: unknown): output is { ok: true; proposal: AiProposal } {
  if (typeof output !== "object" || output === null) return false;
  const record = output as Record<string, unknown>;
  return record.ok === true && typeof record.proposal === "object" && record.proposal !== null;
}

const QUICK_PROMPTS = [
  "Tampilkan ringkasan katalog dan stok yang menipis.",
  "Baca sheet Alat Ukur, lalu ringkas isinya.",
  "Siapkan impor produk dari sheet AC ke kategori yang sesuai.",
  "Produk apa saja yang stoknya habis?",
];

export default function AiChat({ userName }: { userName: string }) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/ai/chat" }),
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const submit = (text: string) => {
    const value = text.trim();
    if (!value || busy) return;
    void sendMessage({ text: value });
    setInput("");
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-md border border-gray-200 bg-white">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="mx-auto max-w-xl py-8 text-center">
            <p className="text-base font-bold text-navy-900">
              Halo {userName}, mau ngapain hari ini?
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Aku bisa baca Google Sheet, cek stok panel, bikin laporan, dan menyiapkan
              produk baru — perubahan baru tersimpan setelah kamu tekan Konfirmasi.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => submit(prompt)}
                  className="rounded-full border border-navy-200 bg-white px-3 py-1.5 text-xs font-medium text-navy-700 transition hover:bg-navy-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((message: UIMessage) => {
          const isUser = message.role === "user";
          const parts = (message.parts ?? []) as ToolPart[];
          return (
            <div
              key={message.id}
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[85%] ${isUser ? "" : "w-full"}`}>
                {parts.map((part, index) => {
                  if (part.type === "text") {
                    if (!part.text) return null;
                    return (
                      <div
                        key={index}
                        className={`whitespace-pre-wrap rounded-md px-3 py-2 text-sm ${
                          isUser
                            ? "bg-brand-500 text-white"
                            : "bg-navy-50 text-navy-900"
                        }`}
                      >
                        {part.text}
                      </div>
                    );
                  }

                  const name = toolNameOf(part);
                  if (PROPOSE_TOOLS.has(name)) {
                    if (part.state === "output-available" && isProposal(part.output)) {
                      return <AiProposalCard key={index} proposal={part.output.proposal} />;
                    }
                    if (part.state === "output-available" && part.output) {
                      const record = part.output as { error?: string };
                      return (
                        <p
                          key={index}
                          className="my-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-700"
                        >
                          {record.error || "Proposal tidak bisa disiapkan."}
                        </p>
                      );
                    }
                    return (
                      <ToolStatus key={index} label={TOOL_LABELS[name] ?? "Memproses"} />
                    );
                  }

                  if (part.state === "output-error") {
                    return (
                      <p
                        key={index}
                        className="my-1 rounded bg-red-50 px-2 py-1 text-xs text-red-600"
                      >
                        {TOOL_LABELS[name] ?? name}: {part.errorText ?? "gagal"}
                      </p>
                    );
                  }

                  return <ToolStatus key={index} label={TOOL_LABELS[name] ?? name} />;
                })}
              </div>
            </div>
          );
        })}

        {busy ? (
          <p className="text-xs text-gray-400">Asisten sedang bekerja…</p>
        ) : null}

        {error ? (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">
            {error.message || "Terjadi kesalahan. Coba lagi."}
          </p>
        ) : null}

        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(input);
        }}
        className="border-t border-gray-200 p-3"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit(input);
              }
            }}
            rows={2}
            placeholder="Tulis perintah… (Enter untuk kirim, Shift+Enter baris baru)"
            className="min-h-[44px] flex-1 resize-none rounded-md border border-gray-300 px-3 py-2 text-sm text-navy-900 focus:border-brand-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || input.trim() === ""}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Kirim
          </button>
        </div>
      </form>
    </div>
  );
}

function ToolStatus({ label }: { label: string }) {
  return (
    <p className="my-1 flex items-center gap-2 text-xs text-gray-400">
      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400" />
      {label}
    </p>
  );
}