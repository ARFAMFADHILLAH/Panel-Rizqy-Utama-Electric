import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { readSession } from "@/lib/session";
import type { AdminUser } from "@/lib/types";

/**
 * Pembacaan cookie saja, tanpa query ke database. Dipakai halaman login
 * untuk mengarahkan admin yang sudah punya session valid.
 */
export const peekSession = cache(async () => readSession());

/**
 * Pemeriksaan session yang aman (secure check): cookie diverifikasi secara
 * kriptografik, lalu `users.is_admin` dicek ulang ke database — jadi akun yang
 * kehilangan status admin langsung kehilangan akses.
 *
 * Dipanggil di layout panel, setiap halaman, dan di dalam setiap Server Action
 * (aksi adalah entry point POST terpisah, tidak otomatis terlindungi layout).
 */
export const verifySession = cache(async (): Promise<AdminUser> => {
  const payload = await readSession();
  if (!payload) redirect("/admin/login");

  const users = await query<AdminUser[]>(
    "SELECT id, name, email, is_admin FROM users WHERE id = ? LIMIT 1",
    [payload.uid],
  );

  const user = users[0];
  if (!user || !user.is_admin) redirect("/admin/login");

  return user;
});

/**
 * Guard untuk mutasi. Sama seperti verifySession, tapi melempar error alih-alih
 * redirect supaya aksi gagal dengan keras kalau dipanggil tanpa session.
 */
export async function assertAdmin(): Promise<AdminUser> {
  const payload = await readSession();
  if (!payload) throw new Error("Unauthorized: session tidak valid.");

  const users = await query<AdminUser[]>(
    "SELECT id, name, email, is_admin FROM users WHERE id = ? LIMIT 1",
    [payload.uid],
  );

  const user = users[0];
  if (!user || !user.is_admin) throw new Error("Unauthorized: bukan admin.");

  return user;
}
