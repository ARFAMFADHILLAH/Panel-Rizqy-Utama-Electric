import "server-only";

import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  decodeSession,
  encodeSession,
  sessionMaxAgeSeconds,
  type SessionPayload,
} from "@/lib/session-token";

type SessionUser = {
  id: number;
  email: string;
  name: string;
};

/**
 * Cookie `Secure` otomatis aktif di produksi. Set ADMIN_COOKIE_SECURE=false
 * hanya untuk pengujian lokal lewat http://localhost, karena browser
 * tidak akan mengirim cookie Secure lewat HTTP.
 */
function cookieSecure(): boolean {
  const explicit = process.env.ADMIN_COOKIE_SECURE;
  if (explicit === "true") return true;
  if (explicit === "false") return false;
  return process.env.NODE_ENV === "production";
}

export async function createSession(user: SessionUser): Promise<void> {
  const maxAge = sessionMaxAgeSeconds();
  const payload: SessionPayload = {
    uid: user.id,
    email: user.email,
    name: user.name,
    isAdmin: 1,
    exp: Math.floor(Date.now() / 1000) + maxAge,
  };

  const store = await cookies();
  store.set(SESSION_COOKIE, encodeSession(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function readSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
}
