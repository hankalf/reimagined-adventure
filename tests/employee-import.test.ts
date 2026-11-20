import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildEmployeeTemplateWorkbook, employeeTemplateCsv, parseEmployeeFile } from "@/lib/employee-import";

describe("employee templates", () => {
  it("ignores the template's example rows on upload", async () => {
    for (const layout of ["simple", "full"] as const) {
      const res = await parseEmployeeFile(await buildEmployeeTemplateWorkbook(layout), `t.xlsx`);
      expect(res.rows, layout).toEqual([]);
      expect(res.errors[0], layout).toMatch(/only contains the template's example rows/);
      const csv = await parseEmployeeFile(Buffer.from(employeeTemplateCsv(layout)), "t.csv");
      expect(csv.rows, layout).toEqual([]);
    }
  });
  it("imports real rows added below the examples, keeping leading zeros and two last names", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await buildEmployeeTemplateWorkbook("simple")) as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("Employees")!;
    ws.addRow(["00777", "Martínez Sánchez, Rosa"]);
    const res = await parseEmployeeFile(Buffer.from(await wb.xlsx.writeBuffer()), "list.xlsx");
    expect(res.rows).toEqual([{ employeeNumber: "00777", firstName: "Rosa", lastName: "Martínez Sánchez", department: null, email: null, budget: null }]);
    expect(res.errors[0]).toMatch(/Skipped 3 example row/);
  });
  it("reads the full layout with a second last name column", async () => {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await buildEmployeeTemplateWorkbook("full")) as unknown as ArrayBuffer);
    wb.getWorksheet("Employees")!.addRow(["20001", "Luis", "Hernández", "López", "Warehouse", "Luis@Example.com", "$120"]);
    const res = await parseEmployeeFile(Buffer.from(await wb.xlsx.writeBuffer()), "list.xlsx");
    expect(res.rows).toEqual([{ employeeNumber: "20001", firstName: "Luis", lastName: "Hernández López", department: "Warehouse", email: "luis@example.com", budget: 120 }]);
  });
  it("explains unreadable Excel files", async () => {
    const res = await parseEmployeeFile(Buffer.from("not excel"), "list.xlsx");
    expect(res.errors[0]).toMatch(/Could not read the Excel file/);
  });
});

describe("employee list export", () => {
  it("exports in the upload layout so the file can be uploaded back", async () => {
    const { buildEmployeeListWorkbook } = await import("@/lib/employee-import");
    const buf = await buildEmployeeListWorkbook([
      { employeeNumber: "00777", firstName: "Rosa", lastName: "Martínez Sánchez", department: "Ops", email: "rosa@example.com", active: true, giftsChosen: 1, createdAt: new Date("2026-11-01") },
      { employeeNumber: "20002", firstName: "Jim", lastName: "Smith", department: null, email: null, active: false, giftsChosen: 0, createdAt: new Date("2026-10-01") },
    ]);
    const res = await parseEmployeeFile(buf, "employees.xlsx");
    expect(res.errors).toEqual([]);
    expect(res.rows).toEqual([
      { employeeNumber: "00777", firstName: "Rosa", lastName: "Martínez Sánchez", department: "Ops", email: "rosa@example.com", budget: null },
      { employeeNumber: "20002", firstName: "Jim", lastName: "Smith", department: null, email: null, budget: null },
    ]);
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("Employees")!;
    expect(ws.getRow(1).values).toEqual([undefined, "employee_number", "first_name", "last_name", "department", "email", "status", "gifts_chosen", "added"]);
    expect(ws.getRow(3).getCell(6).value).toBe("Inactive");
  });
});
