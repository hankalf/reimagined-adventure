/** Group the "not picked yet" list by department for the printable reminder sheets. Pure, so it is unit-tested. */

export const NO_DEPARTMENT = "No department";

export type NotPickedPerson = { employeeNumber: string; firstName: string; lastName: string; department: string | null; mustRepick: boolean };
export type NotPickedDepartment = { department: string; people: NotPickedPerson[] };

const byName = (a: NotPickedPerson, b: NotPickedPerson) =>
  a.lastName.localeCompare(b.lastName, "en", { sensitivity: "base" }) || a.firstName.localeCompare(b.firstName, "en", { sensitivity: "base" }) || a.employeeNumber.localeCompare(b.employeeNumber);

/**
 * Departments A–Z ("No department" last), people by last then first name. Spelling differences in case or spacing
 * ("Ops", "ops ") land in one group, shown with the first spelling seen.
 */
export function groupNotPickedByDepartment(people: NotPickedPerson[]): NotPickedDepartment[] {
  const groups = new Map<string, NotPickedDepartment>();
  for (const p of people) {
    const label = p.department?.trim().replace(/\s+/g, " ") || NO_DEPARTMENT;
    const key = label.toLowerCase();
    const g = groups.get(key) ?? { department: label, people: [] };
    g.people.push(p);
    groups.set(key, g);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, people: [...g.people].sort(byName) }))
    .sort((a, b) => (a.department === NO_DEPARTMENT ? 1 : b.department === NO_DEPARTMENT ? -1 : a.department.localeCompare(b.department, "en", { sensitivity: "base" })));
}
