import "server-only";
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { db } from "./db";
import type { EmailLog } from "@/generated/prisma/client";

export type Attachment = { filename: string; content: Buffer | string; contentType?: string };

export type SendEmailInput = {
  to: string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Attachment[];
  campaignId?: string | null;
};

export function emailMode(): "smtp" | "console" {
  return process.env.EMAIL_TRANSPORT?.toLowerCase() === "smtp" ? "smtp" : "console";
}

export function emailConfigSummary(): { mode: "smtp" | "console"; from: string; host?: string; port?: string; user?: string } {
  return {
    mode: emailMode(),
    from: process.env.EMAIL_FROM ?? "Gift Portal <no-reply@example.com>",
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER ? `${process.env.SMTP_USER.slice(0, 3)}…` : undefined,
  };
}

let cached: Transporter | null = null;
function transporter(): Transporter {
  if (cached) return cached;
  const port = Number(process.env.SMTP_PORT ?? 587);
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" } : undefined,
  });
  return cached;
}

/** Send (or, in console mode, record) an email and always write an EmailLog row. Never throws. */
export async function sendEmail(input: SendEmailInput): Promise<EmailLog> {
  const to = input.to.map((e) => e.trim()).filter(Boolean);
  const attachmentNames = (input.attachments ?? []).map((a) => a.filename);
  const from = process.env.EMAIL_FROM ?? "Gift Portal <no-reply@example.com>";

  if (to.length === 0) {
    return db.emailLog.create({
      data: { campaignId: input.campaignId ?? null, to, subject: input.subject, status: "FAILED", error: "No recipients", body: input.html, attachments: attachmentNames },
    });
  }

  if (emailMode() === "console") {
    console.log(`[email:console] To: ${to.join(", ")} | Subject: ${input.subject} | Attachments: ${attachmentNames.join(", ") || "none"}`);
    return db.emailLog.create({
      data: { campaignId: input.campaignId ?? null, to, subject: input.subject, status: "LOGGED", body: input.html, attachments: attachmentNames },
    });
  }

  try {
    await transporter().sendMail({
      from,
      to: to.join(", "),
      subject: input.subject,
      html: input.html,
      text: input.text,
      attachments: input.attachments?.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
    });
    return db.emailLog.create({
      data: { campaignId: input.campaignId ?? null, to, subject: input.subject, status: "SENT", body: input.html, attachments: attachmentNames },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] send failed:", message);
    return db.emailLog.create({
      data: { campaignId: input.campaignId ?? null, to, subject: input.subject, status: "FAILED", error: message, body: input.html, attachments: attachmentNames },
    });
  }
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function emailShell(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f3f4f6;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#111827">
<div style="max-width:760px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;border:1px solid #e5e7eb">
<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1>
${bodyHtml}
<p style="margin-top:28px;font-size:12px;color:#6b7280">Sent by the employee gift portal.</p>
</div></body></html>`;
}
