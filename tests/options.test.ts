import { describe, expect, it } from "vitest";
import { offeredGroups, offeredValues, optionDetail, optionGroups, optionKey, optionSummary, parseOptionValues, removedValues, validatePick } from "@/lib/options";

const hoodie = { option1Label: "Color", option1Values: ["Black", "Teal", "Rose"], option2Label: "Size", option2Values: ["S", "M", "L"] };
const mug = { option1Label: "Color", option1Values: ["Red", "Blue"], option2Label: null, option2Values: [] };
const plain = { option1Label: null, option1Values: [], option2Label: null, option2Values: [] };

describe("parseOptionValues", () => {
  it("splits on commas, pipes and newlines, trims and de-duplicates", () => {
    expect(parseOptionValues(" Red, Blue |Green\nred ; ")).toEqual(["Red", "Blue", "Green"]);
    expect(parseOptionValues("")).toEqual([]);
    expect(parseOptionValues(null)).toEqual([]);
  });
});

describe("optionGroups / offeredValues / offeredGroups", () => {
  it("lists only groups with values and defaults the label", () => {
    expect(optionGroups(hoodie).map((g) => g.label)).toEqual(["Color", "Size"]);
    expect(optionGroups(mug)).toHaveLength(1);
    expect(optionGroups(plain)).toEqual([]);
    expect(optionGroups({ ...mug, option1Label: "" })[0].label).toBe("Option");
  });
  it("empty subset means all values; otherwise filter keeping catalog order", () => {
    expect(offeredValues(["Black", "Teal", "Rose"], [])).toEqual(["Black", "Teal", "Rose"]);
    expect(offeredValues(["Black", "Teal", "Rose"], ["Rose", "Black", "Gone"])).toEqual(["Black", "Rose"]);
  });
  it("drops groups with nothing offered", () => {
    const groups = offeredGroups(hoodie, { enabledOption1Values: ["Teal"], enabledOption2Values: ["XXL"] });
    expect(groups).toEqual([{ index: 1, label: "Color", values: ["Teal"] }]);
    expect(offeredGroups(hoodie, null)).toHaveLength(2);
  });
});

describe("validatePick", () => {
  it("requires a value for each defined group and rejects values not offered", () => {
    expect(validatePick(hoodie, null, { option1Value: "Teal", option2Value: "M" })).toEqual({ ok: true, values: { option1Value: "Teal", option2Value: "M" } });
    const missing = validatePick(hoodie, null, { option1Value: "Teal", option2Value: null });
    expect(missing).toMatchObject({ ok: false, error: "option_required", group: { label: "Size" } });
    const disabled = validatePick(hoodie, { enabledOption1Values: ["Black"], enabledOption2Values: [] }, { option1Value: "Teal", option2Value: "M" });
    expect(disabled).toMatchObject({ ok: false, error: "invalid_option", group: { label: "Color", values: ["Black"] } });
  });
  it("ignores stray values for gifts without options", () => {
    expect(validatePick(plain, null, { option1Value: "x", option2Value: "y" })).toEqual({ ok: true, values: { option1Value: null, option2Value: null } });
    expect(validatePick(mug, null, { option1Value: " Red ", option2Value: "junk" })).toEqual({ ok: true, values: { option1Value: "Red", option2Value: null } });
  });
});

describe("summaries and keys", () => {
  it("formats chosen values", () => {
    expect(optionSummary({ option1Value: "Teal", option2Value: "M" })).toBe("Teal / M");
    expect(optionSummary({ option1Value: "Red", option2Value: null })).toBe("Red");
    expect(optionSummary(null)).toBe("");
    expect(optionDetail(hoodie, { option1Value: "Teal", option2Value: "M" })).toBe("Color: Teal, Size: M");
    expect(optionDetail({ option1Label: null, option2Label: null }, { option1Value: "Teal", option2Value: null })).toBe("Teal");
    expect(optionKey("a", { option1Value: "Teal", option2Value: null })).toBe("a::Teal::");
  });
  it("computes removed values from an admin edit", () => {
    expect(removedValues(["Black", "Teal", "Rose"], [], ["Black"])).toEqual(["Teal", "Rose"]);
    expect(removedValues(["Black", "Teal"], ["Black"], ["Black", "Teal"])).toEqual([]);
  });
});
