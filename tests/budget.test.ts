import { describe, expect, it } from "vitest";
import { effectiveItemCost, employeeBudget, isOverBudget, perItemSpend, summarizeBudget } from "@/lib/budget";

describe("effectiveItemCost / employeeBudget", () => {
  it("prefers campaign overrides and tolerates Decimal-like strings", () => {
    expect(effectiveItemCost({ unitCost: "45.00" }, { unitCostOverride: null })).toBe(45);
    expect(effectiveItemCost({ unitCost: 45 }, { unitCostOverride: "39.5" })).toBe(39.5);
    expect(effectiveItemCost({ unitCost: null }, null)).toBeNull();
    expect(employeeBudget({ defaultEmployeeBudget: 75 }, { budgetOverride: 150 })).toBe(150);
    expect(employeeBudget({ defaultEmployeeBudget: 75 }, null)).toBe(75);
    expect(employeeBudget({ defaultEmployeeBudget: null }, null)).toBeNull();
  });
});

describe("isOverBudget", () => {
  it("only flags when both numbers are known", () => {
    expect(isOverBudget(80, 75)).toBe(true);
    expect(isOverBudget(75, 75)).toBe(false);
    expect(isOverBudget(null, 75)).toBe(false);
    expect(isOverBudget(80, null)).toBe(false);
  });
});

describe("summarizeBudget", () => {
  it("counts committed and ordered spend and ignores re-picks", () => {
    const totals = summarizeBudget(
      [
        { status: "SELECTED", costAtSelection: 45 },
        { status: "ORDERED", costAtSelection: "69.99" },
        { status: "COLLECTED", costAtSelection: 0 },
        { status: "NEEDS_REPICK", costAtSelection: 100 },
        { status: "SELECTED", costAtSelection: null },
      ],
      1200,
    );
    expect(totals).toMatchObject({ totalBudget: 1200, committed: 114.99, ordered: 69.99, remaining: 1085.01, committedCount: 4, orderedCount: 2, unpricedCount: 1 });
  });
});

describe("perItemSpend", () => {
  it("groups by item and option with quantities", () => {
    const rows = perItemSpend([
      { status: "SELECTED", itemId: "a", optionValue: "M", costAtSelection: 55, item: { name: "Hoodie" } },
      { status: "ORDERED", itemId: "a", optionValue: "M", costAtSelection: 55, item: { name: "Hoodie" } },
      { status: "SELECTED", itemId: "a", optionValue: "L", costAtSelection: 55, item: { name: "Hoodie" } },
      { status: "NEEDS_REPICK", itemId: "b", optionValue: null, costAtSelection: 10, item: { name: "Mug" } },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ name: "Hoodie", optionValue: "M", quantity: 2, subtotal: 110 });
    expect(rows[1]).toMatchObject({ optionValue: "L", quantity: 1 });
  });
});
