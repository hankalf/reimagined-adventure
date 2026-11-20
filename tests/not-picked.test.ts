import { describe, expect, it } from "vitest";
import { NO_DEPARTMENT, groupNotPickedByDepartment } from "@/lib/not-picked";

const p = (employeeNumber: string, lastName: string, firstName: string, department: string | null, mustRepick = false) => ({ employeeNumber, lastName, firstName, department, mustRepick });

describe("not-picked list by department", () => {
  it("groups A–Z with 'No department' last and people by last, then first name", () => {
    const groups = groupNotPickedByDepartment([
      p("3", "Nguyen", "An", "Shipping"),
      p("1", "García López", "María", "Assembly"),
      p("5", "Zimmer", "Bo", null),
      p("2", "Adams", "Cy", "Assembly"),
      p("4", "Adams", "Al", "Assembly", true),
      p("6", "Lee", "Di", "  "),
    ]);
    expect(groups.map((g) => g.department)).toEqual(["Assembly", "Shipping", NO_DEPARTMENT]);
    expect(groups[0].people.map((x) => `${x.lastName}, ${x.firstName}`)).toEqual(["Adams, Al", "Adams, Cy", "García López, María"]);
    expect(groups[0].people[0].mustRepick).toBe(true);
    expect(groups[2].people.map((x) => x.lastName)).toEqual(["Lee", "Zimmer"]);
  });
  it("merges spelling differences in case and spacing", () => {
    const groups = groupNotPickedByDepartment([p("1", "A", "A", "Maintenance"), p("2", "B", "B", "maintenance "), p("3", "C", "C", "Main  tenance")]);
    expect(groups.map((g) => [g.department, g.people.length])).toEqual([
      ["Main tenance", 1],
      ["Maintenance", 2],
    ]);
  });
  it("is empty when everyone picked", () => {
    expect(groupNotPickedByDepartment([])).toEqual([]);
  });
});
