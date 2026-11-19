/**
 * Pure helpers for gift option groups (up to two per gift, e.g. Color and Size) and the per-campaign
 * subset of values that is actually offered to employees.
 */

export type OptionGroupIndex = 1 | 2;

export type ItemOptions = {
  option1Label: string | null;
  option1Values: string[];
  option2Label: string | null;
  option2Values: string[];
};

export type CampaignItemOptions = {
  enabledOption1Values: string[];
  enabledOption2Values: string[];
};

export type PickedOptions = { option1Value: string | null; option2Value: string | null };

export type OptionGroup = { index: OptionGroupIndex; label: string; values: string[] };

export type PickValidation =
  | { ok: true; values: PickedOptions }
  | { ok: false; error: "option_required" | "invalid_option"; group: OptionGroup };

/** Split "Red, Blue | Green" style input into clean, de-duplicated values. */
export function parseOptionValues(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(/[,|\n;]/)) {
    const v = part.trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

/** The option groups a gift defines (only groups with at least one value). */
export function optionGroups(item: ItemOptions): OptionGroup[] {
  const groups: OptionGroup[] = [];
  if (item.option1Values.length > 0) groups.push({ index: 1, label: item.option1Label?.trim() || "Option", values: item.option1Values });
  if (item.option2Values.length > 0) groups.push({ index: 2, label: item.option2Label?.trim() || "Option", values: item.option2Values });
  return groups;
}

/** Values offered in a campaign: the catalog values filtered by the enabled subset (empty subset = all), catalog order kept. */
export function offeredValues(catalogValues: string[], enabledSubset: string[] | null | undefined): string[] {
  if (!enabledSubset || enabledSubset.length === 0) return catalogValues;
  const enabled = new Set(enabledSubset);
  return catalogValues.filter((v) => enabled.has(v));
}

/** Option groups with only the values offered in this campaign. Groups with nothing offered are dropped. */
export function offeredGroups(item: ItemOptions, campaignItem?: CampaignItemOptions | null): OptionGroup[] {
  return optionGroups(item)
    .map((g) => ({ ...g, values: offeredValues(g.values, g.index === 1 ? campaignItem?.enabledOption1Values : campaignItem?.enabledOption2Values) }))
    .filter((g) => g.values.length > 0);
}

/** Check an employee's choice against the groups the gift defines and the values offered in the campaign. */
export function validatePick(item: ItemOptions, campaignItem: CampaignItemOptions | null | undefined, picked: PickedOptions): PickValidation {
  const values: PickedOptions = { option1Value: null, option2Value: null };
  for (const group of optionGroups(item)) {
    const offered = offeredValues(group.values, group.index === 1 ? campaignItem?.enabledOption1Values : campaignItem?.enabledOption2Values);
    const raw = group.index === 1 ? picked.option1Value : picked.option2Value;
    const value = raw?.trim() || null;
    if (!value) return { ok: false, error: "option_required", group: { ...group, values: offered } };
    if (!offered.includes(value)) return { ok: false, error: "invalid_option", group: { ...group, values: offered } };
    if (group.index === 1) values.option1Value = value;
    else values.option2Value = value;
  }
  return { ok: true, values };
}

/** "Teal / M" (only the chosen values), or "" when the gift has no options. */
export function optionSummary(picked: Partial<PickedOptions> | null | undefined): string {
  if (!picked) return "";
  return [picked.option1Value, picked.option2Value].filter((v): v is string => Boolean(v && v.trim())).join(" / ");
}

/** "Color: Teal, Size: M" for exports and emails. Falls back to the bare values when a label is missing. */
export function optionDetail(item: Pick<ItemOptions, "option1Label" | "option2Label">, picked: Partial<PickedOptions> | null | undefined): string {
  if (!picked) return "";
  const parts: string[] = [];
  if (picked.option1Value) parts.push(item.option1Label ? `${item.option1Label}: ${picked.option1Value}` : picked.option1Value);
  if (picked.option2Value) parts.push(item.option2Label ? `${item.option2Label}: ${picked.option2Value}` : picked.option2Value);
  return parts.join(", ");
}

/** Which catalog values were offered before an admin edit but are not offered after it. */
export function removedValues(catalogValues: string[], enabledBefore: string[], enabledAfter: string[]): string[] {
  const before = new Set(offeredValues(catalogValues, enabledBefore));
  const after = new Set(offeredValues(catalogValues, enabledAfter));
  return [...before].filter((v) => !after.has(v));
}

/** Grouping key for order summaries: same gift + same chosen values. */
export function optionKey(itemId: string, picked: Partial<PickedOptions> | null | undefined): string {
  return `${itemId}::${picked?.option1Value ?? ""}::${picked?.option2Value ?? ""}`;
}
