import "server-only";

import { GoogleAuth } from "google-auth-library";
import { notifyError } from "@/lib/notify";

/**
 * Pembaca Google Sheets lewat Service Account (bukan API key publik).
 *
 * Konfigurasi di .env.local:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL  = client_email dari file JSON service account
 *   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = private_key dari file JSON
 *   GOOGLE_SHEETS_CONFIG          = daftar sheet, format JSON:
 *     [{"name":"Alat Ukur","id":"<spreadsheet-id>","range":"A:Z"},
 *      {"name":"AC","id":"<spreadsheet-id-2>","range":"A:Z"}]
 *
 * Tiap entri bisa punya opsi tambahan (opsional):
 *   "columns":     peta header eksplisit { name, price, stock, sku, description }.
 *                  stock boleh null = sheet memang tak punya kolom stok.
 *   "defaultStock": angka stok yang dipakai bila kolom stok tidak ada.
 *   "seriesRows":  true bila baris berisi label seri (mis. "INVERTER F5S")
 *                  muncul di antara baris produk dan harus jadi prefix nama.
 *   "namePrefix":  teks yang ditempel di depan nama produk (mis. merek "HOZAN"),
 *                  jadi nama = "<namePrefix> <kode>".
 *
 * Penting: spreadsheet harus di-Share ke email service account (Viewer).
 * Tanpa share, Sheets API membalas 404 "Unable to parse range" atau 403.
 */

export type SheetColumnMap = {
  name?: string;
  price?: string;
  stock?: string | null;
  sku?: string;
  description?: string;
};

export type SheetConfig = {
  name: string;
  id: string;
  range: string;
  columns?: SheetColumnMap;
  defaultStock?: number;
  seriesRows?: boolean;
  namePrefix?: string;
};

export type SheetData = {
  name: string;
  headers: string[];
  rows: Record<string, string>[];
  rowCount: number;
};

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];
const CACHE_TTL_MS = 60_000;
const MAX_ROWS = 200;

const cache = new Map<string, { at: number; data: SheetData }>();

export class SheetsError extends Error {}

export function sheetConfigs(): SheetConfig[] {
  const raw = process.env.GOOGLE_SHEETS_CONFIG?.trim();
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new SheetsError(
      "GOOGLE_SHEETS_CONFIG bukan JSON yang valid. Contoh: "
        + '[{"name":"Alat Ukur","id":"ABC123","range":"A:Z"}]',
    );
  }

  if (!Array.isArray(parsed)) {
    throw new SheetsError("GOOGLE_SHEETS_CONFIG harus berupa array JSON.");
  }

  const configs: SheetConfig[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const range = typeof record.range === "string" && record.range.trim() ? record.range.trim() : "A:Z";
    if (!name || !id) continue;

    const config: SheetConfig = { name, id, range };

    if (record.columns && typeof record.columns === "object") {
      const raw = record.columns as Record<string, unknown>;
      const pick = (key: string): string | undefined => {
        const value = raw[key];
        return typeof value === "string" && value.trim() ? value.trim() : undefined;
      };
      config.columns = {
        name: pick("name"),
        price: pick("price"),
        // null eksplisit berarti "sheet ini tidak punya kolom stok"
        stock: raw.stock === null ? null : pick("stock"),
        sku: pick("sku"),
        description: pick("description"),
      };
    }

    if (typeof record.defaultStock === "number" && Number.isFinite(record.defaultStock)) {
      config.defaultStock = Math.min(Math.max(0, Math.trunc(record.defaultStock)), 2147483647);
    }
    if (record.seriesRows === true) config.seriesRows = true;
    if (typeof record.namePrefix === "string" && record.namePrefix.trim()) {
      config.namePrefix = record.namePrefix.trim();
    }

    configs.push(config);
  }
  return configs;
}

function requireCredentials(): { email: string; privateKey: string } {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "")
    .trim()
    .replace(/\\n/g, "\n");

  if (!email || !privateKey) {
    throw new SheetsError(
      "Service account belum dikonfigurasi. Isi GOOGLE_SERVICE_ACCOUNT_EMAIL dan "
        + "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY di .env.local (dari file JSON service account).",
    );
  }
  return { email, privateKey };
}

let authClient: { getAccessToken: () => Promise<{ token?: string | null }> } | null = null;

async function getAccessToken(): Promise<string> {
  const { email, privateKey } = requireCredentials();

  if (!authClient) {
    const auth = new GoogleAuth({
      credentials: { client_email: email, private_key: privateKey },
      scopes: SCOPES,
    });
    authClient = (await auth.getClient()) as unknown as {
      getAccessToken: () => Promise<{ token?: string | null }>;
    };
  }

  const token = await authClient.getAccessToken();
  const value = typeof token === "string" ? token : token?.token;
  if (!value) {
    throw new SheetsError("Gagal mendapatkan token akses Google. Cek email & private key service account.");
  }
  return value;
}

export function findConfig(name: string): SheetConfig {
  const configs = sheetConfigs();
  if (configs.length === 0) {
    throw new SheetsError(
      "GOOGLE_SHEETS_CONFIG belum diisi. Tambahkan daftar spreadsheet di .env.local.",
    );
  }
  const wanted = name.trim().toLowerCase();
  const found = configs.find((c) => c.name.toLowerCase() === wanted);
  if (!found) {
    throw new SheetsError(
      `Sheet "${name}" tidak ditemukan. Tersedia: ${configs.map((c) => c.name).join(", ")}.`,
    );
  }
  return found;
}

/**
 * Baca satu sheet: baris pertama jadi header, baris berikutnya jadi object.
 * Hasil di-cache 60 detik supaya percakapan panjang tidak memicu rate limit.
 */
export async function readSheet(name: string, maxRows = MAX_ROWS): Promise<SheetData> {
  const config = findConfig(name);
  const cacheKey = `${config.id}:${config.range}:${maxRows}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

  const token = await getAccessToken();
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(config.id)}` +
    `/values/${encodeURIComponent(config.range)}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20000),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await notifyError("google-sheets", detail);
    throw new SheetsError(`Tidak bisa menghubungi Google Sheets: ${detail}`);
  }

  if (!response.ok) {
    const body = await response.text();
    let detail = body.slice(0, 300);
    try {
      const parsed = JSON.parse(body) as { error?: { message?: string } };
      if (parsed.error?.message) detail = parsed.error.message;
    } catch {
      // pakai potongan body apa adanya
    }

    if (response.status === 404 || /not found|unable to parse range/i.test(detail)) {
      await notifyError("google-sheets", `HTTP ${response.status}: ${detail}`);
      throw new SheetsError(
        `Sheet "${config.name}" tidak bisa dibaca (HTTP ${response.status}). `
          + `Pastikan spreadsheet ID "${config.id}" benar dan sudah di-Share ke `
          + `email service account sebagai Viewer. Detail: ${detail}`,
      );
    }
    if (response.status === 403) {
      await notifyError("google-sheets", `HTTP 403: ${detail}`);
      throw new SheetsError(
        `Akses ditolak Google (403). Share spreadsheet ke `
          + `${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL} sebagai Viewer. Detail: ${detail}`,
      );
    }
    await notifyError("google-sheets", `HTTP ${response.status}: ${detail}`);
    throw new SheetsError(`Google Sheets error HTTP ${response.status}: ${detail}`);
  }

  const payload = (await response.json()) as { values?: unknown[][] };
  const values = Array.isArray(payload.values) ? payload.values : [];

  const headerRow = values[0] ?? [];
  const headers = headerRow.map((cell, index) => {
    const text = cell === null || cell === undefined ? "" : String(cell).trim();
    return text || `kolom_${index + 1}`;
  });

  const rows: Record<string, string>[] = [];
  const limit = Math.min(values.length - 1, maxRows);
  for (let i = 1; i <= limit; i += 1) {
    const cells = values[i] ?? [];
    const row: Record<string, string> = {};
    let hasValue = false;
    headers.forEach((header, column) => {
      const cell = cells[column];
      const text = cell === null || cell === undefined ? "" : String(cell).trim();
      if (text !== "") hasValue = true;
      row[header] = text;
    });
    if (hasValue) rows.push(row);
  }

  const data: SheetData = {
    name: config.name,
    headers,
    rows,
    rowCount: rows.length,
  };

  cache.set(cacheKey, { at: Date.now(), data });
  return data;
}

export async function listSheets(): Promise<{ name: string; configured: boolean }[]> {
  try {
    return sheetConfigs().map((c) => ({ name: c.name, configured: true }));
  } catch {
    return [];
  }
}
