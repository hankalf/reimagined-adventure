/** Pure budget helpers shared by the employee page, admin Budget tab, HR email and Excel export. */
import { optionKey, optionSummary } from "./options";

export type SelectionStatusLike = "SELECTED" | "NEEDS_REPICK" | "ORDERED" | "RECEIVED" | "COLLECTED";

/** Statuses that represent a committed choice (counted toward spend). */
export const COMMITTED_STATUSES: readonly SelectionStatusLike[] = ["SELECTED", "ORDERED", "RECEIVED", "COLLECTED"];
/** Statuses where HR has already placed (or fulfilled) the order. */
export const ORDERED_STATUSES: readonly SelectionStatusLike[] = ["ORDERED", "RECEIVED", "COLLECTED"];

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value));
  return Number.isFinite(n) ? n : null;
}

/** The cost HR will actually pay for an item within a campaign (campaign override beats catalog cost). */
export function effectiveItemCost(
  item: { unitCost: unknown },
  campaignItem?: { unitCostOverride: unknown } | null,
): number | null {
  const override = toNumber(campaignItem?.unitCostOverride);
  if (override !== null) return override;
  return toNumber(item.unitCost);
}

/** The budget that applies to one employee in a campaign (per-employee override beats campaign default). */
export function employeeBudget(
  campaign: { defaultEmployeeBudget: unknown },
  campaignEmployee?: { budgetOverride: unknown } | null,
): number | null {
  const override = toNumber(campaignEmployee?.budgetOverride);
  if (override !== null) return override;
  return toNumber(campaign.defaultEmployeeBudget);
}

/** True only when both a cost and a budget are known and the cost exceeds the budget. */
export function isOverBudget(cost: number | null, budget: number | null): boolean {
  if (cost === null || budget === null) return false;
  return cost > budget + 1e-9;
}

export type BudgetTotals = {
  totalBudget: number | null;
  committed: number;
  ordered: number;
  remaining: number | null;
  committedCount: number;
  orderedCount: number;
  unpricedCount: number;
};

export function summarizeBudget(
  selections: Array<{ status: SelectionStatusLike; costAtSelection: unknown }>,
  totalBudget: unknown,
): BudgetTotals {
  let committed = 0;
  let ordered = 0;
  let committedCount = 0;
  let orderedCount = 0;
  let unpricedCount = 0;
  for (const s of selections) {
    if (!COMMITTED_STATUSES.includes(s.status)) continue;
    committedCount += 1;
    const cost = toNumber(s.costAtSelection);
    if (cost === null) {
      unpricedCount += 1;
      continue;
    }
    committed += cost;
    if (ORDERED_STATUSES.includes(s.status)) {
      ordered += cost;
      orderedCount += 1;
    }
  }
  const total = toNumber(totalBudget);
  return {
    totalBudget: total,
    committed: round2(committed),
    ordered: round2(ordered),
    remaining: total === null ? null : round2(total - committed),
    committedCount,
    orderedCount,
    unpricedCount,
  };
}

export type ItemSpendRow = {
  itemId: string;
  name: string;
  /** Chosen option values, e.g. "Teal / M"; empty when the gift has no options. */
  optionText: string;
  quantity: number;
  unitCost: number | null;
  subtotal: number | null;
};

/** Group committed selections by item (and chosen option) with quantities and subtotals. */
export function perItemSpend(
  selections: Array<{
    status: SelectionStatusLike;
    itemId: string;
    option1Value: string | null;
    option2Value: string | null;
    costAtSelection: unknown;
    item: { name: string };
  }>,
): ItemSpendRow[] {
  const map = new Map<string, ItemSpendRow>();
  for (const s of selections) {
    if (!COMMITTED_STATUSES.includes(s.status)) continue;
    const key = optionKey(s.itemId, s);
    const cost = toNumber(s.costAtSelection);
    const row = map.get(key) ?? {
      itemId: s.itemId,
      name: s.item.name,
      optionText: optionSummary(s),
      quantity: 0,
      unitCost: cost,
      subtotal: 0,
    };
    row.quantity += 1;
    if (cost !== null && row.subtotal !== null) row.subtotal = round2(row.subtotal + cost);
    else if (cost === null) row.subtotal = row.subtotal === null ? null : row.quantity === 1 ? null : row.subtotal;
    if (row.unitCost === null && cost !== null) row.unitCost = cost;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
