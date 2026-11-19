import "server-only";
import ExcelJS from "exceljs";
import type { ReportData } from "./report";
import { SELECTION_STATUS_LABEL } from "./utils";

function currencyFormat(currency: string): string {
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : `${currency} `;
  return `"${symbol}"#,##0.00`;
}

function styleHeader(sheet: ExcelJS.Worksheet) {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
  header.alignment = { vertical: "middle" };
  header.height = 20;
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  if (sheet.columnCount > 0 && sheet.rowCount > 0) {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columnCount } };
  }
}

/** Build the HR workbook: Summary, Custom gifts, Detail, Budget, Not picked and Info sheets. */
export async function buildOrdersWorkbook(data: ReportData, opts: { onlyNew?: boolean } = {}): Promise<Buffer> {
  const onlyNew = opts.onlyNew ?? false;
  const fmt = currencyFormat(data.campaign.currency);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Employee Gift Portal";
  wb.created = data.generatedAt;

  // Summary (grouped by item + option)
  const summary = wb.addWorksheet("Summary");
  summary.columns = [
    { header: "Item", key: "name", width: 40 },
    { header: "Type", key: "type", width: 10 },
    { header: "Options", key: "option", width: 24 },
    { header: onlyNew ? "New qty" : "Quantity", key: "qty", width: 10 },
    { header: "Unit cost", key: "unit", width: 12, style: { numFmt: fmt } },
    { header: "Subtotal", key: "subtotal", width: 12, style: { numFmt: fmt } },
    { header: "To order", key: "toOrder", width: 10 },
    { header: "Ordered", key: "ordered", width: 10 },
    { header: "Received", key: "received", width: 10 },
    { header: "Collected", key: "collected", width: 10 },
    { header: "ASIN", key: "asin", width: 13 },
    { header: "SKU", key: "sku", width: 14 },
    { header: "Product link", key: "link", width: 44 },
    { header: "Fulfilment note", key: "note", width: 40 },
  ];
  for (const r of data.summary) {
    if (onlyNew && r.newQuantity === 0) continue;
    const qty = onlyNew ? r.newQuantity : r.quantity;
    const row = summary.addRow({
      name: r.name,
      type: r.type === "CUSTOM" ? "Custom" : "Product",
      option: r.optionDetail,
      qty,
      unit: r.unitCost ?? null,
      subtotal: r.unitCost !== null ? Math.round(r.unitCost * qty * 100) / 100 : null,
      toOrder: r.byStatus.SELECTED ?? 0,
      ordered: r.byStatus.ORDERED ?? 0,
      received: r.byStatus.RECEIVED ?? 0,
      collected: r.byStatus.COLLECTED ?? 0,
      asin: r.asin ?? "",
      sku: r.sku ?? "",
      link: r.productUrl ?? "",
      note: r.fulfillmentNote ?? "",
    });
    if (r.productUrl) row.getCell("link").value = { text: r.productUrl, hyperlink: r.productUrl };
  }
  const totalRow = summary.addRow({
    name: "TOTAL",
    qty: { formula: `SUM(D2:D${Math.max(2, summary.rowCount)})` },
    subtotal: { formula: `SUM(F2:F${Math.max(2, summary.rowCount)})` },
  });
  totalRow.font = { bold: true };
  styleHeader(summary);

  // Detail (one row per employee)
  const detail = wb.addWorksheet("Detail");
  detail.columns = [
    { header: "Employee number", key: "num", width: 16 },
    { header: "First name", key: "first", width: 16 },
    { header: "Last name", key: "last", width: 18 },
    { header: "Department", key: "dept", width: 18 },
    { header: "Gift", key: "item", width: 40 },
    { header: "Type", key: "type", width: 10 },
    { header: "Options", key: "option", width: 24 },
    { header: "Cost", key: "cost", width: 12, style: { numFmt: fmt } },
    { header: "Budget", key: "budget", width: 12, style: { numFmt: fmt } },
    { header: "Over budget", key: "over", width: 12 },
    { header: "Status", key: "status", width: 14 },
    { header: "Confirmation", key: "code", width: 13 },
    { header: "Selected at", key: "selectedAt", width: 20, style: { numFmt: "yyyy-mm-dd hh:mm" } },
    { header: "Ordered at", key: "orderedAt", width: 20, style: { numFmt: "yyyy-mm-dd hh:mm" } },
    { header: "Received at", key: "receivedAt", width: 20, style: { numFmt: "yyyy-mm-dd hh:mm" } },
    { header: "Collected at", key: "collectedAt", width: 20, style: { numFmt: "yyyy-mm-dd hh:mm" } },
    { header: "Product link", key: "link", width: 44 },
    { header: "Language", key: "lang", width: 10 },
    { header: "New since last email", key: "isNew", width: 12 },
  ];
  for (const r of data.detail) {
    if (onlyNew && !r.isNew) continue;
    const row = detail.addRow({
      num: r.employeeNumber,
      first: r.firstName,
      last: r.lastName,
      dept: r.department ?? "",
      item: r.itemName,
      type: r.itemType === "CUSTOM" ? "Custom" : "Product",
      option: r.optionDetail,
      cost: r.cost,
      budget: r.budget,
      over: r.overBudget ? "Yes" : "",
      status: SELECTION_STATUS_LABEL[r.status] ?? r.status,
      code: r.confirmationCode,
      selectedAt: r.selectedAt,
      orderedAt: r.orderedAt,
      receivedAt: r.receivedAt,
      collectedAt: r.collectedAt,
      link: r.productUrl ?? "",
      lang: r.language,
      isNew: r.isNew ? "Yes" : "",
    });
    if (r.productUrl) row.getCell("link").value = { text: r.productUrl, hyperlink: r.productUrl };
  }
  styleHeader(detail);

  // Budget
  const budget = wb.addWorksheet("Budget");
  budget.addRow(["Campaign", data.campaign.name]);
  budget.addRow(["Total budget", data.budget.totalBudget]).getCell(2).numFmt = fmt;
  budget.addRow(["Committed", data.budget.committed]).getCell(2).numFmt = fmt;
  budget.addRow(["Ordered", data.budget.ordered]).getCell(2).numFmt = fmt;
  budget.addRow(["Remaining", data.budget.remaining]).getCell(2).numFmt = fmt;
  budget.addRow(["Selections counted", data.budget.committedCount]);
  budget.addRow(["Selections without a price", data.budget.unpricedCount]);
  budget.addRow([]);
  const headerRowIndex = budget.rowCount + 1;
  budget.addRow(["Employee number", "First name", "Last name", "Department", "Budget", "Gift", "Cost", "Remaining", "Over budget", "Status"]);
  for (const r of data.employeeBudgets) {
    const row = budget.addRow([r.employeeNumber, r.firstName, r.lastName, r.department ?? "", r.budget, r.itemName ?? "", r.cost, r.remaining, r.overBudget ? "Yes" : "", r.status ? SELECTION_STATUS_LABEL[r.status] ?? r.status : "Not picked"]);
    row.getCell(5).numFmt = fmt;
    row.getCell(7).numFmt = fmt;
    row.getCell(8).numFmt = fmt;
  }
  budget.getRow(headerRowIndex).font = { bold: true };
  budget.columns.forEach((c, i) => (c.width = [16, 16, 18, 18, 12, 40, 12, 12, 12, 14][i] ?? 14));
  budget.getColumn(1).width = 26;

  // Not picked
  const notPicked = wb.addWorksheet("Not picked");
  notPicked.columns = [
    { header: "Employee number", key: "num", width: 16 },
    { header: "First name", key: "first", width: 16 },
    { header: "Last name", key: "last", width: 18 },
    { header: "Department", key: "dept", width: 18 },
  ];
  for (const r of data.notPicked) notPicked.addRow({ num: r.employeeNumber, first: r.firstName, last: r.lastName, dept: r.department ?? "" });
  styleHeader(notPicked);

  // Info
  const info = wb.addWorksheet("Info");
  info.addRow(["Generated", data.generatedAt]);
  info.addRow(["Campaign", data.campaign.name]);
  info.addRow(["Status", data.campaign.status]);
  info.addRow(["Eligible employees", data.counts.eligible]);
  info.addRow(["Picked", data.counts.picked]);
  info.addRow(["Not picked", data.counts.notPicked]);
  info.addRow(["To order", data.counts.toOrder]);
  info.addRow(["Ordered", data.counts.ordered]);
  info.addRow(["Received", data.counts.received]);
  info.addRow(["Collected", data.counts.collected]);
  info.addRow(["Need re-pick", data.counts.needsRepick]);
  if (data.since) info.addRow(["Only new since", data.since]);
  info.getColumn(1).width = 22;
  info.getColumn(2).width = 30;
  info.getCell("B1").numFmt = "yyyy-mm-dd hh:mm";

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}

/** One workbook with every campaign's selections (Orders sheet) plus a per-campaign Summary sheet. */
export async function buildAllOrdersWorkbook(reports: ReportData[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Employee Gift Portal";
  const orders = wb.addWorksheet("Orders");
  orders.columns = [
    { header: "Campaign", key: "campaign", width: 24 },
    { header: "Employee number", key: "num", width: 16 },
    { header: "First name", key: "first", width: 16 },
    { header: "Last name", key: "last", width: 18 },
    { header: "Department", key: "dept", width: 18 },
    { header: "Gift", key: "item", width: 40 },
    { header: "Type", key: "type", width: 10 },
    { header: "Options", key: "option", width: 24 },
    { header: "Cost", key: "cost", width: 12, style: { numFmt: currencyFormat(reports[0]?.campaign.currency ?? "USD") } },
    { header: "Status", key: "status", width: 14 },
    { header: "Confirmation", key: "code", width: 13 },
    { header: "Selected at", key: "selectedAt", width: 20, style: { numFmt: "yyyy-mm-dd hh:mm" } },
    { header: "Ordered at", key: "orderedAt", width: 20, style: { numFmt: "yyyy-mm-dd hh:mm" } },
    { header: "Received at", key: "receivedAt", width: 20, style: { numFmt: "yyyy-mm-dd hh:mm" } },
    { header: "Collected at", key: "collectedAt", width: 20, style: { numFmt: "yyyy-mm-dd hh:mm" } },
    { header: "Product link", key: "link", width: 44 },
  ];
  for (const data of reports) {
    for (const r of data.detail) {
      const row = orders.addRow({
        campaign: data.campaign.name,
        num: r.employeeNumber,
        first: r.firstName,
        last: r.lastName,
        dept: r.department ?? "",
        item: r.itemName,
        type: r.itemType === "CUSTOM" ? "Custom" : "Product",
        option: r.optionDetail,
        cost: r.cost,
        status: SELECTION_STATUS_LABEL[r.status] ?? r.status,
        code: r.confirmationCode,
        selectedAt: r.selectedAt,
        orderedAt: r.orderedAt,
        receivedAt: r.receivedAt,
        collectedAt: r.collectedAt,
        link: r.productUrl ?? "",
      });
      if (r.productUrl) row.getCell("link").value = { text: r.productUrl, hyperlink: r.productUrl };
    }
  }
  styleHeader(orders);

  const summary = wb.addWorksheet("Summary");
  summary.columns = [
    { header: "Campaign", key: "campaign", width: 24 },
    { header: "Item", key: "name", width: 40 },
    { header: "Type", key: "type", width: 10 },
    { header: "Options", key: "option", width: 24 },
    { header: "Quantity", key: "qty", width: 10 },
    { header: "Unit cost", key: "unit", width: 12 },
    { header: "Subtotal", key: "subtotal", width: 12 },
    { header: "To order", key: "toOrder", width: 10 },
    { header: "Ordered", key: "ordered", width: 10 },
    { header: "Received", key: "received", width: 10 },
    { header: "Collected", key: "collected", width: 10 },
    { header: "ASIN", key: "asin", width: 13 },
    { header: "Product link", key: "link", width: 44 },
  ];
  for (const data of reports) {
    for (const r of data.summary) {
      summary.addRow({
        campaign: data.campaign.name,
        name: r.name,
        type: r.type === "CUSTOM" ? "Custom" : "Product",
        option: r.optionDetail,
        qty: r.quantity,
        unit: r.unitCost,
        subtotal: r.subtotal,
        toOrder: r.byStatus.SELECTED ?? 0,
        ordered: r.byStatus.ORDERED ?? 0,
        received: r.byStatus.RECEIVED ?? 0,
        collected: r.byStatus.COLLECTED ?? 0,
        asin: r.asin ?? "",
        link: r.productUrl ?? "",
      });
    }
  }
  styleHeader(summary);
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}

function sheetName(raw: string, used: Set<string>): string {
  const name = raw.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 28) || "Other";
  let candidate = name;
  let n = 2;
  while (used.has(candidate.toLowerCase())) candidate = `${name.slice(0, 25)} ${n++}`;
  used.add(candidate.toLowerCase());
  return candidate;
}

/** Reminder workbook: employees who haven't picked, one sheet per department plus an "All" sheet. */
export async function buildNotPickedByDepartmentWorkbook(data: ReportData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Employee Gift Portal";
  const columns = [
    { header: "Employee number", key: "num", width: 16 },
    { header: "First name", key: "first", width: 16 },
    { header: "Last name", key: "last", width: 18 },
    { header: "Department", key: "dept", width: 18 },
  ];
  const all = wb.addWorksheet("All");
  all.columns = columns;
  for (const r of data.notPicked) all.addRow({ num: r.employeeNumber, first: r.firstName, last: r.lastName, dept: r.department ?? "" });
  styleHeader(all);
  const used = new Set<string>(["all"]);
  const byDept = new Map<string, typeof data.notPicked>();
  for (const r of data.notPicked) {
    const key = r.department?.trim() || "No department";
    byDept.set(key, [...(byDept.get(key) ?? []), r]);
  }
  for (const [dept, rows] of [...byDept.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const ws = wb.addWorksheet(sheetName(dept, used));
    ws.columns = columns;
    for (const r of rows) ws.addRow({ num: r.employeeNumber, first: r.firstName, last: r.lastName, dept: r.department ?? "" });
    styleHeader(ws);
  }
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}
