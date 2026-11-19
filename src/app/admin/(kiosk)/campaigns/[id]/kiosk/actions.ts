"use server";

import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseScanPayload } from "@/lib/kiosk";
import { employeeNumberCandidates } from "@/lib/selection-rules";
import { dec } from "@/lib/utils";
import { optionDetail, optionSummary } from "@/lib/options";

export type KioskSelection = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  department: string | null;
  itemName: string;
  itemNameEs: string | null;
  optionText: string;
  optionDetail: string;
  imageId: string | null;
  imageUrl: string | null;
  status: string;
  code: string;
  cost: number | null;
  receivedAt: string | null;
  collectedAt: string | null;
};

export type KioskStats = { total: number; toOrder: number; ordered: number; ready: number; collected: number; needsRepick: number };

export type KioskLookup =
  | { kind: "selection"; selection: KioskSelection }
  | { kind: "multiple"; matches: Array<{ id: string; label: string; status: string }> }
  | { kind: "no_selection"; employee: { name: string; employeeNumber: string } }
  | { kind: "none"; message: string };

function serialize(s: {
  id: string;
  option1Value: string | null;
  option2Value: string | null;
  confirmationCode: string;
  status: string;
  costAtSelection: unknown;
  receivedAt: Date | null;
  collectedAt: Date | null;
  employee: { employeeNumber: string; firstName: string; lastName: string; department: string | null };
  item: { name: string; nameEs: string | null; option1Label: string | null; option2Label: string | null; imageId: string | null; imageUrl: string | null };
}): KioskSelection {
  return {
    id: s.id,
    employeeNumber: s.employee.employeeNumber,
    firstName: s.employee.firstName,
    lastName: s.employee.lastName,
    department: s.employee.department,
    itemName: s.item.name,
    itemNameEs: s.item.nameEs,
    optionText: optionSummary(s),
    optionDetail: optionDetail(s.item, s),
    imageId: s.item.imageId,
    imageUrl: s.item.imageUrl,
    status: s.status,
    code: s.confirmationCode,
    cost: dec(s.costAtSelection),
    receivedAt: s.receivedAt?.toISOString() ?? null,
    collectedAt: s.collectedAt?.toISOString() ?? null,
  };
}

const include = { employee: true, item: true } as const;

export async function kioskStatsAction(campaignId: string): Promise<KioskStats> {
  await requireAdmin();
  const rows = await db.selection.groupBy({ by: ["status"], where: { campaignId }, _count: { _all: true } });
  const by = Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
  const n = (k: string) => by[k] ?? 0;
  return {
    total: rows.reduce((a, r) => a + r._count._all, 0),
    toOrder: n("SELECTED"),
    ordered: n("ORDERED"),
    ready: n("RECEIVED"),
    collected: n("COLLECTED"),
    needsRepick: n("NEEDS_REPICK"),
  };
}

/** Find a selection from a scanned QR payload, a typed confirmation code, an employee number or a name. */
export async function kioskLookupAction(campaignId: string, rawQuery: string): Promise<KioskLookup> {
  await requireAdmin();
  const { code, text } = parseScanPayload(rawQuery);
  if (!text) return { kind: "none", message: "Scan a code or type an employee number." };

  if (code) {
    const byCode = await db.selection.findFirst({ where: { campaignId, confirmationCode: code }, include });
    if (byCode) return { kind: "selection", selection: serialize(byCode) };
  }

  const candidates = employeeNumberCandidates(text);
  if (candidates.length > 0) {
    const employees = await db.employee.findMany({ where: { employeeNumber: { in: candidates } } });
    const employee = employees.find((e) => e.employeeNumber === candidates[0]) ?? (employees.length === 1 ? employees[0] : undefined);
    if (employee) {
      const sel = await db.selection.findUnique({ where: { campaignId_employeeId: { campaignId, employeeId: employee.id } }, include });
      if (sel) return { kind: "selection", selection: serialize(sel) };
      return { kind: "no_selection", employee: { name: `${employee.firstName} ${employee.lastName}`.trim(), employeeNumber: employee.employeeNumber } };
    }
  }

  // Name search (first or last name contains each typed word)
  const words = text.split(/\s+/).filter((w) => w.length >= 2).slice(0, 3);
  if (words.length > 0) {
    const matches = await db.selection.findMany({
      where: {
        campaignId,
        AND: words.map((w) => ({ OR: [{ employee: { firstName: { contains: w, mode: "insensitive" } } }, { employee: { lastName: { contains: w, mode: "insensitive" } } }] })),
      },
      include,
      take: 12,
      orderBy: [{ employee: { lastName: "asc" } }],
    });
    if (matches.length === 1) return { kind: "selection", selection: serialize(matches[0]) };
    if (matches.length > 1) {
      return {
        kind: "multiple",
        matches: matches.map((m) => ({ id: m.id, label: `${m.employee.firstName} ${m.employee.lastName} · ${m.employee.employeeNumber} · ${m.item.name}${optionSummary(m) ? ` (${optionSummary(m)})` : ""}`, status: m.status })),
      };
    }
  }
  return { kind: "none", message: code ? `No gift found for code ${code} in this campaign.` : `Nothing found for “${text}”. Try the employee number or confirmation code.` };
}

export async function kioskSelectionByIdAction(campaignId: string, selectionId: string): Promise<KioskSelection | null> {
  await requireAdmin();
  const sel = await db.selection.findFirst({ where: { id: selectionId, campaignId }, include });
  return sel ? serialize(sel) : null;
}

export type KioskCollectResult = { ok: true; selection: KioskSelection; stats: KioskStats } | { ok: false; error: string; stats: KioskStats };

export async function kioskCollectAction(campaignId: string, selectionId: string): Promise<KioskCollectResult> {
  const admin = await requireAdmin();
  const sel = await db.selection.findFirst({ where: { id: selectionId, campaignId }, include });
  if (!sel) return { ok: false, error: "Selection not found.", stats: await kioskStatsAction(campaignId) };
  if (sel.status === "NEEDS_REPICK") return { ok: false, error: "This employee still needs to choose a new gift; nothing to hand out.", stats: await kioskStatsAction(campaignId) };
  if (sel.status === "COLLECTED") return { ok: false, error: "Already collected.", stats: await kioskStatsAction(campaignId) };
  const now = new Date();
  const updated = await db.selection.update({
    where: { id: sel.id },
    data: { status: "COLLECTED", collectedAt: now, receivedAt: sel.receivedAt ?? now, orderedAt: sel.orderedAt ?? now },
    include,
  });
  await audit({ actorType: "ADMIN", actorId: admin.id, action: "selection.status.collected", entityType: "Selection", entityId: sel.id, meta: { via: "kiosk", previousStatus: sel.status } });
  return { ok: true, selection: serialize(updated), stats: await kioskStatsAction(campaignId) };
}

export async function kioskUndoAction(campaignId: string, selectionId: string): Promise<KioskCollectResult> {
  const admin = await requireAdmin();
  const sel = await db.selection.findFirst({ where: { id: selectionId, campaignId }, include });
  if (!sel || sel.status !== "COLLECTED") return { ok: false, error: "Nothing to undo.", stats: await kioskStatsAction(campaignId) };
  const updated = await db.selection.update({ where: { id: sel.id }, data: { status: "RECEIVED", collectedAt: null }, include });
  await audit({ actorType: "ADMIN", actorId: admin.id, action: "selection.status.received", entityType: "Selection", entityId: sel.id, meta: { via: "kiosk-undo" } });
  return { ok: true, selection: serialize(updated), stats: await kioskStatsAction(campaignId) };
}
