import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "rue_admin_session";

export type SessionPayload = {
  uid: number;
  email: string;
  name: string;
  isAdmin: 1;
  exp: number;
};

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 16) {
    throw new Error(
      "SESSION_SECRET belum diisi (minimal 16 karakter). Salin dari .env.example lalu isi dengan `openssl rand -base64 32`.",
    );
  }
  return value;
}

export function sessionMaxAgeSeconds(): number {
  const hours = Number(process.env.ADMIN_SESSION_HOURS ?? "8");
  return Number.isFinite(hours) && hours > 0 ? Math.floor(hours * 3600) : 8 * 3600;
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function encodeSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

/**
 * Verifikasi tanda tangan HMAC dan masa berlaku. Mengembalikan null bila
 * token tidak valid, kedaluwarsa, atau strukturnya rusak.
 */
export function decodeSession(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const body = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  let expected: string;
  try {
    expected = sign(body);
  } catch {
    return null;
  }

  const given = Buffer.from(signature, "utf8");
  const want = Buffer.from(expected, "utf8");
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload;

    if (typeof payload.uid !== "number" || !Number.isInteger(payload.uid)) return null;
    if (payload.isAdmin !== 1) return null;
    if (typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
