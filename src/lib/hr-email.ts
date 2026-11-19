import "server-only";
import { db } from "./db";
import { audit } from "./audit";
import { sendEmail } from "./email";
import { buildOrdersWorkbook } from "./excel";
import { buildReportData, detailCsv, renderHrEmail, summaryCsv } from "./report";
import { appUrl } from "./utils";

/**
 * Build and send the HR order list (HTML + Excel + CSV attachments) for a campaign.
 * `mode: "new"` includes only selections made since the last email.
 */
export async function sendHrOrderEmail(input: { campaignId: string; to?: string[]; mode: "full" | "new"; actorId?: string | null; actorType?: "ADMIN" | "SYSTEM" }) {
  const campaign = await db.campaign.findUniqueOrThrow({ where: { id: input.campaignId } });
  const since = input.mode === "new" ? campaign.lastHrEmailAt : null;
  const data = await buildReportData(campaign.id, { since });
  const onlyNew = input.mode === "new";
  const { subject, html } = renderHrEmail(data, { appUrl: appUrl(), onlyNew });
  const workbook = await buildOrdersWorkbook(data, { onlyNew });
  const stamp = data.generatedAt.toISOString().slice(0, 10);
  const to = (input.to && input.to.length > 0 ? input.to : campaign.hrEmails).map((e) => e.trim()).filter(Boolean);

  const log = await sendEmail({
    to,
    subject,
    html,
    campaignId: campaign.id,
    attachments: [
      { filename: `${campaign.slug}-orders-${stamp}.xlsx`, content: workbook, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      { filename: `${campaign.slug}-orders-summary-${stamp}.csv`, content: summaryCsv(data, onlyNew), contentType: "text/csv" },
      { filename: `${campaign.slug}-orders-detail-${stamp}.csv`, content: detailCsv(data, onlyNew), contentType: "text/csv" },
    ],
  });

  if (log.status !== "FAILED") {
    await db.campaign.update({ where: { id: campaign.id }, data: { lastHrEmailAt: data.generatedAt } });
  }
  await audit({ actorType: input.actorType ?? "ADMIN", actorId: input.actorId ?? null, action: "hr_email.sent", entityType: "Campaign", entityId: campaign.id, meta: { mode: input.mode, to, status: log.status, rows: data.counts.newSinceLast } });
  return { log, data };
}
