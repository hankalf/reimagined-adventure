"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendHrOrderEmail } from "@/lib/hr-email";
import { processImage } from "@/lib/images";
import { resetSelection, setCampaignItemOptions, setCampaignItemStock, submitSelection, updateSelectionStatuses } from "@/lib/selection";
import { optionGroups } from "@/lib/options";
import { isHexColor, parseEmails, slugify } from "@/lib/utils";
import { randomBytes } from "node:crypto";

export type FormState = { error?: string; success?: string } | null;

const s = (fd: FormData, key: string): string => {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
};
const num = (v: string): number | null => {
  if (!v) return null;
  const n = Number(v.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const date = (v: string): Date | null => (v ? new Date(v) : null);
const revalidateCampaign = (id: string) => {
  revalidatePath(`/admin/campaigns/${id}`, "layout");
  revalidatePath("/admin");
  revalidatePath("/admin/campaigns");
};

// ---------- create / settings ----------

export async function createCampaignAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const name = s(formData, "name");
  if (!name) return { error: "Give the campaign a name." };
  let slug = slugify(s(formData, "slug") || name);
  if (await db.campaign.findUnique({ where: { slug } })) slug = `${slug}-${randomBytes(2).toString("hex")}`;
  const defaultHr = (await db.setting.findUnique({ where: { key: "default_hr_emails" } }))?.value ?? "";
  const copyFromId = s(formData, "copyFrom");
  const source = copyFromId ? await db.campaign.findUnique({ where: { id: copyFromId }, include: { items: true } }) : null;

  const campaign = await db.campaign.create({
    data: {
      name,
      slug,
      hrEmails: parseEmails(s(formData, "hrEmails") || defaultHr),
      closesAt: date(s(formData, "closesAt")),
      defaultEmployeeBudget: num(s(formData, "defaultEmployeeBudget")),
      totalBudget: num(s(formData, "totalBudget")),
      ...(source
        ? {
            welcomeHeadline: source.welcomeHeadline,
            welcomeHeadlineEs: source.welcomeHeadlineEs,
            welcomeMessage: source.welcomeMessage,
            welcomeMessageEs: source.welcomeMessageEs,
            pickupInstructions: source.pickupInstructions,
            pickupInstructionsEs: source.pickupInstructionsEs,
            leadershipMessage: source.leadershipMessage,
            leadershipMessageEs: source.leadershipMessageEs,
            leadershipName: source.leadershipName,
            logoImageId: source.logoImageId,
            heroImageId: source.heroImageId,
            primaryColor: source.primaryColor,
            accentColor: source.accentColor,
            companyName: source.companyName,
            currency: source.currency,
            requireLastName: source.requireLastName,
            allowChangeUntilOrdered: source.allowChangeUntilOrdered,
            showSoldOutItems: source.showSoldOutItems,
            hideItemsOverBudget: source.hideItemsOverBudget,
            items: { create: source.items.map((ci) => ({ itemId: ci.itemId, sortOrder: ci.sortOrder, stockLimit: ci.stockLimit, unitCostOverride: ci.unitCostOverride })) },
          }
        : {}),
    },
  });
  await audit({ actorType: "ADMIN", actorId: admin.id, action: "campaign.created", entityType: "Campaign", entityId: campaign.id, meta: { name, copiedFrom: source?.id ?? null } });
  revalidateCampaign(campaign.id);
  redirect(`/admin/campaigns/${campaign.id}/items`);
}

export async function updateCampaignSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = s(formData, "id");
  const campaign = await db.campaign.findUnique({ where: { id } });
  if (!campaign) return { error: "Campaign not found." };
  const name = s(formData, "name");
  if (!name) return { error: "Name is required." };
  const slug = slugify(s(formData, "slug") || name);
  const clash = await db.campaign.findUnique({ where: { slug } });
  if (clash && clash.id !== id) return { error: `The link /g/${slug} is already used by “${clash.name}”.` };
  const currency = s(formData, "currency").toUpperCase() || "USD";
  if (!/^[A-Z]{3}$/.test(currency)) return { error: "Currency must be a 3-letter code like USD." };
  const opensAt = date(s(formData, "opensAt"));
  const closesAt = date(s(formData, "closesAt"));
  if (opensAt && closesAt && closesAt < opensAt) return { error: "Close date must be after the open date." };

  await db.campaign.update({
    where: { id },
    data: {
      name,
      slug,
      opensAt,
      closesAt,
      currency,
      requireLastName: formData.get("requireLastName") === "on",
      allowChangeUntilOrdered: formData.get("allowChangeUntilOrdered") === "on",
      showSoldOutItems: formData.get("showSoldOutItems") === "on",
      hideItemsOverBudget: formData.get("hideItemsOverBudget") === "on",
      allEmployeesEligible: formData.get("allEmployeesEligible") === "on",
      hrEmails: parseEmails(s(formData, "hrEmails")),
      totalBudget: num(s(formData, "totalBudget")),
      defaultEmployeeBudget: num(s(formData, "defaultEmployeeBudget")),
    },
  });
  await audit({ actorType: "ADMIN", actorId: admin.id, action: "campaign.settings_updated", entityType: "Campaign", entityId: id });
  revalidateCampaign(id);
  return { success: "Settings saved." };
}

export async function setCampaignStatusAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = s(formData, "id");
  const status = s(formData, "status");
  if (!["DRAFT", "OPEN", "CLOSED"].includes(status)) return;
  await db.campaign.update({ where: { id }, data: { status: status as "DRAFT" | "OPEN" | "CLOSED" } });
  await audit({ actorType: "ADMIN", actorId: admin.id, action: `campaign.${status.toLowerCase()}`, entityType: "Campaign", entityId: id });
  revalidateCampaign(id);
}

export async function deleteCampaignAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin({ role: "ADMIN" });
  const id = s(formData, "id");
  const campaign = await db.campaign.findUnique({ where: { id } });
  if (!campaign) return;
  await db.campaign.delete({ where: { id } });
  await audit({ actorType: "ADMIN", actorId: admin.id, action: "campaign.deleted", entityType: "Campaign", entityId: id, meta: { name: campaign.name } });
  revalidatePath("/admin");
  revalidatePath("/admin/campaigns");
  redirect("/admin/campaigns");
}

// ---------- branding ----------

async function storeUpload(formData: FormData, key: string): Promise<string | null | undefined> {
  const file = formData.get(key);
  if (file instanceof File && file.size > 0) {
    const processed = await processImage(Buffer.from(await file.arrayBuffer()), file.type);
    const img = await db.image.create({ data: processed });
    return img.id;
  }
  if (formData.get(`${key}Remove`) === "1") return null;
  return undefined;
}

export async function updateBrandingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = s(formData, "id");
  const campaign = await db.campaign.findUnique({ where: { id } });
  if (!campaign) return { error: "Campaign not found." };
  const primaryColor = s(formData, "primaryColor") || "#1d4ed8";
  const accentColor = s(formData, "accentColor") || "#f59e0b";
  if (!isHexColor(primaryColor) || !isHexColor(accentColor)) return { error: "Colours must be hex values like #1d4ed8." };
  let logoImageId: string | null | undefined;
  let heroImageId: string | null | undefined;
  try {
    logoImageId = await storeUpload(formData, "logo");
    heroImageId = await storeUpload(formData, "hero");
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not process an image." };
  }
  await db.campaign.update({
    where: { id },
    data: {
      companyName: s(formData, "companyName") || null,
      primaryColor,
      accentColor,
      welcomeHeadline: s(formData, "welcomeHeadline") || "Choose your gift",
      welcomeHeadlineEs: s(formData, "welcomeHeadlineEs") || null,
      welcomeMessage: s(formData, "welcomeMessage"),
      welcomeMessageEs: s(formData, "welcomeMessageEs") || null,
      pickupInstructions: s(formData, "pickupInstructions"),
      pickupInstructionsEs: s(formData, "pickupInstructionsEs") || null,
      leadershipMessage: s(formData, "leadershipMessage") || null,
      leadershipMessageEs: s(formData, "leadershipMessageEs") || null,
      leadershipName: s(formData, "leadershipName") || null,
      ...(logoImageId !== undefined ? { logoImageId } : {}),
      ...(heroImageId !== undefined ? { heroImageId } : {}),
    },
  });
  await audit({ actorType: "ADMIN", actorId: admin.id, action: "campaign.branding_updated", entityType: "Campaign", entityId: id });
  revalidateCampaign(id);
  revalidatePath(`/g/${campaign.slug}`, "layout");
  return { success: "Branding saved." };
}

// ---------- gifts shown ----------

/** Checkbox values for a group, reduced to [] (= all) when every catalog value is ticked or nothing is ticked. */
function enabledSubset(formData: FormData, field: string, catalogValues: string[]): string[] {
  const ticked = new Set(formData.getAll(field).map(String));
  const kept = catalogValues.filter((v) => ticked.has(v));
  return kept.length === 0 || kept.length === catalogValues.length ? [] : kept;
}

export async function addCampaignItemsAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const campaignId = s(formData, "campaignId");
  const itemIds = formData.getAll("itemIds").map(String).filter(Boolean);
  if (!campaignId || itemIds.length === 0) return;
  const max = await db.campaignItem.aggregate({ where: { campaignId }, _max: { sortOrder: true } });
  let order = (max._max.sortOrder ?? -1) + 1;
  const items = await db.item.findMany({ where: { id: { in: itemIds } } });
  for (const itemId of itemIds) {
    const item = items.find((i) => i.id === itemId);
    if (!item) continue;
    const groups = optionGroups(item);
    const g1 = groups.find((g) => g.index === 1);
    const g2 = groups.find((g) => g.index === 2);
    const enabledOption1Values = g1 ? enabledSubset(formData, `enabled1:${itemId}`, g1.values) : [];
    const enabledOption2Values = g2 ? enabledSubset(formData, `enabled2:${itemId}`, g2.values) : [];
    await db.campaignItem.upsert({
      where: { campaignId_itemId: { campaignId, itemId } },
      update: {},
      create: { campaignId, itemId, sortOrder: order, enabledOption1Values, enabledOption2Values },
    });
    order += 1;
  }
  await audit({ actorType: "ADMIN", actorId: admin.id, action: "campaign.items_added", entityType: "Campaign", entityId: campaignId, meta: { itemIds } });
  revalidateCampaign(campaignId);
}

export async function removeCampaignItemAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const campaignId = s(formData, "campaignId");
  const itemId = s(formData, "itemId");
  const chosen = await db.selection.count({ where: { campaignId, itemId } });
  if (chosen > 0) {
    // Keep the row so existing selections stay valid, but stop offering it.
    await setCampaignItemStock({ campaignId, itemId, outOfStock: true, adminId: admin.id });
  } else {
    await db.campaignItem.delete({ where: { campaignId_itemId: { campaignId, itemId } } }).catch(() => undefined);
  }
  await audit({ actorType: "ADMIN", actorId: admin.id, action: "campaign.item_removed", entityType: "Campaign", entityId: campaignId, meta: { itemId, chosen } });
  revalidateCampaign(campaignId);
}

export async function updateCampaignItemAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const campaignId = s(formData, "campaignId");
  const itemId = s(formData, "itemId");
  const stockLimitRaw = s(formData, "stockLimit");
  const stockLimit = stockLimitRaw ? Math.max(0, Math.floor(Number(stockLimitRaw))) : null;
  await db.campaignItem.update({
    where: { campaignId_itemId: { campaignId, itemId } },
    data: { stockLimit: stockLimit !== null && Number.isFinite(stockLimit) ? stockLimit : null, unitCostOverride: num(s(formData, "unitCostOverride")) },
  });
  let notice = "Saved.";
  if (formData.get("hasOptions") === "1") {
    const result = await setCampaignItemOptions({
      campaignId,
      itemId,
      enabledOption1Values: formData.getAll("enabled1").map(String),
      enabledOption2Values: formData.getAll("enabled2").map(String),
      adminId: admin.id,
    });
    revalidateCampaign(campaignId);
    if (!result.ok) redirect(`/admin/campaigns/${campaignId}/items?error=${encodeURIComponent(result.error)}`);
    if (result.affected > 0) notice = `Saved. ${result.affected} employee(s) who chose a value you removed will be asked to pick again.`;
  }
  revalidateCampaign(campaignId);
  redirect(`/admin/campaigns/${campaignId}/items?saved=${encodeURIComponent(notice)}`);
}

export async function moveCampaignItemAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const campaignId = s(formData, "campaignId");
  const itemId = s(formData, "itemId");
  const direction = s(formData, "direction") === "up" ? -1 : 1;
  const rows = await db.campaignItem.findMany({ where: { campaignId }, orderBy: [{ sortOrder: "asc" }, { item: { name: "asc" } }] });
  const idx = rows.findIndex((r) => r.itemId === itemId);
  const swap = idx + direction;
  if (idx === -1 || swap < 0 || swap >= rows.length) return;
  const reordered = [...rows];
  [reordered[idx], reordered[swap]] = [reordered[swap], reordered[idx]];
  await db.$transaction(reordered.map((r, i) => db.campaignItem.update({ where: { campaignId_itemId: { campaignId, itemId: r.itemId } }, data: { sortOrder: i } })));
  revalidateCampaign(campaignId);
}

export async function toggleStockAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const campaignId = s(formData, "campaignId");
  const itemId = s(formData, "itemId");
  const outOfStock = s(formData, "outOfStock") === "1";
  await setCampaignItemStock({ campaignId, itemId, outOfStock, adminId: admin.id });
  revalidateCampaign(campaignId);
}

// ---------- eligibility ----------

export async function setEligibilityModeAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = s(formData, "id");
  const all = s(formData, "allEmployeesEligible") === "1";
  await db.campaign.update({ where: { id }, data: { allEmployeesEligible: all } });
  await audit({ actorType: "ADMIN", actorId: admin.id, action: "campaign.eligibility_mode", entityType: "Campaign", entityId: id, meta: { allEmployeesEligible: all } });
  revalidateCampaign(id);
}

export async function addEligibleEmployeeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const campaignId = s(formData, "campaignId");
  const employeeNumber = s(formData, "employeeNumber").replace(/\s+/g, "").toUpperCase();
  const employee = await db.employee.findUnique({ where: { employeeNumber } });
  if (!employee) return { error: `No employee with number ${employeeNumber}. Add them on the Employees page first.` };
  await db.campaignEmployee.upsert({
    where: { campaignId_employeeId: { campaignId, employeeId: employee.id } },
    update: { budgetOverride: num(s(formData, "budget")) },
    create: { campaignId, employeeId: employee.id, budgetOverride: num(s(formData, "budget")) },
  });
  revalidateCampaign(campaignId);
  return { success: `${employee.firstName} ${employee.lastName} is eligible.` };
}

export async function removeEligibleEmployeeAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const campaignId = s(formData, "campaignId");
  const employeeId = s(formData, "employeeId");
  await db.campaignEmployee.delete({ where: { campaignId_employeeId: { campaignId, employeeId } } }).catch(() => undefined);
  revalidateCampaign(campaignId);
}

export async function updateBudgetOverrideAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const campaignId = s(formData, "campaignId");
  const employeeId = s(formData, "employeeId");
  const budget = num(s(formData, "budget"));
  await db.campaignEmployee.upsert({
    where: { campaignId_employeeId: { campaignId, employeeId } },
    update: { budgetOverride: budget },
    create: { campaignId, employeeId, budgetOverride: budget },
  });
  revalidateCampaign(campaignId);
}

// ---------- selections / orders ----------

const statusSchema = z.enum(["SELECTED", "ORDERED", "RECEIVED", "COLLECTED"]);

/** Single form handles bulk buttons (name=bulk) and per-row buttons (name=single value="selectionId:STATUS|RESET"). */
export async function ordersAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const campaignId = s(formData, "campaignId");
  const returnTo = s(formData, "returnTo") || `/admin/campaigns/${campaignId}/orders`;
  const single = s(formData, "single");
  const bulk = s(formData, "bulk");
  if (single) {
    const [selectionId, action] = single.split(":");
    if (action === "RESET") await resetSelection(selectionId, admin.id);
    else {
      const parsed = statusSchema.safeParse(action);
      if (parsed.success) await updateSelectionStatuses({ ids: [selectionId], status: parsed.data, adminId: admin.id });
    }
  } else if (bulk) {
    const ids = formData.getAll("ids").map(String).filter(Boolean);
    const parsed = statusSchema.safeParse(bulk);
    if (parsed.success && ids.length > 0) await updateSelectionStatuses({ ids, status: parsed.data, adminId: admin.id });
  }
  revalidateCampaign(campaignId);
  redirect(returnTo);
}

/** "Mark all" for one item+option group: moves every selection in `fromStatus` to `toStatus`. */
export async function bulkItemStatusAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const campaignId = s(formData, "campaignId");
  const itemId = s(formData, "itemId");
  const option1Value = s(formData, "option1Value") || null;
  const option2Value = s(formData, "option2Value") || null;
  const from = statusSchema.safeParse(s(formData, "fromStatus"));
  const to = statusSchema.safeParse(s(formData, "toStatus"));
  if (!from.success || !to.success) return;
  const rows = await db.selection.findMany({ where: { campaignId, itemId, status: from.data, option1Value, option2Value }, select: { id: true } });
  await updateSelectionStatuses({ ids: rows.map((r) => r.id), status: to.data, adminId: admin.id });
  revalidateCampaign(campaignId);
}

export async function pickOnBehalfAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const campaignId = s(formData, "campaignId");
  const employeeId = s(formData, "employeeId");
  const itemId = s(formData, "itemId");
  const option1Value = s(formData, "option1Value") || null;
  const option2Value = s(formData, "option2Value") || null;
  if (!employeeId || !itemId) return { error: "Choose an employee and a gift." };
  const existing = await db.selection.findUnique({ where: { campaignId_employeeId: { campaignId, employeeId } } });
  if (existing && existing.status !== "SELECTED" && existing.status !== "NEEDS_REPICK") return { error: "This employee's gift has already been ordered. Reset it first if you need to change it." };
  if (existing) await resetSelection(existing.id, admin.id);
  const result = await submitSelection({ campaignId, employeeId, itemId, option1Value, option2Value, lang: "en", onBehalfOfAdminId: admin.id });
  revalidateCampaign(campaignId);
  if (!result.ok) return { error: `Could not record the pick (${result.error.replace(/_/g, " ")}).` };
  return { success: `Recorded. Confirmation code ${result.confirmationCode}.` };
}

// ---------- emails & feed ----------

export async function sendHrEmailAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const campaignId = s(formData, "campaignId");
  const mode = s(formData, "mode") === "new" ? "new" : "full";
  const to = parseEmails(s(formData, "to"));
  if (to.length === 0) return { error: "Enter at least one recipient email." };
  if (formData.get("saveRecipients") === "on") await db.campaign.update({ where: { id: campaignId }, data: { hrEmails: to } });
  const { log, data } = await sendHrOrderEmail({ campaignId, to, mode, actorId: admin.id, actorType: "ADMIN" });
  revalidateCampaign(campaignId);
  if (log.status === "FAILED") return { error: `Email failed: ${log.error ?? "unknown error"}. Check SMTP settings.` };
  const rows = mode === "new" ? data.counts.newSinceLast : data.counts.picked;
  return { success: log.status === "LOGGED" ? `Email recorded in the log (console mode: nothing was sent). ${rows} selection(s) included. Configure SMTP to send for real.` : `Email sent to ${to.join(", ")} with ${rows} selection(s) and the Excel workbook attached.` };
}

export async function toggleDigestAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = s(formData, "id");
  const enabled = s(formData, "enabled") === "1";
  await db.campaign.update({ where: { id }, data: { digestEnabled: enabled } });
  revalidateCampaign(id);
}

export async function regenerateFeedTokenAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = s(formData, "id");
  await db.campaign.update({ where: { id }, data: { feedToken: randomBytes(24).toString("hex") } });
  await audit({ actorType: "ADMIN", actorId: admin.id, action: "campaign.feed_token_rotated", entityType: "Campaign", entityId: id });
  revalidateCampaign(id);
}
