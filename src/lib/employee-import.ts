import "server-only";
import ExcelJS from "exceljs";
import { mapEmployeeRows, parseEmployeeCsv, TEMPLATE_EXAMPLE_PEOPLE, toCsv, type EmployeeCsvResult } from "./csv";

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if ("richText" in value) return value.richText.map((t) => t.text).join("");
    if ("text" in value) return String(value.text ?? "");
    if ("result" in value) return String(value.result ?? "");
    return String(value);
  }
  return String(value);
}

/** Read an employee upload: .xlsx (sheet "Employees", else the first sheet) or .csv. */
export async function parseEmployeeFile(buffer: Buffer, filename: string): Promise<EmployeeCsvResult> {
  const lower = filename.toLowerCase();
  if (!lower.endsWith(".xlsx")) return parseEmployeeCsv(buffer.toString("utf8"));
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    return { rows: [], errors: ["Could not read the Excel file. Save it as .xlsx (Excel Workbook) or upload a .csv."], skipped: 0 };
  }
  const sheet = wb.worksheets.find((w) => w.name.trim().toLowerCase() === "employees") ?? wb.worksheets[0];
  if (!sheet) return { rows: [], errors: ["The workbook has no sheets."], skipped: 0 };
  const table: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as ExcelJS.CellValue[]; // 1-based
    table.push(values.slice(1).map(cellText));
  });
  return mapEmployeeRows(table);
}

// ---------- templates ----------

export type EmployeeTemplateLayout = "simple" | "full";

const SIMPLE = {
  headers: ["Employee #", "Name (Last, First)"],
  examples: TEMPLATE_EXAMPLE_PEOPLE.map((p) => [p.employeeNumber, `${p.lastName}, ${p.firstName}`]),
  widths: [16, 36],
  instructions: [
    "One row per employee. Only two columns are needed.",
    "Employee #: exactly as on their badge. The column is formatted as text so leading zeros (00123) are kept.",
    "Name: write it Last, First. Two last names are fine: García López, María.",
    "The grey example rows are ignored on upload, but it's tidier to replace them.",
    "Employees sign in with their employee number and either last name, both last names, or their full name.",
    "Upload it on Admin → Employees (master list) or a campaign's Employees tab (that campaign only).",
  ],
};

const FULL = {
  headers: ["employee_number", "first_name", "last_name", "second_last_name", "department", "email", "budget"],
  examples: [
    ["10001", "María", "García", "López", "Operations", "maria.garcia@example.com", ""],
    ["10002", "James", "Smith", "", "Finance", "", "150"],
    ["00123", "Ana", "de la Cruz", "", "Warehouse", "", ""],
  ],
  widths: [16, 16, 18, 18, 18, 30, 10],
  instructions: [
    "One row per employee. Required: employee_number and last_name (or a single Name column written Last, First).",
    "employee_number: exactly as on their badge; formatted as text so leading zeros are kept.",
    "The grey example rows are ignored on upload, but it's tidier to replace them.",
    "last_name / second_last_name: put the second surname in its own column or together in last_name (García López). Either works.",
    "department: used for the reminders-by-department export.",
    "email: optional; only used for “your gift is ready” emails when SMTP is configured.",
    "budget: optional; only used when you upload on a campaign's Employees tab (per-person gift budget for that campaign).",
    "Employees sign in with their employee number and either last name, both last names, or their full name.",
  ],
};

export function employeeTemplateRows(layout: EmployeeTemplateLayout): string[][] {
  const t = layout === "simple" ? SIMPLE : FULL;
  return [t.headers, ...t.examples];
}

export function employeeTemplateCsv(layout: EmployeeTemplateLayout): string {
  return toCsv(employeeTemplateRows(layout));
}

export async function buildEmployeeTemplateWorkbook(layout: EmployeeTemplateLayout): Promise<Buffer> {
  const t = layout === "simple" ? SIMPLE : FULL;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Employee Gift Portal";
  const ws = wb.addWorksheet("Employees");
  ws.addRow(t.headers);
  for (const ex of t.examples) ws.addRow(ex);
  t.widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  // Employee numbers as text so Excel keeps leading zeros; pre-format extra rows too.
  ws.getColumn(1).numFmt = "@";
  for (let r = 2; r <= t.examples.length + 1; r += 1) ws.getRow(r).font = { italic: true, color: { argb: "FF6B7280" } };
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const info = wb.addWorksheet("Instructions");
  info.addRow(["How to fill in the employee list"]).font = { bold: true, size: 14 };
  info.addRow(["Replace the grey example rows on the Employees sheet with your people, then upload the file (Excel or CSV)."]);
  info.addRow([]);
  for (const line of t.instructions) info.addRow([`• ${line}`]);
  info.getColumn(1).width = 120;

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}

// ---------- export of the current employee list ----------

export type EmployeeExportRow = {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  department: string | null;
  email: string | null;
  active: boolean;
  giftsChosen: number;
  createdAt: Date;
};

/** Search filter shared by the Employees page and its export, so "what you see" is "what you export". */
export function employeeListWhere(opts: { q?: string; includeInactive?: boolean }) {
  const q = opts.q?.trim() ?? "";
  return {
    ...(opts.includeInactive ? {} : { active: true }),
    ...(q
      ? {
          OR: [
            { employeeNumber: { contains: q, mode: "insensitive" as const } },
            { firstName: { contains: q, mode: "insensitive" as const } },
            { lastName: { contains: q, mode: "insensitive" as const } },
            { department: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
}

/**
 * Current employees as an Excel workbook in the upload layout (employee_number, first_name, last_name,
 * department, email), so it can be edited and uploaded back. Status, gift count and date added are extra
 * columns the importer ignores.
 */
export async function buildEmployeeListWorkbook(employees: EmployeeExportRow[], opts: { filter?: string } = {}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Employee Gift Portal";
  wb.created = new Date();
  const ws = wb.addWorksheet("Employees");
  ws.columns = [
    { header: "employee_number", key: "num", width: 16, style: { numFmt: "@" } },
    { header: "first_name", key: "first", width: 16 },
    { header: "last_name", key: "last", width: 22 },
    { header: "department", key: "dept", width: 18 },
    { header: "email", key: "email", width: 30 },
    { header: "status", key: "status", width: 10 },
    { header: "gifts_chosen", key: "gifts", width: 12 },
    { header: "added", key: "added", width: 12, style: { numFmt: "yyyy-mm-dd" } },
  ];
  for (const e of employees) {
    ws.addRow({
      num: e.employeeNumber,
      first: e.firstName,
      last: e.lastName,
      dept: e.department ?? "",
      email: e.email ?? "",
      status: e.active ? "Active" : "Inactive",
      gifts: e.giftsChosen,
      added: e.createdAt,
    });
  }
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 8 } };

  const info = wb.addWorksheet("Info");
  info.addRow(["Exported", new Date()]).getCell(2).numFmt = "yyyy-mm-dd hh:mm";
  info.addRow(["Employees", employees.length]);
  info.addRow(["Filter", opts.filter || "All active employees"]);
  info.addRow([]);
  info.addRow(["To update names, departments or emails: edit the Employees sheet and upload this file on Admin → Employees."]);
  info.addRow(["Employees in an uploaded file are marked active; the status, gifts_chosen and added columns are ignored on upload."]);
  info.getColumn(1).width = 14;
  info.getColumn(2).width = 40;

  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}
