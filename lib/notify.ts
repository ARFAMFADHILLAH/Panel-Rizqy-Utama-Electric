import "server-only";

import { query } from "@/lib/db";
import { formatDateTime, formatRp, storeName } from "@/lib/format";
import { notifyRecipient, sendMail } from "@/lib/mailer";

/**
 * Notifikasi real-time ke email owner (lihat NOTIFY_TO/SMTP_USER di .env.local).
 * Semua fungsi di sini bersifat "best effort": gagal kirim email tidak boleh
 * merusak operasi panel, jadi setiap fungsi menangkap errornya sendiri.
 */

/** Throttle per jenis notifikasi supaya email tidak membanjiri inbox. */
const THROTTLE_MS: Record<string, number> = {
  "low-stock": 6 * 60 * 60 * 1000,
  error: 30 * 60 * 1000,
};

const lastSent = new Map<string, number>();

function allowedToSend(kind: string): boolean {
  const window = THROTTLE_MS[kind];
  if (!window) return true;
  const now = Date.now();
  const previous = lastSent.get(kind) ?? 0;
  if (now - previous < window) return false;
  lastSent.set(kind, now);
  return true;
}

function lowStockThreshold(): number {
  const raw = Number(process.env.LOW_STOCK_THRESHOLD ?? "5");
  return Number.isInteger(raw) && raw >= 0 ? raw : 5;
}

type ProductSummary = {
  action: string;
  name: string;
  price: number;
  stock: number;
  sku: string | null;
  actor: string;
  sheet?: string;
};

export async function notifyProductChanged(summary: ProductSummary): Promise<void> {
  try {
    const subject = `[${storeName()}] Produk ${summary.action}: ${summary.name}`;
    const lines = [
      `${storeName()} — notifikasi AI Agent.`,
      "",
      `Aksi        : ${summary.action}`,
      `Produk      : ${summary.name}`,
      `SKU         : ${summary.sku || "-"}`,
      `Harga       : ${formatRp(summary.price)}`,
      `Stok        : ${summary.stock}`,
      summary.sheet ? `Asal sheet  : ${summary.sheet}` : null,
      `Dijalankan  : oleh ${summary.actor}`,
      `Waktu       : ${formatDateTime(new Date())}`,
    ].filter(Boolean);

    await sendMail({ to: notifyRecipient(), subject, text: lines.join("\n") });
  } catch {
    // notifikasi tidak boleh menggagalkan operasi inti
  }
}

type LowStockRow = { name: string; stock: number; sku: string | null };

/**
 * Cek produk stok ≤ ambang batas dan kirim email (dengan throttle 6 jam).
 * Dipanggil otomatis setiap kali produk ditulis, baik oleh form maupun AI.
 */
export async function checkLowStockAndNotify(): Promise<void> {
  try {
    const threshold = lowStockThreshold();
    const rows = await query<LowStockRow[]>(
      "SELECT name, stock, sku FROM products WHERE stock <= ? ORDER BY stock ASC, name ASC LIMIT 50",
      [threshold],
    );
    if (rows.length === 0) return;
    if (!allowedToSend("low-stock")) return;

    const subject = `[${storeName()}] ${rows.length} produk stok menipis (≤ ${threshold})`;
    const lines = [
      `${storeName()} — pantauan stok.`,
      "",
      ...rows.map(
        (row) => `- ${row.name}${row.sku ? ` (${row.sku})` : ""}: sisa ${row.stock}`,
      ),
      "",
      `Waktu: ${formatDateTime(new Date())}`,
    ];

    await sendMail({ to: notifyRecipient(), subject, text: lines.join("\n") });
  } catch {
    // abaikan — lihat catatan di atas
  }
}

type DailyRow = { name: string; sku: string | null; stock: number; category_name: string };

/**
 * Susun isi laporan harian: snapshot inventori saat ini (total produk,
 * total unit stok, stok menipis, stok habis). Sengaja tidak memakai
 * perbandingan tanggal SQL supaya hasilnya sama di Postgres dan MySQL.
 */
export async function buildDailyReport(): Promise<string> {
  const threshold = lowStockThreshold();

  const totals = await query<{ total: number; active: number; stock: number }[]>(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) AS active,
            COALESCE(SUM(stock), 0) AS stock
       FROM products`,
  );

  const lowStock = await query<DailyRow[]>(
    `SELECT p.name, p.sku, p.stock, c.name AS category_name
       FROM products p
       JOIN categories c ON c.id = p.category_id
      WHERE p.stock > 0 AND p.stock <= ?
      ORDER BY p.stock ASC, p.name ASC
      LIMIT 50`,
    [threshold],
  );

  const outOfStock = await query<DailyRow[]>(
    `SELECT p.name, p.sku, p.stock, c.name AS category_name
       FROM products p
       JOIN categories c ON c.id = p.category_id
      WHERE p.stock = 0
      ORDER BY p.name ASC
      LIMIT 50`,
  );

  const number = (value: unknown) => Number(value ?? 0).toLocaleString("id-ID");

  const lines: string[] = [
    `Laporan harian ${storeName()} — ${formatDateTime(new Date())}`,
    "",
    "RINGKASAN KATALOG",
    `- Total produk    : ${number(totals[0]?.total)}`,
    `- Produk aktif    : ${number(totals[0]?.active)}`,
    `- Total unit stok : ${number(totals[0]?.stock)}`,
    "",
    `STOK MENIPIS (<= ${threshold}) — ${lowStock.length} produk`,
  ];

  if (lowStock.length === 0) {
    lines.push("- (tidak ada)");
  } else {
    for (const row of lowStock) {
      lines.push(`- ${row.name} [${row.category_name}] stok ${row.stock}`);
    }
  }

  lines.push("", `STOK HABIS — ${outOfStock.length} produk`);
  if (outOfStock.length === 0) {
    lines.push("- (tidak ada)");
  } else {
    for (const row of outOfStock) {
      lines.push(`- ${row.name} [${row.category_name}]${row.sku ? ` (${row.sku})` : ""}`);
    }
  }

  lines.push("", "— dikirim otomatis oleh Asisten Inventori panel admin.");
  return lines.join("\n");
}

export async function notifyDailyReport(body: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const subject = `[${storeName()}] Laporan harian ${formatDateTime(new Date())}`;
    const result = await sendMail({ to: notifyRecipient(), subject, text: body });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Error sistem (API key bermasalah, sheet tidak terbaca, dsb). Throttle 30
 * menit per jenis supaya error berulang tidak membanjiri inbox.
 */
export async function notifyError(kind: string, detail: string): Promise<void> {
  try {
    if (!allowedToSend(`error:${kind}`)) return;
    const subject = `[${storeName()}] Error sistem: ${kind}`;
    const lines = [
      `${storeName()} — terjadi kesalahan sistem.`,
      "",
      `Jenis : ${kind}`,
      `Detail: ${detail}`,
      `Waktu : ${formatDateTime(new Date())}`,
    ];
    await sendMail({ to: notifyRecipient(), subject, text: lines.join("\n") });
  } catch {
    // abaikan
  }
}
