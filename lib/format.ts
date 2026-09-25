export function formatRp(value: number): string {
  return "Rp " + new Intl.NumberFormat("id-ID").format(value);
}

export function storeName(): string {
  return process.env.NEXT_PUBLIC_STORE_NAME ?? "Rizqy Utama Electric";
}

export function storefrontUrl(): string {
  return (process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

export function toInt(value: FormDataEntryValue | null): number {
  const raw = typeof value === "string" ? value.trim() : "";
  if (raw === "") return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : NaN;
}

export function toText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}
