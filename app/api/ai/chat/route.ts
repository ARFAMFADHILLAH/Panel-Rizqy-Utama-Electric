import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { readSession } from "@/lib/session";
import { query } from "@/lib/db";
import { aiDisabledReason } from "@/lib/ai/access";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { buildTools, sheetNamesForPrompt } from "@/lib/ai/tools";
import { notifyError } from "@/lib/notify";
import type { AdminUser } from "@/lib/types";

/**
 * Endpoint chat AI Agent Inventory.
 *
 * Guard-nya wajib di sini (bukan di proxy.ts) karena:
 *  - proxy hanya melindungi /admin/* dan membalas redirect login — chat API
 *    harus membalas 401/403 JSON agar useChat tidak ter-redirect ke HTML;
 *  - fitur ini terbatas ke AI_ALLOWED_EMAILS (lebih sempit dari "semua admin").
 *
 * Verifikasi session memakai jalur yang sama dengan assertAdmin (cookie
 * diverifikasi HMAC lalu users.is_admin dicek ulang ke database), tapi tanpa
 * redirect.
 */

export const dynamic = "force-dynamic";

const MAX_STEPS = 10;

async function resolveUser(): Promise<
  { user: AdminUser } | { status: 401 | 403; error: string }
> {
  const payload = await readSession();
  if (!payload) return { status: 401, error: "Sesi tidak valid. Silakan login ulang." };

  const users = await query<AdminUser[]>(
    "SELECT id, name, email, is_admin FROM users WHERE id = ? LIMIT 1",
    [payload.uid],
  );
  const user = users[0];
  if (!user) return { status: 401, error: "Sesi tidak valid. Silakan login ulang." };
  if (!user.is_admin) return { status: 403, error: "Bukan admin." };

  const denied = aiDisabledReason(user.email);
  if (denied) return { status: 403, error: denied };

  return { user };
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false; // browser selalu kirim origin utk fetch lintas halaman
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Origin tidak dikenal." }, { status: 403 });
  }

  const auth = await resolveUser();
  if ("status" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body request bukan JSON valid." }, { status: 400 });
  }

  const messages = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "Pesan kosong." }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    const error =
      "GEMINI_API_KEY belum diisi di .env.local. Ambil gratis di https://aistudio.google.com/apikey.";
    void notifyError("gemini", error);
    return Response.json({ error }, { status: 503 });
  }

  try {
    const provider = createGoogleGenerativeAI({ apiKey });
    const model = provider(process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash");

    const modelMessages = await convertToModelMessages(messages as UIMessage[]);

    const result = streamText({
      model,
      system: buildSystemPrompt({
        userName: auth.user.name,
        sheetNames: sheetNamesForPrompt(),
      }),
      messages: modelMessages,
      tools: buildTools(),
      stopWhen: stepCountIs(MAX_STEPS),
      onError: async ({ error }) => {
        await notifyError("gemini", error instanceof Error ? error.message : String(error));
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await notifyError("gemini", detail);
    return Response.json({ error: `Gagal menghubungi AI: ${detail}` }, { status: 502 });
  }
}
