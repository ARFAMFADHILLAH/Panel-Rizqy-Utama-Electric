import "server-only";

import nodemailer from "nodemailer";

export type MailResult = { ok: true } | { ok: false; error: string };

export function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

export function notifyRecipient(): string {
  return (process.env.NOTIFY_TO ?? process.env.SMTP_USER ?? "").trim();
}

function createTransport() {
  const port = Number(process.env.SMTP_PORT ?? 465);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER ?? "",
      // App Password Google ditulis dengan spasi — buang spasi agar valid.
      pass: (process.env.SMTP_PASSWORD ?? "").replace(/\s+/g, ""),
    },
    connectionTimeout: 15000,
  });
}

/**
 * Kirim email teks polos lewat SMTP. Bila SMTP belum dikonfigurasi, hasilnya
 * { ok: false } tanpa error — notifikasi memang bersifat pelengkap dan tidak
 * boleh menggagalkan operasi inti panel.
 */
export async function sendMail(options: {
  to: string;
  subject: string;
  text: string;
}): Promise<MailResult> {
  if (!isSmtpConfigured()) {
    return { ok: false, error: "SMTP belum dikonfigurasi (SMTP_USER/SMTP_PASSWORD kosong)." };
  }
  if (!options.to) {
    return { ok: false, error: "Penerima belum diatur (NOTIFY_TO kosong)." };
  }

  try {
    await createTransport().sendMail({
      from: `"${process.env.NEXT_PUBLIC_STORE_NAME ?? "Panel Admin"}" <${process.env.SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
}
