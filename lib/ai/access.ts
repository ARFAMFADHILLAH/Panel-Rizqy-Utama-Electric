import "server-only";

/**
 * Gerbang akses fitur AI Agent. Dipakai oleh layout panel (visibility nav),
 * route handler chat, dan Server Action konfirmasi.
 *
 * Sengaja berbasis env `AI_ALLOWED_EMAILS` (daftar email dipisah koma) dan
 * bukan kolom database: PRD NFR-10 melarang migrasi/tabel baru untuk fitur
 * ini, dan daftar ini sifatnya konfigurasi operasional owner.
 *
 * Bila env kosong / belum diisi, fitur AI dianggap NONAKTIF (fail-closed)
 * supaya model tidak bisa dipakai tanpa izin eksplisit.
 */

function allowedEmails(): Set<string> {
  const raw = process.env.AI_ALLOWED_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry !== ""),
  );
}

export function isAiEnabled(): boolean {
  return allowedEmails().size > 0;
}

export function isAiAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const set = allowedEmails();
  if (set.size === 0) return false;
  return set.has(email.trim().toLowerCase());
}

/** Alasan singkat dalam bahasa Indonesia untuk ditampilkan ke user. */
export function aiDisabledReason(email: string | null | undefined): string | null {
  if (!isAiEnabled()) {
    return "Fitur AI belum diaktifkan. Isi AI_ALLOWED_EMAILS di .env.local dengan email admin yang boleh memakainya.";
  }
  if (!isAiAllowed(email)) {
    return "Email kamu tidak termasuk di AI_ALLOWED_EMAILS. Tambahkan emailmu ke .env.local lalu restart aplikasi.";
  }
  return null;
}
