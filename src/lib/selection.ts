import "server-only";
import { db } from "./db";
import type { Prisma } from "./db";
import { audit } from "./audit";
import { effectiveItemCost, employeeBudget, isOverBudget, COMMITTED_STATUSES } from "./budget";
import {
  campaignAcceptsPicks,
  canChangeSelection,
  employeeNumberCandidates,
  generateConfirmationCode,
  itemAvailability,
  lastNameMatches,
} from "./selection-rules";
import { dec } from "./utils";
import { offeredGroups, optionGroups, removedValues, validatePick, type OptionGroup } from "./options";
import { notifySelections } from "./webhook";

export type PickItem = {
  id: string;
  type: "PRODUCT" | "CUSTOM";
  name: string;
  nameEs: string | null;
  description: string;
  descriptionEs: string | null;
  category: string | null;
  imageId: string | null;
  imageUrl: string | null;
  /** Extra photos; option1Value set = shown when that value is picked. */
  gallery: Array<{ imageId: string; option1Value: string | null }>;
  framing: { thumbFit: string; thumbZoom: number; thumbFocusX: number; thumbFocusY: number };
  fulfillmentNote: string | null;
  /** Option groups offered in this campaign (catalog values filtered by the campaign's enabled subset). */
  groups: OptionGroup[];
  available: boolean;
  soldOut: boolean;
  remaining: number | null;
  overBudget: boolean;
  sortOrder: number;
};

export type IdentifyResult =
  | { ok: true; employee: { id: string; firstName: string; lastName: string; employeeNumber: string } }
  | { ok: false; reason: "not_found" | "not_eligible" };

/** Validate employee number (+ last name when required) against the uploaded list and campaign eligibility. */
export async function identifyEmployee(input: {
  campaign: { id: string; requireLastName: boolean; allEmployeesEligible: boolean };
  employeeNumber: string;
  lastName: string;
}): Promise<IdentifyResult> {
  const candidates = employeeNumberCandidates(input.employeeNumber);
  if (candidates.length === 0) return { ok: false, reason: "not_found" };

  const employees = await db.employee.findMany({
    where: { employeeNumber: { in: candidates }, active: true },
    include: { campaigns: { where: { campaignId: input.campaign.id } } },
  });
  // Prefer the exact match when a zero-stripped candidate also matches someone else.
  const exact = employees.find((e) => e.employeeNumber === candidates[0]);
  const employee = exact ?? (employees.length === 1 ? employees[0] : undefined);
  if (!employee) return { ok: false, reason: "not_found" };

  if (input.campaign.requireLastName && !lastNameMatches(input.lastName, employee.lastName)) {
    return { ok: false, reason: "not_found" };
  }
  if (!input.campaign.allEmployeesEligible && employee.campaigns.length === 0) {
    return { ok: false, reason: "not_eligible" };
  }
  return {
    ok: true,
    employee: { id: employee.id, firstName: employee.firstName, lastName: employee.lastName, employeeNumber: employee.employeeNumber },
  };
}

export async function isEligible(campaign: { id: string; allEmployeesEligible: boolean }, employeeId: string): Promise<boolean> {
  const employee = await db.employee.findUnique({ where: { id: employeeId }, include: { campaigns: { where: { campaignId: campaign.id } } } });
  if (!employee || !employee.active) return false;
  return campaign.allEmployeesEligible || employee.campaigns.length > 0;
}

/** Everything the pick page needs: items with availability/budget flags, the employee's budget and current selection. */
export async function getPickContext(campaignId: string, employeeId: string) {
  const [campaign, employee, campaignEmployee, campaignItems, selection, takenRows] = await Promise.all([
    db.campaign.findUniqueOrThrow({ where: { id: campaignId } }),
    db.employee.findUniqueOrThrow({ where: { id: employeeId } }),
    db.campaignEmployee.findUnique({ where: { campaignId_employeeId: { campaignId, employeeId } } }),
    db.campaignItem.findMany({ where: { campaignId }, include: { item: { include: { images: { orderBy: { sortOrder: "asc" } } } } }, orderBy: [{ sortOrder: "asc" }, { item: { name: "asc" } }] }),
    db.selection.findUnique({ where: { campaignId_employeeId: { campaignId, employeeId } }, include: { item: true } }),
    db.selection.groupBy({ by: ["itemId"], where: { campaignId, status: { in: [...COMMITTED_STATUSES] } }, _count: { _all: true } }),
  ]);
  const taken = new Map(takenRows.map((r) => [r.itemId, r._count._all]));
  const budget = employeeBudget(campaign, campaignEmployee);

  const items: PickItem[] = campaignItems.map((ci) => {
    const cost = effectiveItemCost(ci.item, ci);
    const avail = itemAvailability({ status: ci.status, stockLimit: ci.stockLimit, taken: taken.get(ci.itemId) ?? 0, itemActive: ci.item.active });
    return {
      id: ci.item.id,
      type: ci.item.type,
      name: ci.item.name,
      nameEs: ci.item.nameEs,
      description: ci.item.description,
      descriptionEs: ci.item.descriptionEs,
      category: ci.item.category,
      imageId: ci.item.imageId,
      imageUrl: ci.item.imageUrl,
      gallery: ci.item.images.map((g) => ({ imageId: g.imageId, option1Value: g.option1Value })),
      framing: { thumbFit: ci.item.thumbFit, thumbZoom: ci.item.thumbZoom, thumbFocusX: ci.item.thumbFocusX, thumbFocusY: ci.item.thumbFocusY },
      fulfillmentNote: ci.item.fulfillmentNote,
      groups: offeredGroups(ci.item, ci),
      available: avail.available,
      soldOut: avail.soldOut,
      remaining: avail.remaining,
      overBudget: isOverBudget(cost, budget),
      sortOrder: ci.sortOrder,
    };
  });

  const visibleItems = items.filter((i) => {
    if (!i.available && !campaign.showSoldOutItems && !(selection && selection.itemId === i.id)) return false;
    if (i.overBudget && campaign.hideItemsOverBudget) return false;
    return i.available || campaign.showSoldOutItems || (selection && selection.itemId === i.id);
  });

  return { campaign, employee, campaignEmployee, budget, items: visibleItems, selection };
}

export type SubmitError =
  | "not_open"
  | "not_eligible"
  | "already_picked"
  | "cannot_change"
  | "unavailable"
  | "over_budget"
  | "option_required"
  | "invalid_option"
  | "unknown_item";

export type SubmitResult =
  | { ok: true; selectionId: string; confirmationCode: string; changed: boolean }
  | { ok: false; error: SubmitError };

/**
 * Create or replace an employee's selection inside a serializable transaction so stock limits hold under
 * concurrent picks. `onBehalfOfAdminId` lets HR pick for a walk-up employee and bypasses the open-window check.
 */
export async function submitSelection(input: {
  campaignId: string;
  employeeId: string;
  itemId: string;
  option1Value: string | null;
  option2Value: string | null;
  lang: string;
  onBehalfOfAdminId?: string;
}): Promise<SubmitResult> {
  const campaign = await db.campaign.findUnique({ where: { id: input.campaignId } });
  if (!campaign) return { ok: false, error: "not_open" };
  if (!input.onBehalfOfAdminId && !campaignAcceptsPicks(campaign).ok) return { ok: false, error: "not_open" };
  if (!(await isEligible(campaign, input.employeeId))) return { ok: false, error: "not_eligible" };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const outcome = await db.$transaction(
        async (tx) => {
          const existing = await tx.selection.findUnique({ where: { campaignId_employeeId: { campaignId: campaign.id, employeeId: input.employeeId } } });
          if (existing) {
            if (!canChangeSelection(existing.status, campaign.allowChangeUntilOrdered)) {
              return { ok: false as const, error: existing.status === "SELECTED" ? ("already_picked" as const) : ("cannot_change" as const) };
            }
          }

          const ci = await tx.campaignItem.findUnique({ where: { campaignId_itemId: { campaignId: campaign.id, itemId: input.itemId } }, include: { item: true } });
          if (!ci) return { ok: false as const, error: "unknown_item" as const };

          const picked = validatePick(ci.item, ci, { option1Value: input.option1Value, option2Value: input.option2Value });
          if (!picked.ok) return { ok: false as const, error: picked.error };

          const taken = await tx.selection.count({
            where: { campaignId: campaign.id, itemId: input.itemId, status: { in: [...COMMITTED_STATUSES] }, NOT: existing ? { id: existing.id } : undefined },
          });
          const avail = itemAvailability({ status: ci.status, stockLimit: ci.stockLimit, taken, itemActive: ci.item.active });
          if (!avail.available) return { ok: false as const, error: "unavailable" as const };

          const campaignEmployee = await tx.campaignEmployee.findUnique({ where: { campaignId_employeeId: { campaignId: campaign.id, employeeId: input.employeeId } } });
          const cost = effectiveItemCost(ci.item, ci);
          const budget = employeeBudget(campaign, campaignEmployee);
          if (!input.onBehalfOfAdminId && isOverBudget(cost, budget)) return { ok: false as const, error: "over_budget" as const };

          const data = {
            itemId: input.itemId,
            option1Value: picked.values.option1Value,
            option2Value: picked.values.option2Value,
            costAtSelection: cost,
            status: "SELECTED" as const,
            language: input.lang,
            selectedAt: new Date(),
            orderedAt: null,
            receivedAt: null,
            collectedAt: null,
          };

          let selectionId: string;
          let confirmationCode: string;
          if (existing) {
            const updated = await tx.selection.update({ where: { id: existing.id }, data });
            selectionId = updated.id;
            confirmationCode = updated.confirmationCode;
          } else {
            const created = await tx.selection.create({
              data: { ...data, campaignId: campaign.id, employeeId: input.employeeId, confirmationCode: await uniqueCode(tx) },
            });
            selectionId = created.id;
            confirmationCode = created.confirmationCode;
          }
          await tx.auditLog.create({
            data: {
              actorType: input.onBehalfOfAdminId ? "ADMIN" : "EMPLOYEE",
              actorId: input.onBehalfOfAdminId ?? input.employeeId,
              action: existing ? "selection.changed" : "selection.created",
              entityType: "Selection",
              entityId: selectionId,
              meta: { previousItemId: existing?.itemId ?? null, previousStatus: existing?.status ?? null, itemId: input.itemId, option1Value: picked.values.option1Value, option2Value: picked.values.option2Value, cost },
            },
          });
          return { ok: true as const, selectionId, confirmationCode, changed: Boolean(existing) };
        },
        { isolationLevel: "Serializable", maxWait: 5000, timeout: 15000 },
      );
      if (outcome.ok) await notifySelections(outcome.changed ? "selection.changed" : "selection.created", [outcome.selectionId]);
      return outcome;
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "P2034" && attempt < 2) continue; // serialization conflict: retry
      throw err;
    }
  }
  return { ok: false, error: "unavailable" };
}

async function uniqueCode(tx: Prisma.TransactionClient): Promise<string> {
  for (let i = 0; i < 10; i += 1) {
    const code = generateConfirmationCode(6);
    const clash = await tx.selection.findUnique({ where: { confirmationCode: code } });
    if (!clash) return code;
  }
  return generateConfirmationCode(8);
}

/** Toggle an item's stock status in a campaign; marking it out of stock flags affected employees for re-pick. */
export async function setCampaignItemStock(input: { campaignId: string; itemId: string; outOfStock: boolean; adminId: string }): Promise<{ affected: number }> {
  const status = input.outOfStock ? "OUT_OF_STOCK" : "AVAILABLE";
  await db.campaignItem.update({ where: { campaignId_itemId: { campaignId: input.campaignId, itemId: input.itemId } }, data: { status } });
  let affected = 0;
  if (input.outOfStock) {
    const ids = (await db.selection.findMany({ where: { campaignId: input.campaignId, itemId: input.itemId, status: "SELECTED" }, select: { id: true } })).map((r) => r.id);
    const res = await db.selection.updateMany({ where: { id: { in: ids } }, data: { status: "NEEDS_REPICK" } });
    affected = res.count;
    await notifySelections("selection.needs_repick", ids, { reason: "out_of_stock" });
  }
  await audit({ actorType: "ADMIN", actorId: input.adminId, action: input.outOfStock ? "item.out_of_stock" : "item.back_in_stock", entityType: "CampaignItem", entityId: `${input.campaignId}:${input.itemId}`, meta: { affected } });
  return { affected };
}

export type SetOptionsResult = { ok: true; affected: number; removed1: string[]; removed2: string[] } | { ok: false; error: string };

/**
 * Change which option values a campaign offers for a gift. Employees who chose a value that is no longer
 * offered (and whose gift has not been ordered yet) are flagged to re-pick, like an out-of-stock gift.
 */
export async function setCampaignItemOptions(input: {
  campaignId: string;
  itemId: string;
  enabledOption1Values: string[];
  enabledOption2Values: string[];
  adminId: string;
}): Promise<SetOptionsResult> {
  const ci = await db.campaignItem.findUnique({ where: { campaignId_itemId: { campaignId: input.campaignId, itemId: input.itemId } }, include: { item: true } });
  if (!ci) return { ok: false, error: "Gift is not in this campaign." };
  const groups = optionGroups(ci.item);
  const g1 = groups.find((g) => g.index === 1);
  const g2 = groups.find((g) => g.index === 2);
  // Keep only values the catalog actually defines; store [] (= all) when every value is ticked.
  const clean = (values: string[], catalog: string[]) => {
    const kept = catalog.filter((v) => values.includes(v));
    return kept.length === catalog.length ? [] : kept;
  };
  const enabled1 = g1 ? clean(input.enabledOption1Values, g1.values) : [];
  const enabled2 = g2 ? clean(input.enabledOption2Values, g2.values) : [];
  if (g1 && g1.values.filter((v) => enabled1.length === 0 || enabled1.includes(v)).length === 0) return { ok: false, error: `Offer at least one ${g1.label} value, or remove the gift from the campaign.` };
  if (g2 && g2.values.filter((v) => enabled2.length === 0 || enabled2.includes(v)).length === 0) return { ok: false, error: `Offer at least one ${g2.label} value, or remove the gift from the campaign.` };

  const removed1 = g1 ? removedValues(g1.values, ci.enabledOption1Values, enabled1) : [];
  const removed2 = g2 ? removedValues(g2.values, ci.enabledOption2Values, enabled2) : [];
  await db.campaignItem.update({ where: { campaignId_itemId: { campaignId: input.campaignId, itemId: input.itemId } }, data: { enabledOption1Values: enabled1, enabledOption2Values: enabled2 } });

  let affected = 0;
  if (removed1.length > 0 || removed2.length > 0) {
    const where = {
      campaignId: input.campaignId,
      itemId: input.itemId,
      status: "SELECTED" as const,
      OR: [...(removed1.length > 0 ? [{ option1Value: { in: removed1 } }] : []), ...(removed2.length > 0 ? [{ option2Value: { in: removed2 } }] : [])],
    };
    const ids = (await db.selection.findMany({ where, select: { id: true } })).map((r) => r.id);
    const res = await db.selection.updateMany({ where: { id: { in: ids } }, data: { status: "NEEDS_REPICK" } });
    affected = res.count;
    await notifySelections("selection.needs_repick", ids, { reason: "option_removed", removed: [...removed1, ...removed2] });
  }
  await audit({ actorType: "ADMIN", actorId: input.adminId, action: "item.options_changed", entityType: "CampaignItem", entityId: `${input.campaignId}:${input.itemId}`, meta: { enabled1, enabled2, removed1, removed2, affected } });
  return { ok: true, affected, removed1, removed2 };
}

export async function updateSelectionStatuses(input: { ids: string[]; status: "SELECTED" | "ORDERED" | "RECEIVED" | "COLLECTED"; adminId: string }): Promise<number> {
  if (input.ids.length === 0) return 0;
  const now = new Date();
  const data: Prisma.SelectionUpdateManyMutationInput = { status: input.status };
  if (input.status === "ORDERED") data.orderedAt = now;
  if (input.status === "RECEIVED") data.receivedAt = now;
  if (input.status === "COLLECTED") data.collectedAt = now;
  if (input.status === "SELECTED") {
    data.orderedAt = null;
    data.receivedAt = null;
    data.collectedAt = null;
  }
  const res = await db.selection.updateMany({ where: { id: { in: input.ids }, status: { not: "NEEDS_REPICK" } }, data });
  await audit({ actorType: "ADMIN", actorId: input.adminId, action: `selection.status.${input.status.toLowerCase()}`, entityType: "Selection", entityId: input.ids.length === 1 ? input.ids[0] : "bulk", meta: { count: res.count, ids: input.ids.slice(0, 200) } });
  if (res.count > 0) await notifySelections("selection.status_changed", input.ids, { newStatus: input.status });
  return res.count;
}

export async function resetSelection(selectionId: string, adminId: string): Promise<void> {
  const existing = await db.selection.findUnique({ where: { id: selectionId } });
  if (!existing) return;
  await notifySelections("selection.reset", [selectionId]);
  await db.selection.delete({ where: { id: selectionId } });
  await audit({ actorType: "ADMIN", actorId: adminId, action: "selection.reset", entityType: "Selection", entityId: selectionId, meta: { employeeId: existing.employeeId, itemId: existing.itemId, status: existing.status } });
}

export function serializeSelection(selection: { id: string; itemId: string; option1Value: string | null; option2Value: string | null; confirmationCode: string; status: string; costAtSelection: unknown; selectedAt: Date } | null) {
  if (!selection) return null;
  return {
    id: selection.id,
    itemId: selection.itemId,
    option1Value: selection.option1Value,
    option2Value: selection.option2Value,
    confirmationCode: selection.confirmationCode,
    status: selection.status,
    cost: dec(selection.costAtSelection),
    selectedAt: selection.selectedAt.toISOString(),
  };
}
