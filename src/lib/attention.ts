import "server-only";
import { db } from "./db";
import { eligibleEmployees } from "./report";
import { getSetting } from "./settings";
import { WEBHOOK_KEYS } from "./webhook";

export type AttentionItem = { level: "warn" | "info"; text: string; href: string };

/** Things an admin should look at, for the dashboard "Needs attention" panel. */
export async function needsAttention(): Promise<AttentionItem[]> {
  const out: AttentionItem[] = [];
  const now = Date.now();
  const campaigns = await db.campaign.findMany({ where: { status: { not: "CLOSED" } }, orderBy: { createdAt: "desc" } });

  for (const c of campaigns) {
    const base = `/admin/campaigns/${c.id}`;
    const repicks = await db.selection.count({ where: { campaignId: c.id, status: "NEEDS_REPICK" } });
    if (repicks > 0) out.push({ level: "warn", text: `${c.name}: ${repicks} employee(s) still need to re-pick a gift.`, href: `${base}/employees?filter=repick` });
    if (c.status === "OPEN") {
      const openedFor = (now - (c.opensAt ?? c.createdAt).getTime()) / 86_400_000;
      if (openedFor >= 7) {
        const eligible = await eligibleEmployees(c);
        const picked = await db.selection.count({ where: { campaignId: c.id, status: { in: ["SELECTED", "ORDERED", "RECEIVED", "COLLECTED"] } } });
        const notPicked = eligible.length - picked;
        if (notPicked > 0) out.push({ level: "info", text: `${c.name}: ${notPicked} of ${eligible.length} employees haven't picked after ${Math.floor(openedFor)} days. Export the list to send reminders.`, href: `${base}/employees?filter=notpicked` });
      }
      if (c.closesAt) {
        const daysLeft = (c.closesAt.getTime() - now) / 86_400_000;
        if (daysLeft < 0) out.push({ level: "warn", text: `${c.name} passed its close date but is still open.`, href: `${base}/settings` });
        else if (daysLeft <= 3) out.push({ level: "info", text: `${c.name} closes in ${Math.max(1, Math.ceil(daysLeft))} day(s).`, href: `${base}/settings` });
      }
      const toOrder = await db.selection.count({ where: { campaignId: c.id, status: "SELECTED" } });
      if (toOrder >= 10) out.push({ level: "info", text: `${c.name}: ${toOrder} picks are waiting to be ordered.`, href: `${base}/orders` });
    }
  }

  const activeItems = await db.item.findMany({ where: { active: true }, include: { images: { select: { id: true } } } });
  const noPhoto = activeItems.filter((i) => !i.imageId && !i.imageUrl && i.images.length === 0);
  if (noPhoto.length > 0) out.push({ level: "info", text: `${noPhoto.length} active gift(s) have no photo: ${noPhoto.slice(0, 3).map((i) => i.name).join(", ")}${noPhoto.length > 3 ? "…" : ""}`, href: "/admin/items" });
  const noPrice = activeItems.filter((i) => i.type === "PRODUCT" && i.unitCost === null);
  if (noPrice.length > 0) out.push({ level: "info", text: `${noPrice.length} product gift(s) have no price, so budgets are incomplete.`, href: "/admin/items" });

  const lastStatus = await getSetting(WEBHOOK_KEYS.lastStatus);
  if (lastStatus && lastStatus.startsWith("failed")) out.push({ level: "warn", text: `The orders webhook failed on its last delivery (${lastStatus}).`, href: "/admin/settings" });
  if (process.env.NODE_ENV === "production" && !process.env.APP_URL) out.push({ level: "warn", text: "APP_URL is not set: QR codes and links will point to the wrong address.", href: "/admin/settings" });
  return out;
}
