import { describe, expect, it } from "vitest";
import { normalizeEmployeeNumber, parseEmployeeCsv, toCsv } from "@/lib/csv";

describe("parseEmployeeCsv", () => {
  it("reads standard headers with a budget column", () => {
    const res = parseEmployeeCsv("employee_number,first_name,last_name,department,budget\n10001,Maria,García,Ops,75\n 10002 ,James,Smith,Finance,$150.00\n");
    expect(res.errors).toEqual([]);
    expect(res.rows).toEqual([
      { employeeNumber: "10001", firstName: "Maria", lastName: "García", department: "Ops", budget: 75 },
      { employeeNumber: "10002", firstName: "James", lastName: "Smith", department: "Finance", budget: 150 },
    ]);
  });
  it("matches loose header names and a single name column", () => {
    const res = parseEmployeeCsv("﻿Emp No;Name;Dept\n7;Ana de la Cruz;Ops\n8;\"Smith, John\";Sales\n");
    expect(res.rows).toEqual([
      { employeeNumber: "7", firstName: "Ana", lastName: "de la Cruz", department: "Ops", budget: null },
      { employeeNumber: "8", firstName: "John", lastName: "Smith", department: "Sales", budget: null },
    ]);
  });
  it("skips blanks and reports duplicates and missing names", () => {
    const res = parseEmployeeCsv("employee_number,last_name\n1,Lee\n1,Lee\n,Nobody\n2,\n");
    expect(res.rows).toHaveLength(1);
    expect(res.skipped).toBe(3);
    expect(res.errors.join(" ")).toMatch(/duplicate/);
    expect(res.errors.join(" ")).toMatch(/missing last name/);
  });
  it("fails clearly without an employee number column", () => {
    const res = parseEmployeeCsv("name,email\nA B,a@b.c\n");
    expect(res.rows).toEqual([]);
    expect(res.errors[0]).toMatch(/employee number column/);
  });
});

describe("helpers", () => {
  it("normalises employee numbers and writes CSV", () => {
    expect(normalizeEmployeeNumber(" ab 12 ")).toBe("AB12");
    expect(toCsv([["a", "b"], [1, null]])).toBe("a,b\r\n1,");
  });
});
