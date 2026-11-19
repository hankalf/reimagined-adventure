import "server-only";
import { db } from "./db";
import { eligibleEmployees } from "./report";

export type LaunchCheck = { key: string; label: string; ok: boolean; blocking: boolean; href: string; detail?: string };
export type LaunchStatus = { checks: LaunchCheck[]; canOpen: boolean; blockers: LaunchCheck[] };

/** Pre-launch checklist for a campaign. Blocking items must pass before the campaign can be opened. */
export async function launchStatus(campaignId: string): Promise<LaunchStatus> {
  const campaign = await db.campaign.findUniqueOrThrow({ where: { id: campaignId } });
  const base = `/admin/campaigns/${campaignId}`;
  const [items, eligible] = await Promise.all([
    db.campaignItem.findMany({ where: { campaignId }, include: { item: { include: { images: { select: { id: true } } } } } }),
    eligibleEmployees(campaign),
  ]);
  const shownActive = items.filter((ci) => ci.item.active);
  const withoutPhoto = shownActive.filter((ci) => !ci.item.imageId && !ci.item.imageUrl && ci.item.images.length === 0);
  const withoutPrice = shownActive.filter((ci) => ci.item.type === "PRODUCT" && ci.item.unitCost === null && ci.unitCostOverride === null);
  const appUrlSet = Boolean(process.env.APP_URL?.trim());

  const checks: LaunchCheck[] = [
    { key: "gifts", label: "At least one gift is shown", ok: shownActive.length > 0, blocking: true, href: `${base}/items`, detail: `${shownActive.length} gift(s)` },
    { key: "employees", label: "At least one eligible employee", ok: eligible.length > 0, blocking: true, href: `${base}/employees`, detail: `${eligible.length} eligible` },
    {
      key: "appUrl",
      label: "Public address configured so the QR code points to the real site",
      ok: appUrlSet || process.env.NODE_ENV !== "production",
      blocking: process.env.NODE_ENV === "production",
      href: "/admin/settings",
      detail: appUrlSet ? process.env.APP_URL : "APP_URL is not set",
    },
    { key: "photos", label: "Every shown gift has a photo", ok: withoutPhoto.length === 0, blocking: false, href: `${base}/items`, detail: withoutPhoto.length ? `${withoutPhoto.length} without a photo: ${withoutPhoto.slice(0, 3).map((c) => c.item.name).join(", ")}` : undefined },
    { key: "prices", label: "Every product gift has a price (for budgets)", ok: withoutPrice.length === 0, blocking: false, href: `${base}/items`, detail: withoutPrice.length ? `${withoutPrice.length} without a price` : undefined },
    { key: "branding", label: "Welcome message or logo set", ok: Boolean(campaign.welcomeMessage || campaign.logoImageId), blocking: false, href: `${base}/branding` },
    { key: "pickup", label: "Pickup instructions written", ok: Boolean(campaign.pickupInstructions), blocking: false, href: `${base}/branding` },
  ];
  const blockers = checks.filter((c) => c.blocking && !c.ok);
  return { checks, canOpen: blockers.length === 0, blockers };
}
