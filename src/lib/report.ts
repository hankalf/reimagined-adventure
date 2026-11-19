import "server-only";
import { db } from "./db";
import { COMMITTED_STATUSES, employeeBudget, isOverBudget, summarizeBudget, type BudgetTotals } from "./budget";
import { toCsv } from "./csv";
import { escapeHtml, emailShell } from "./email";
import { dec, money, fmtDate, SELECTION_STATUS_LABEL } from "./utils";
import { optionDetail, optionKey, optionSummary } from "./options";

export type ReportSummaryRow = {
  itemId: string;
  name: string;
  type: "PRODUCT" | "CUSTOM";
  option1Value: string | null;
  option2Value: string | null;
  /** "Teal / M" */
  optionText: string;
  /** "Color: Teal, Size: M" */
  optionDetail: string;
  quantity: number;
  newQuantity: number;
  unitCost: number | null;
  subtotal: number | null;
  productUrl: string | null;
  asin: string | null;
  sku: string | null;
  fulfillmentNote: string | null;
  byStatus: Record<string, number>;
};

export type ReportDetailRow = {
  selectionId: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  department: string | null;
  itemId: string;
  itemName: string;
  itemType: "PRODUCT" | "CUSTOM";
  option1Value: string | null;
  option2Value: string | null;
  optionText: string;
  optionDetail: string;
  cost: number | null;
  budget: number | null;
  overBudget: boolean;
  status: string;
  confirmationCode: string;
  selectedAt: Date;
  orderedAt: Date | null;
  receivedAt: Date | null;
  collectedAt: Date | null;
  productUrl: string | null;
  language: string;
  isNew: boolean;
};

export type EmployeeBudgetRow = {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  department: string | null;
  budget: number | null;
  cost: number | null;
  remaining: number | null;
  overBudget: boolean;
  itemName: string | null;
  status: string | null;
};

export type ReportData = {
  campaign: {
    id: string;
    slug: string;
    name: string;
    status: string;
    currency: string;
    totalBudget: number | null;
    defaultEmployeeBudget: number | null;
    hrEmails: string[];
    lastHrEmailAt: Date | null;
  };
  generatedAt: Date;
  since: Date | null;
  counts: { eligible: number; picked: number; needsRepick: number; toOrder: number; ordered: number; received: number; collected: number; notPicked: number; newSinceLast: number };
  summary: ReportSummaryRow[];
  detail: ReportDetailRow[];
  budget: BudgetTotals;
  employeeBudgets: EmployeeBudgetRow[];
  notPicked: Array<{ employeeNumber: string; firstName: string; lastName: string; department: string | null }>;
};

export async function eligibleEmployees(campaign: { id: string; allEmployeesEligible: boolean }) {
  if (campaign.allEmployeesEligible) {
    const employees = await db.employee.findMany({ where: { active: true }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] });
    const overrides = await db.campaignEmployee.findMany({ where: { campaignId: campaign.id } });
    const byId = new Map(overrides.map((o) => [o.employeeId, o]));
    return employees.map((e) => ({ employee: e, campaignEmployee: byId.get(e.id) ?? null }));
  }
  const rows = await db.campaignEmployee.findMany({
    where: { campaignId: campaign.id, employee: { active: true } },
    include: { employee: true },
    orderBy: [{ employee: { lastName: "asc" } }, { employee: { firstName: "asc" } }],
  });
  return rows.map((r) => ({ employee: r.employee, campaignEmployee: r }));
}

/** Gather everything the Orders screen, HR email, CSV and Excel exports need for a campaign. */
export async function buildReportData(campaignId: string, opts: { since?: Date | null } = {}): Promise<ReportData> {
  const campaign = await db.campaign.findUniqueOrThrow({ where: { id: campaignId } });
  const since = opts.since ?? null;
  const [eligible, selections] = await Promise.all([
    eligibleEmployees(campaign),
    db.selection.findMany({
      where: { campaignId },
      include: { employee: true, item: true },
      orderBy: [{ employee: { lastName: "asc" } }, { employee: { firstName: "asc" } }],
    }),
  ]);
  const campaignItems = await db.campaignItem.findMany({ where: { campaignId } });
  const overrideByItem = new Map(campaignItems.map((ci) => [ci.itemId, ci]));
  const eligibleById = new Map(eligible.map((e) => [e.employee.id, e]));

  const detail: ReportDetailRow[] = selections.map((s) => {
    const el = eligibleById.get(s.employeeId);
    const budget = employeeBudget(campaign, el?.campaignEmployee ?? null);
    const cost = dec(s.costAtSelection);
    return {
      selectionId: s.id,
      employeeNumber: s.employee.employeeNumber,
      firstName: s.employee.firstName,
      lastName: s.employee.lastName,
      department: s.employee.department,
      itemId: s.itemId,
      itemName: s.item.name,
      itemType: s.item.type,
      option1Value: s.option1Value,
      option2Value: s.option2Value,
      optionText: optionSummary(s),
      optionDetail: optionDetail(s.item, s),
      cost,
      budget,
      overBudget: isOverBudget(cost, budget),
      status: s.status,
      confirmationCode: s.confirmationCode,
      selectedAt: s.selectedAt,
      orderedAt: s.orderedAt,
      receivedAt: s.receivedAt,
      collectedAt: s.collectedAt,
      productUrl: s.item.productUrl,
      language: s.language,
      isNew: since ? s.selectedAt > since : true,
    };
  });

  const summaryMap = new Map<string, ReportSummaryRow>();
  for (const s of selections) {
    if (!COMMITTED_STATUSES.includes(s.status)) continue;
    const key = optionKey(s.itemId, s);
    const cost = dec(s.costAtSelection);
    const row =
      summaryMap.get(key) ??
      ({
        itemId: s.itemId,
        name: s.item.name,
        type: s.item.type,
        option1Value: s.option1Value,
        option2Value: s.option2Value,
        optionText: optionSummary(s),
        optionDetail: optionDetail(s.item, s),
        quantity: 0,
        newQuantity: 0,
        unitCost: cost ?? dec(overrideByItem.get(s.itemId)?.unitCostOverride) ?? dec(s.item.unitCost),
        subtotal: 0,
        productUrl: s.item.productUrl,
        asin: s.item.asin,
        sku: s.item.sku,
        fulfillmentNote: s.item.fulfillmentNote,
        byStatus: {},
      } satisfies ReportSummaryRow);
    row.quantity += 1;
    if (!since || s.selectedAt > since) row.newQuantity += 1;
    row.byStatus[s.status] = (row.byStatus[s.status] ?? 0) + 1;
    if (cost === null) row.subtotal = row.subtotal === null ? null : row.quantity === 1 ? null : row.subtotal;
    else if (row.subtotal !== null) row.subtotal = Math.round((row.subtotal + cost) * 100) / 100;
    summaryMap.set(key, row);
  }
  const summary = [...summaryMap.values()].sort((a, b) => (a.type === b.type ? b.quantity - a.quantity || a.name.localeCompare(b.name) : a.type === "PRODUCT" ? -1 : 1));

  const pickedIds = new Set(selections.filter((s) => COMMITTED_STATUSES.includes(s.status)).map((s) => s.employeeId));
  const repickIds = new Set(selections.filter((s) => s.status === "NEEDS_REPICK").map((s) => s.employeeId));
  const notPicked = eligible
    .filter((e) => !pickedIds.has(e.employee.id))
    .map((e) => ({ employeeNumber: e.employee.employeeNumber, firstName: e.employee.firstName, lastName: e.employee.lastName, department: e.employee.department }));

  const selectionByEmployee = new Map(selections.map((s) => [s.employeeId, s]));
  const employeeBudgets: EmployeeBudgetRow[] = eligible.map((e) => {
    const sel = selectionByEmployee.get(e.employee.id);
    const budget = employeeBudget(campaign, e.campaignEmployee);
    const cost = sel && COMMITTED_STATUSES.includes(sel.status) ? dec(sel.costAtSelection) : null;
    return {
      employeeNumber: e.employee.employeeNumber,
      firstName: e.employee.firstName,
      lastName: e.employee.lastName,
      department: e.employee.department,
      budget,
      cost,
      remaining: budget !== null && cost !== null ? Math.round((budget - cost) * 100) / 100 : null,
      overBudget: isOverBudget(cost, budget),
      itemName: sel ? sel.item.name : null,
      status: sel ? sel.status : null,
    };
  });

  const count = (status: string) => selections.filter((s) => s.status === status).length;
  const budget = summarizeBudget(selections, campaign.totalBudget);
  return {
    campaign: {
      id: campaign.id,
      slug: campaign.slug,
      name: campaign.name,
      status: campaign.status,
      currency: campaign.currency,
      totalBudget: dec(campaign.totalBudget),
      defaultEmployeeBudget: dec(campaign.defaultEmployeeBudget),
      hrEmails: campaign.hrEmails,
      lastHrEmailAt: campaign.lastHrEmailAt,
    },
    generatedAt: new Date(),
    since,
    counts: {
      eligible: eligible.length,
      picked: pickedIds.size,
      needsRepick: repickIds.size,
      toOrder: count("SELECTED"),
      ordered: count("ORDERED"),
      received: count("RECEIVED"),
      collected: count("COLLECTED"),
      notPicked: notPicked.length,
      newSinceLast: detail.filter((d) => d.isNew && d.status !== "NEEDS_REPICK").length,
    },
    summary,
    detail,
    budget,
    employeeBudgets,
    notPicked,
  };
}

// ---------- CSV ----------

export function summaryCsv(data: ReportData, onlyNew = false): string {
  const rows = data.summary.filter((r) => !onlyNew || r.newQuantity > 0);
  return toCsv([
    ["Item", "Type", "Options", "Quantity", onlyNew ? "New since last email" : "New", "Unit cost", "Subtotal", "Amazon / product link", "ASIN", "SKU", "Fulfilment note", "To order", "Ordered", "Received", "Collected"],
    ...rows.map((r) => [
      r.name, r.type === "CUSTOM" ? "Custom" : "Product", r.optionDetail, onlyNew ? r.newQuantity : r.quantity, r.newQuantity, r.unitCost ?? "", r.subtotal ?? "", r.productUrl ?? "", r.asin ?? "", r.sku ?? "", r.fulfillmentNote ?? "",
      r.byStatus.SELECTED ?? 0, r.byStatus.ORDERED ?? 0, r.byStatus.RECEIVED ?? 0, r.byStatus.COLLECTED ?? 0,
    ]),
  ]);
}

export function detailCsv(data: ReportData, onlyNew = false): string {
  const rows = data.detail.filter((r) => !onlyNew || r.isNew);
  return toCsv([
    ["Employee number", "First name", "Last name", "Department", "Gift", "Type", "Options", "Cost", "Budget", "Over budget", "Status", "Confirmation code", "Selected at", "Ordered at", "Received at", "Collected at", "Product link", "Language"],
    ...rows.map((r) => [
      r.employeeNumber, r.firstName, r.lastName, r.department ?? "", r.itemName, r.itemType === "CUSTOM" ? "Custom" : "Product", r.optionDetail, r.cost ?? "", r.budget ?? "", r.overBudget ? "Yes" : "", SELECTION_STATUS_LABEL[r.status] ?? r.status, r.confirmationCode,
      r.selectedAt.toISOString(), r.orderedAt?.toISOString() ?? "", r.receivedAt?.toISOString() ?? "", r.collectedAt?.toISOString() ?? "", r.productUrl ?? "", r.language,
    ]),
  ]);
}

export function notPickedCsv(data: ReportData): string {
  return toCsv([["Employee number", "First name", "Last name", "Department"], ...data.notPicked.map((r) => [r.employeeNumber, r.firstName, r.lastName, r.department ?? ""])]);
}

export function budgetCsv(data: ReportData): string {
  return toCsv([
    ["Employee number", "First name", "Last name", "Department", "Budget", "Gift", "Cost", "Remaining", "Over budget", "Status"],
    ...data.employeeBudgets.map((r) => [r.employeeNumber, r.firstName, r.lastName, r.department ?? "", r.budget ?? "", r.itemName ?? "", r.cost ?? "", r.remaining ?? "", r.overBudget ? "Yes" : "", r.status ? SELECTION_STATUS_LABEL[r.status] ?? r.status : "Not picked"]),
  ]);
}

// ---------- HR email HTML ----------

const td = (v: string | number, align: "left" | "right" = "left") => `<td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:${align};font-size:13px">${typeof v === "number" ? v : v}</td>`;
const th = (v: string, align: "left" | "right" = "left") => `<th style="padding:6px 8px;border-bottom:2px solid #d1d5db;text-align:${align};font-size:12px;color:#374151;text-transform:uppercase;letter-spacing:.03em">${escapeHtml(v)}</th>`;

export function renderHrEmail(data: ReportData, opts: { appUrl: string; onlyNew: boolean }): { subject: string; html: string } {
  const cur = data.campaign.currency;
  const summary = data.summary.filter((r) => !opts.onlyNew || r.newQuantity > 0);
  const products = summary.filter((r) => r.type === "PRODUCT");
  const customs = summary.filter((r) => r.type === "CUSTOM");
  const detail = data.detail.filter((r) => r.status !== "NEEDS_REPICK" && (!opts.onlyNew || r.isNew));
  const qty = (r: ReportSummaryRow) => (opts.onlyNew ? r.newQuantity : r.quantity);
  const total = summary.reduce((acc, r) => acc + (r.unitCost !== null ? r.unitCost * qty(r) : 0), 0);
  const ordersUrl = `${opts.appUrl}/admin/campaigns/${data.campaign.id}/orders`;

  const subject = opts.onlyNew
    ? `Gift orders: ${data.campaign.name} — ${detail.length} new selection${detail.length === 1 ? "" : "s"}`
    : `Gift orders: ${data.campaign.name} — ${data.counts.picked} selection${data.counts.picked === 1 ? "" : "s"} to date`;

  const statsHtml = `
<table style="border-collapse:collapse;margin:0 0 20px"><tr>
${[
  ["Eligible", data.counts.eligible],
  ["Picked", data.counts.picked],
  ["Not picked", data.counts.notPicked],
  ["To order", data.counts.toOrder],
  ["Ordered", data.counts.ordered],
  ["Received", data.counts.received],
  ["Collected", data.counts.collected],
  ["Need re-pick", data.counts.needsRepick],
]
  .map(([label, n]) => `<td style="padding:8px 14px;background:#f9fafb;border:1px solid #e5e7eb;text-align:center"><div style="font-size:20px;font-weight:700">${n}</div><div style="font-size:11px;color:#6b7280;text-transform:uppercase">${label}</div></td>`)
  .join("")}
</tr></table>`;

  const budgetLine = data.budget.totalBudget !== null
    ? `<p style="margin:0 0 18px;font-size:14px">Budget: <strong>${money(data.budget.committed, cur)}</strong> committed of <strong>${money(data.budget.totalBudget, cur)}</strong> (${money(data.budget.remaining, cur)} remaining). Ordered so far: ${money(data.budget.ordered, cur)}.</p>`
    : `<p style="margin:0 0 18px;font-size:14px">Committed spend: <strong>${money(data.budget.committed, cur)}</strong>. Ordered so far: ${money(data.budget.ordered, cur)}.</p>`;

  const productTable = products.length === 0
    ? `<p style="font-size:14px;color:#6b7280">No product orders${opts.onlyNew ? " since the last email" : ""}.</p>`
    : `<table style="border-collapse:collapse;width:100%;margin-bottom:24px"><thead><tr>${th("Item")}${th("Options")}${th("Qty", "right")}${th("Unit cost", "right")}${th("Subtotal", "right")}${th("Link")}</tr></thead><tbody>
${products
  .map(
    (r) => `<tr>${td(escapeHtml(r.name))}${td(escapeHtml(r.optionDetail || "—"))}${td(qty(r), "right")}${td(money(r.unitCost, cur), "right")}${td(r.unitCost !== null ? money(r.unitCost * qty(r), cur) : "—", "right")}${td(r.productUrl ? `<a href="${escapeHtml(r.productUrl)}" style="color:#1d4ed8">Open${r.asin ? ` (${escapeHtml(r.asin)})` : ""}</a>` : "—")}</tr>`,
  )
  .join("")}
<tr>${td("<strong>Total</strong>")}${td("")}${td(`<strong>${products.reduce((a, r) => a + qty(r), 0)}</strong>`, "right")}${td("")}${td(`<strong>${money(products.reduce((a, r) => a + (r.unitCost ?? 0) * qty(r), 0), cur)}</strong>`, "right")}${td("")}</tr>
</tbody></table>`;

  const customTable = customs.length === 0
    ? ""
    : `<h2 style="font-size:16px;margin:8px 0 10px">Custom gifts to fulfil internally</h2>
<table style="border-collapse:collapse;width:100%;margin-bottom:24px"><thead><tr>${th("Gift")}${th("Options")}${th("Qty", "right")}${th("Internal cost", "right")}${th("How to fulfil")}</tr></thead><tbody>
${customs.map((r) => `<tr>${td(escapeHtml(r.name))}${td(escapeHtml(r.optionDetail || "—"))}${td(qty(r), "right")}${td(money(r.unitCost, cur), "right")}${td(escapeHtml(r.fulfillmentNote ?? "—"))}</tr>`).join("")}
</tbody></table>`;

  const detailRows = detail.slice(0, 400);
  const detailTable = `<h2 style="font-size:16px;margin:8px 0 10px">Per employee${opts.onlyNew ? " (new)" : ""}</h2>
<table style="border-collapse:collapse;width:100%"><thead><tr>${th("Employee #")}${th("Name")}${th("Dept")}${th("Gift")}${th("Options")}${th("Cost", "right")}${th("Status")}${th("Code")}</tr></thead><tbody>
${detailRows
  .map(
    (r) => `<tr>${td(escapeHtml(r.employeeNumber))}${td(escapeHtml(`${r.firstName} ${r.lastName}`.trim()))}${td(escapeHtml(r.department ?? ""))}${td(escapeHtml(r.itemName))}${td(escapeHtml(r.optionText || "—"))}${td(money(r.cost, cur), "right")}${td(SELECTION_STATUS_LABEL[r.status] ?? r.status)}${td(r.confirmationCode)}</tr>`,
  )
  .join("")}
</tbody></table>
${detail.length > detailRows.length ? `<p style="font-size:12px;color:#6b7280">Showing ${detailRows.length} of ${detail.length} rows. The attached spreadsheet has the full list.</p>` : ""}`;

  const html = emailShell(
    `${data.campaign.name}: gift orders`,
    `<p style="margin:0 0 14px;font-size:14px">Generated ${fmtDate(data.generatedAt, true)}${opts.onlyNew && data.since ? `, showing selections since ${fmtDate(data.since, true)}` : ""}. Grand total for this list: <strong>${money(total, cur)}</strong>.</p>
${statsHtml}
${budgetLine}
<h2 style="font-size:16px;margin:8px 0 10px">Items to order</h2>
${productTable}
${customTable}
${detailTable}
<p style="margin-top:24px;font-size:14px"><a href="${ordersUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Open the orders list to mark items ordered</a></p>
<p style="font-size:13px;color:#6b7280">Attached: orders.xlsx (Summary, Detail, Budget, Not picked), orders-summary.csv, orders-detail.csv.</p>`,
  );
  return { subject, html };
}
