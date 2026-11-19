import Papa from "papaparse";

export type EmployeeCsvRow = {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  department: string | null;
  budget: number | null;
};

export type EmployeeCsvResult = {
  rows: EmployeeCsvRow[];
  errors: string[];
  skipped: number;
};

const HEADER_ALIASES: Record<keyof EmployeeCsvRow | "fullName", string[]> = {
  employeeNumber: ["employee_number", "employeenumber", "employee number", "employee no", "employee #", "emp no", "emp #", "emp number", "empno", "employee id", "employee_id", "employeeid", "emp id", "id", "number", "badge", "badge number", "clock number", "clock no"],
  firstName: ["first_name", "firstname", "first name", "first", "given name", "given_name", "nombre"],
  lastName: ["last_name", "lastname", "last name", "last", "surname", "family name", "family_name", "apellido"],
  fullName: ["name", "full name", "full_name", "fullname", "employee name", "employee_name"],
  department: ["department", "dept", "team", "location", "site", "departamento"],
  budget: ["budget", "gift budget", "gift_budget", "amount", "allowance", "tier", "presupuesto"],
};

function normalizeHeader(h: string): string {
  return h
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");
}

function findColumn(headers: string[], aliases: string[]): number {
  const normalizedAliases = aliases.map(normalizeHeader);
  for (let i = 0; i < headers.length; i += 1) {
    if (normalizedAliases.includes(normalizeHeader(headers[i] ?? ""))) return i;
  }
  return -1;
}

export function parseEmployeeCsv(text: string): EmployeeCsvResult {
  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), {
    skipEmptyLines: "greedy",
    delimiter: "",
  });
  const errors: string[] = [];
  for (const e of parsed.errors.slice(0, 5)) errors.push(`Row ${e.row ?? "?"}: ${e.message}`);

  const data = parsed.data.filter((r) => Array.isArray(r) && r.some((c) => String(c ?? "").trim() !== ""));
  if (data.length === 0) return { rows: [], errors: ["The file is empty."], skipped: 0 };

  const headers = (data[0] ?? []).map((h) => String(h ?? ""));
  const colNumber = findColumn(headers, HEADER_ALIASES.employeeNumber);
  const colFirst = findColumn(headers, HEADER_ALIASES.firstName);
  const colLast = findColumn(headers, HEADER_ALIASES.lastName);
  const colFull = findColumn(headers, HEADER_ALIASES.fullName);
  const colDept = findColumn(headers, HEADER_ALIASES.department);
  const colBudget = findColumn(headers, HEADER_ALIASES.budget);

  if (colNumber === -1) {
    errors.push(
      `Could not find an employee number column. Use a header such as "employee_number". Found headers: ${headers.join(", ")}`,
    );
    return { rows: [], errors, skipped: 0 };
  }
  if (colLast === -1 && colFull === -1) {
    errors.push(`Could not find a last name column. Use "first_name" and "last_name" headers, or a single "name" column.`);
    return { rows: [], errors, skipped: 0 };
  }

  const rows: EmployeeCsvRow[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (let i = 1; i < data.length; i += 1) {
    const r = data[i] ?? [];
    const cell = (idx: number) => (idx >= 0 ? String(r[idx] ?? "").trim() : "");
    const employeeNumber = normalizeEmployeeNumber(cell(colNumber));
    if (!employeeNumber) {
      skipped += 1;
      continue;
    }
    let firstName = cell(colFirst);
    let lastName = cell(colLast);
    if (!lastName && colFull >= 0) {
      const full = cell(colFull);
      if (full.includes(",")) {
        const [last, first] = full.split(",").map((s) => s.trim());
        lastName = last ?? "";
        firstName = firstName || (first ?? "");
      } else {
        const parts = full.split(/\s+/).filter(Boolean);
        lastName = parts.length > 1 ? parts.slice(1).join(" ") : (parts[0] ?? "");
        firstName = firstName || (parts.length > 1 ? parts[0] ?? "" : "");
      }
    }
    if (!lastName) {
      errors.push(`Row ${i + 1}: missing last name for employee ${employeeNumber}.`);
      skipped += 1;
      continue;
    }
    if (seen.has(employeeNumber)) {
      errors.push(`Row ${i + 1}: duplicate employee number ${employeeNumber} (later row ignored).`);
      skipped += 1;
      continue;
    }
    seen.add(employeeNumber);
    const budgetRaw = cell(colBudget).replace(/[^0-9.]/g, "");
    const budget = budgetRaw ? Number(budgetRaw) : null;
    rows.push({
      employeeNumber,
      firstName,
      lastName,
      department: cell(colDept) || null,
      budget: budget !== null && Number.isFinite(budget) ? budget : null,
    });
  }
  return { rows, errors, skipped };
}

/** Trim, collapse inner whitespace and upper-case so "ab 12" and "AB12 " compare equal. */
export function normalizeEmployeeNumber(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return Papa.unparse(rows.map((r) => r.map((c) => (c === null || c === undefined ? "" : c))), { newline: "\r\n" });
}
