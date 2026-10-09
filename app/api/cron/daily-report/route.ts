import { buildDailyReport, notifyDailyReport, notifyError } from "@/lib/notify";

/**
 * Kirim laporan harian inventori ke email owner.
 *
 * Dipicu scheduler eksternal (cron / Vercel Cron / systemd timer) dengan header
 * `Authorization: Bearer <CRON_SECRET>`. Tanpa CRON_SECRET yang cocok endpoint
 * membalas 401, jadi tidak bisa dipicu pihak lain.
 */

export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return (request.headers.get("authorization") ?? "") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await buildDailyReport();
    const sent = await notifyDailyReport(body);
    if (!sent.ok) {
      return Response.json({ ok: false, error: sent.error }, { status: 502 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await notifyError("daily-report", detail);
    return Response.json({ ok: false, error: detail }, { status: 500 });
  }
}