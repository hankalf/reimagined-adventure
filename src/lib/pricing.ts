import "server-only";
import { db } from "./db";
import { audit } from "./audit";
import { dec } from "./utils";
import { notifySelections } from "./webhook";

export type PriceSource = "ORDER" | "CATALOG" | "IMPORT";

/** Write a history row when the unit cost actually changes. Returns true when a row was written. */
export async function recordPriceChange(input: {
  itemId: string;
  oldPrice: unknown;
  newPrice: unknown;
  source: PriceSource;
  campaignId?: string | null;
  note?: string | null;
  admin?: { id: string; name: string } | null;
}): Promise<boolean> {
  const oldP = dec(input.oldPrice);
  const newP = dec(input.newPrice);
  if (newP === null) return false;
  if (oldP !== null && Math.abs(oldP - newP) < 0.005) return false;
  await db.itemPriceHistory.create({
    data: {
      itemId: input.itemId,
      campaignId: input.campaignId ?? null,
      oldPrice: oldP,
      newPrice: newP,
      source: input.source,
      note: input.note ?? null,
      changedById: input.admin?.id ?? null,
      changedByName: input.admin?.name ?? null,
    },
  });
  return true;
}

export type ApplyOrderPriceResult = { changed: boolean; oldPrice: number | null; newPrice: number; selectionsUpdated: number; otherCampaignsUpdated: number };

/**
 * HR found the real price when placing the order. Update the gift's catalog price, drop this campaign's cost
 * override so it uses the new price, re-cost every selection of this gift in this campaign (that is the price
 * actually paid), and re-cost not-yet-ordered picks in other campaigns. Already-ordered picks elsewhere keep
 * the price they were bought at.
 */
export async function applyOrderPrice(input: { campaignId: string; itemId: string; newPrice: number; admin: { id: string; name: string }; note?: string }): Promise<ApplyOrderPriceResult> {
  const newPrice = Math.round(input.newPrice * 100) / 100;
  const [item, ci] = await Promise.all([
    db.item.findUniqueOrThrow({ where: { id: input.itemId } }),
    db.campaignItem.findUnique({ where: { campaignId_itemId: { campaignId: input.campaignId, itemId: input.itemId } } }),
  ]);
  const effectiveOld = dec(ci?.unitCostOverride) ?? dec(item.unitCost);
  if (effectiveOld !== null && Math.abs(effectiveOld - newPrice) < 0.005) {
    return { changed: false, oldPrice: effectiveOld, newPrice, selectionsUpdated: 0, otherCampaignsUpdated: 0 };
  }

  const result = await db.$transaction(async (tx) => {
    await tx.item.update({ where: { id: input.itemId }, data: { unitCost: newPrice } });
    if (ci) await tx.campaignItem.update({ where: { campaignId_itemId: { campaignId: input.campaignId, itemId: input.itemId } }, data: { unitCostOverride: null } });
    const here = await tx.selection.updateMany({ where: { campaignId: input.campaignId, itemId: input.itemId }, data: { costAtSelection: newPrice } });
    const elsewhere = await tx.selection.updateMany({
      where: { itemId: input.itemId, campaignId: { not: input.campaignId }, status: { in: ["SELECTED", "NEEDS_REPICK"] } },
      data: { costAtSelection: newPrice },
    });
    await tx.itemPriceHistory.create({
      data: {
        itemId: input.itemId,
        campaignId: input.campaignId,
        oldPrice: effectiveOld,
        newPrice,
        source: "ORDER",
        note: input.note ?? `Price confirmed by HR when ordering. ${here.count} selection(s) in this campaign re-costed.`,
        changedById: input.admin.id,
        changedByName: input.admin.name,
      },
    });
    return { here: here.count, elsewhere: elsewhere.count };
  });

  await audit({ actorType: "ADMIN", actorId: input.admin.id, action: "item.price_updated_at_order", entityType: "Item", entityId: input.itemId, meta: { campaignId: input.campaignId, oldPrice: effectiveOld, newPrice, ...result } });
  const ids = (await db.selection.findMany({ where: { campaignId: input.campaignId, itemId: input.itemId }, select: { id: true } })).map((r) => r.id);
  await notifySelections("item.price_updated", ids, { item: item.name, oldPrice: effectiveOld, newPrice });
  return { changed: true, oldPrice: effectiveOld, newPrice, selectionsUpdated: result.here, otherCampaignsUpdated: result.elsewhere };
}
