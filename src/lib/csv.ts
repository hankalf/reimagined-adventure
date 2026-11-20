import Papa from "papaparse";

export type EmployeeCsvRow = {
  employeeNumber: string;
  firstName: string;
  lastName: string;
  department: string | null;
  email: string | null;
  budget: number | null;
};

export type EmployeeCsvResult = {
  rows: EmployeeCsvRow[];
  errors: string[];
  skipped: number;
};

const HEADER_ALIASES: Record<keyof EmployeeCsvRow | "fullName" | "secondLastName", string[]> = {
  email: ["email", "e-mail", "email address", "work email", "correo", "correo electronico"],
  employeeNumber: ["employee_number", "employeenumber", "employee number", "employee no", "employee #", "emp no", "emp #", "emp number", "empno", "employee id", "employee_id", "employeeid", "emp id", "id", "number", "#", "no", "badge", "badge number", "badge #", "clock number", "clock no", "clock #", "numero de empleado", "num empleado", "no empleado"],
  firstName: ["first_name", "firstname", "first name", "first", "given name", "given_name", "nombre", "nombres"],
  lastName: ["last_name", "lastname", "last name", "last", "surname", "family name", "family_name", "apellido", "apellidos", "apellido paterno", "primer apellido", "paternal last name", "father's last name", "last name 1", "last name1"],
  secondLastName: ["second_last_name", "second last name", "last name 2", "last name2", "lastname2", "maternal last name", "mother's last name", "apellido materno", "segundo apellido", "second surname"],
  fullName: ["name", "full name", "full_name", "fullname", "employee name", "employee_name", "employee", "nombre completo", "last first", "last name first name", "lastname firstname", "last name first"],
  department: ["department", "dept", "team", "location", "site", "departamento", "area"],
  budget: ["budget", "gift budget", "gift_budget", "amount", "allowance", "tier", "presupuesto"],
};

/** "Name (Last, First)" -> "name"; "Employee #" -> "employee #"; "Last, First" -> "last first". */
function normalizeHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[\s_\-,.:/]+/g, " ")
    .trim();
}

function findColumn(headers: string[], aliases: string[]): number {
  const normalizedAliases = aliases.map(normalizeHeader);
  for (let i = 0; i < headers.length; i += 1) {
    if (normalizedAliases.includes(normalizeHeader(headers[i] ?? ""))) return i;
  }
  return -1;
}

/**
 * The example people in the downloadable templates. Rows that match one exactly are skipped on upload, so an
 * HR person who forgets to delete them doesn't create (or overwrite) employees 10001, 10002 and 00123.
 */
export const TEMPLATE_EXAMPLE_PEOPLE = [
  { employeeNumber: "10001", firstName: "María", lastName: "García López" },
  { employeeNumber: "10002", firstName: "James", lastName: "Smith" },
  { employeeNumber: "00123", firstName: "Ana", lastName: "de la Cruz" },
] as const;

function isTemplateExample(row: { employeeNumber: string; firstName: string; lastName: string }): boolean {
  return TEMPLATE_EXAMPLE_PEOPLE.some((e) => e.employeeNumber === row.employeeNumber && e.firstName === row.firstName.trim() && e.lastName === row.lastName.trim());
}

/** Does a cell look like an employee number rather than a header? (has a digit, no spaces) */
function looksLikeEmployeeNumber(value: string): boolean {
  const v = value.trim();
  return /\d/.test(v) && !/\s/.test(v) && v.length <= 40;
}

/**
 * Split a single name cell. "García López, María" -> last "García López", first "María" (the recommended
 * "Last, First" form, safe for two surnames). Without a comma the first word is taken as the first name.
 */
export function splitFullName(full: string): { firstName: string; lastName: string } {
  const value = full.replace(/\s+/g, " ").trim();
  if (!value) return { firstName: "", lastName: "" };
  if (value.includes(",")) {
    const [last, ...rest] = value.split(",");
    return { lastName: (last ?? "").trim(), firstName: rest.join(",").trim() };
  }
  const parts = value.split(" ");
  return parts.length > 1 ? { firstName: parts[0], lastName: parts.slice(1).join(" ") } : { firstName: "", lastName: parts[0] };
}

/**
 * Map a table (rows of cells, first row = headers unless the file has none) to employee rows. Used for CSV
 * and Excel uploads. Minimum: an employee number column plus either last_name or a single name column.
 */
export function mapEmployeeRows(table: string[][]): EmployeeCsvResult {
  const errors: string[] = [];
  const data = table.filter((r) => Array.isArray(r) && r.some((c) => String(c ?? "").trim() !== "")).map((r) => r.map((c) => String(c ?? "")));
  if (data.length === 0) return { rows: [], errors: ["The file is empty."], skipped: 0 };

  const headers = data[0] ?? [];
  let colNumber = findColumn(headers, HEADER_ALIASES.employeeNumber);
  const colFirst = findColumn(headers, HEADER_ALIASES.firstName);
  const colLast = findColumn(headers, HEADER_ALIASES.lastName);
  const colSecond = findColumn(headers, HEADER_ALIASES.secondLastName);
  let colFull = findColumn(headers, HEADER_ALIASES.fullName);
  const colDept = findColumn(headers, HEADER_ALIASES.department);
  const colEmail = findColumn(headers, HEADER_ALIASES.email);
  const colBudget = findColumn(headers, HEADER_ALIASES.budget);
  let firstDataRow = 1;

  // Headerless two-column sheet: employee # in column A, "Last, First" in column B.
  const anyHeader = [colNumber, colFirst, colLast, colSecond, colFull, colDept, colEmail, colBudget].some((c) => c >= 0);
  if (!anyHeader && headers.length >= 2 && looksLikeEmployeeNumber(headers[0] ?? "") && (headers[1] ?? "").trim()) {
    colNumber = 0;
    colFull = 1;
    firstDataRow = 0;
  }

  if (colNumber === -1) {
    errors.push(`Could not find an employee number column. Use a header such as "Employee #". Found headers: ${headers.filter(Boolean).join(", ") || "(none)"}`);
    return { rows: [], errors, skipped: 0 };
  }
  if (colLast === -1 && colFull === -1) {
    errors.push(`Could not find a name column. Use "Name" (written Last, First) or "first_name" and "last_name" columns.`);
    return { rows: [], errors, skipped: 0 };
  }

  const rows: EmployeeCsvRow[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  let examplesSkipped = 0;
  for (let i = firstDataRow; i < data.length; i += 1) {
    const r = data[i] ?? [];
    const cell = (idx: number) => (idx >= 0 ? String(r[idx] ?? "").trim() : "");
    const employeeNumber = normalizeEmployeeNumber(cell(colNumber));
    if (!employeeNumber) {
      skipped += 1;
      continue;
    }
    let firstName = cell(colFirst);
    let lastName = [cell(colLast), cell(colSecond)].filter(Boolean).join(" ");
    if (!lastName && colFull >= 0) {
      const split = splitFullName(cell(colFull));
      lastName = split.lastName;
      firstName = firstName || split.firstName;
    }
    if (!lastName) {
      errors.push(`Row ${i + 1}: missing last name for employee ${employeeNumber}.`);
      skipped += 1;
      continue;
    }
    if (isTemplateExample({ employeeNumber, firstName, lastName })) {
      examplesSkipped += 1;
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
    const emailRaw = cell(colEmail).toLowerCase();
    rows.push({
      employeeNumber,
      firstName,
      lastName,
      department: cell(colDept) || null,
      email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailRaw) ? emailRaw : null,
      budget: budget !== null && Number.isFinite(budget) ? budget : null,
    });
  }
  if (examplesSkipped > 0) errors.unshift(`Skipped ${examplesSkipped} example row(s) from the template (${TEMPLATE_EXAMPLE_PEOPLE.map((e) => e.employeeNumber).join(", ")}).`);
  if (rows.length === 0 && examplesSkipped > 0) errors.unshift("The file only contains the template's example rows. Replace them with your employees and upload again.");
  return { rows, errors, skipped };
}

export function parseEmployeeCsv(text: string): EmployeeCsvResult {
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), { skipEmptyLines: "greedy", delimiter: "" });
  const result = mapEmployeeRows(parsed.data);
  const parseErrors = parsed.errors.slice(0, 5).map((e) => `Row ${e.row ?? "?"}: ${e.message}`);
  return { ...result, errors: [...parseErrors, ...result.errors] };
}

/** Trim, collapse inner whitespace and upper-case so "ab 12" and "AB12 " compare equal. */
export function normalizeEmployeeNumber(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return Papa.unparse(rows.map((r) => r.map((c) => (c === null || c === undefined ? "" : c))), { newline: "\r\n" });
}
