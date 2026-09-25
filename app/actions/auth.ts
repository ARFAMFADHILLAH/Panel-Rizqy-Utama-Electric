"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { toText } from "@/lib/format";
import { createSession, destroySession } from "@/lib/session";
import type { ActionState, AdminUser } from "@/lib/types";

const GENERIC_ERROR = "Email atau password salah.";

/** Hash palsu agar waktu verifikasi seragam untuk email yang tidak terdaftar. */
const DUMMY_HASH = "$2y$12$C6UzMDM.H6dfI/f/IKcEeO1s2p4X9wZ7Kq0bLm3nQrTvYcXaEs5iG";

export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = toText(formData.get("email")).toLowerCase();
  const password = typeof formData.get("password") === "string" ? String(formData.get("password")) : "";

  if (!email || !password) {
    return { error: "Email dan password wajib diisi." };
  }

  const users = await query<(AdminUser & { password: string })[]>(
    "SELECT id, name, email, is_admin, password FROM users WHERE email = ? LIMIT 1",
    [email],
  );

  const user = users[0];
  const hash = user ? user.password : DUMMY_HASH;
  const passwordOk = await bcrypt.compare(password, hash);

  if (!user || !passwordOk || user.is_admin !== 1) {
    return { error: GENERIC_ERROR };
  }

  await createSession({ id: user.id, email: user.email, name: user.name });

  const next = toText(formData.get("next"));
  redirect(next.startsWith("/admin") ? next : "/admin");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/admin/login");
}
