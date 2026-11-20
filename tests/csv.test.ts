import { describe, expect, it } from "vitest";
import { mapEmployeeRows, normalizeEmployeeNumber, parseEmployeeCsv, splitFullName, toCsv } from "@/lib/csv";

describe("parseEmployeeCsv", () => {
  it("reads standard headers with a budget column", () => {
    const res = parseEmployeeCsv("employee_number,first_name,last_name,department,budget\n20001,Maria,García,Ops,75\n 20002 ,Jim,Smith,Finance,$150.00\n");
    expect(res.errors).toEqual([]);
    expect(res.rows).toEqual([
      { employeeNumber: "20001", firstName: "Maria", lastName: "García", department: "Ops", email: null, budget: 75 },
      { employeeNumber: "20002", firstName: "Jim", lastName: "Smith", department: "Finance", email: null, budget: 150 },
    ]);
  });
  it("matches loose header names and a single name column", () => {
    const res = parseEmployeeCsv("﻿Emp No;Name;Dept\n7;Ana de la Cruz;Ops\n8;\"Smith, John\";Sales\n");
    expect(res.rows).toEqual([
      { employeeNumber: "7", firstName: "Ana", lastName: "de la Cruz", department: "Ops", email: null, budget: null },
      { employeeNumber: "8", firstName: "John", lastName: "Smith", department: "Sales", email: null, budget: null },
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

describe("simple Employee # + Name sheets", () => {
  it("reads 'Name (Last, First)' with two last names", () => {
    const res = mapEmployeeRows([
      ["Employee #", "Name (Last, First)"],
      ["30001", "García López, María"],
      ["30002", "Smith, James"],
      [" 00321 ", "de la Cruz, Ana"],
    ]);
    expect(res.errors).toEqual([]);
    expect(res.rows.map((r) => [r.employeeNumber, r.lastName, r.firstName])).toEqual([
      ["30001", "García López", "María"],
      ["30002", "Smith", "James"],
      ["00321", "de la Cruz", "Ana"],
    ]);
  });
  it("accepts 'Last, First' and 'Last Name, First Name' headers", () => {
    for (const h of ["Last, First", "Last Name, First Name", "Employee Name", "Nombre completo"]) {
      const res = mapEmployeeRows([["Emp #", h], ["7", "Hernández López, Luis"]]);
      expect(res.rows[0], h).toMatchObject({ employeeNumber: "7", lastName: "Hernández López", firstName: "Luis" });
    }
  });
  it("reads a headerless two-column sheet", () => {
    const res = mapEmployeeRows([
      ["40001", "García López, María"],
      ["A-22", "Smith, James"],
    ]);
    expect(res.errors).toEqual([]);
    expect(res.rows.map((r) => [r.employeeNumber, r.lastName, r.firstName])).toEqual([
      ["40001", "García López", "María"],
      ["A-22", "Smith", "James"],
    ]);
  });
  it("combines apellido paterno and materno columns", () => {
    const res = mapEmployeeRows([
      ["No. Empleado", "Nombre", "Apellido Paterno", "Apellido Materno"],
      ["55", "Rosa", "Martínez", "Sánchez"],
      ["56", "Juan", "Pérez", ""],
    ]);
    expect(res.rows.map((r) => [r.firstName, r.lastName])).toEqual([
      ["Rosa", "Martínez Sánchez"],
      ["Juan", "Pérez"],
    ]);
  });
  it("splits names without a comma on the first word", () => {
    expect(splitFullName("Luis Hernández López")).toEqual({ firstName: "Luis", lastName: "Hernández López" });
    expect(splitFullName("García López, María José")).toEqual({ firstName: "María José", lastName: "García López" });
    expect(splitFullName("Cher")).toEqual({ firstName: "", lastName: "Cher" });
  });
});

describe("email column", () => {
  it("reads a valid email and drops junk", () => {
    const res = parseEmployeeCsv("employee_number,last_name,email\n1,Lee,Lee@Example.com\n2,Kim,not-an-email\n");
    expect(res.rows[0].email).toBe("lee@example.com");
    expect(res.rows[1].email).toBeNull();
  });
});

describe("template example rows", () => {
  it("are skipped so they never create or overwrite real employees", () => {
    const res = mapEmployeeRows([
      ["Employee #", "Name (Last, First)"],
      ["10001", "García López, María"],
      ["10002", "Smith, James"],
      ["10003", "Smith, James"],
    ]);
    expect(res.rows.map((r) => r.employeeNumber)).toEqual(["10003"]);
    expect(res.skipped).toBe(2);
    expect(res.errors[0]).toMatch(/Skipped 2 example row/);
  });
});

describe("helpers", () => {
  it("normalises employee numbers and writes CSV", () => {
    expect(normalizeEmployeeNumber(" ab 12 ")).toBe("AB12");
    expect(toCsv([["a", "b"], [1, null]])).toBe("a,b\r\n1,");
  });
});
