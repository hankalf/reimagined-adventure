import "server-only";
import { db } from "./db";
import { emailMode, emailShell, escapeHtml, sendEmail } from "./email";
import { optionSummary } from "./options";
import { localized } from "@/i18n";

/**
 * "Your gift is ready" notification. Sent only when the campaign has it enabled, the employee has an email
 * address on file, and SMTP is configured. Never throws.
 */
export async function notifyReadyForPickup(selectionIds: string[]): Promise<number> {
  if (selectionIds.length === 0 || emailMode() !== "smtp") return 0;
  const rows = await db.selection.findMany({
    where: { id: { in: selectionIds }, status: "RECEIVED", campaign: { notifyEmployeesOnReceived: true }, employee: { email: { not: null } } },
    include: { employee: true, item: true, campaign: true },
  });
  let sent = 0;
  for (const s of rows) {
    const es = s.language === "es";
    const name = localized(es ? "es" : "en", s.item.name, s.item.nameEs);
    const opts = optionSummary(s);
    const pickup = localized(es ? "es" : "en", s.campaign.pickupInstructions, s.campaign.pickupInstructionsEs);
    const subject = es ? `Tu regalo está listo para recoger: ${name}` : `Your gift is ready for pickup: ${name}`;
    const body = es
      ? `<p>Hola ${escapeHtml(s.employee.firstName)},</p><p>Tu regalo <strong>${escapeHtml(name)}${opts ? ` (${escapeHtml(opts)})` : ""}</strong> ya llegó y está listo para recoger.</p>${pickup ? `<p>${escapeHtml(pickup)}</p>` : ""}<p>Muestra tu código de confirmación <strong>${s.confirmationCode}</strong> al recogerlo.</p>`
      : `<p>Hi ${escapeHtml(s.employee.firstName)},</p><p>Your gift <strong>${escapeHtml(name)}${opts ? ` (${escapeHtml(opts)})` : ""}</strong> has arrived and is ready for pickup.</p>${pickup ? `<p>${escapeHtml(pickup)}</p>` : ""}<p>Show your confirmation code <strong>${s.confirmationCode}</strong> when you collect it.</p>`;
    const log = await sendEmail({ to: [s.employee.email as string], subject, html: emailShell(s.campaign.name, body), campaignId: s.campaignId });
    if (log.status === "SENT") sent += 1;
  }
  return sent;
}
