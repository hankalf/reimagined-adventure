"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { normalizeEmployeeNumber, parseEmployeeCsv } from "@/lib/csv";
import { db } from "@/lib/db";

export type ImportState = { error?: string; summary?: { created: number; updated: number; skipped: number; eligible?: number; errors: string[] } } | null;

/**
 * Upsert employees from a CSV. When `campaignId` is given, also mark them eligible for that campaign and
 * store any per-employee budget from the file.
 */
export async function importEmployeesAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const admin = await requireAdmin();
  const file = formData.get("file");
  const campaignId = typeof formData.get("campaignId") === "string" ? String(formData.get("campaignId")) : null;
  const deactivateMissing = formData.get("deactivateMissing") === "on";
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a CSV file first." };
  if (file.size > 5 * 1024 * 1024) return { error: "File is too large (max 5 MB)." };
  const text = await file.text();
  const parsed = parseEmployeeCsv(text);
  if (parsed.rows.length === 0) return { error: parsed.errors[0] ?? "No employee rows found." };

  let created = 0;
  let updated = 0;
  const ids: string[] = [];
  for (const row of parsed.rows) {
    const existing = await db.employee.findUnique({ where: { employeeNumber: row.employeeNumber } });
    if (existing) {
      await db.employee.update({ where: { id: existing.id }, data: { firstName: row.firstName || existing.firstName, lastName: row.lastName, department: row.department ?? existing.department, email: row.email ?? existing.email, active: true } });
      ids.push(existing.id);
      updated += 1;
    } else {
      const e = await db.employee.create({ data: { employeeNumber: row.employeeNumber, firstName: row.firstName, lastName: row.lastName, department: row.department, email: row.email } });
      ids.push(e.id);
      created += 1;
    }
  }

  let eligible: number | undefined;
  if (campaignId) {
    const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
    if (campaign) {
      for (let i = 0; i < parsed.rows.length; i += 1) {
        const row = parsed.rows[i];
        await db.campaignEmployee.upsert({
          where: { campaignId_employeeId: { campaignId, employeeId: ids[i] } },
          update: { budgetOverride: row.budget },
          create: { campaignId, employeeId: ids[i], budgetOverride: row.budget },
        });
      }
      eligible = parsed.rows.length;
      if (campaign.allEmployeesEligible && !formData.get("keepAllEligible")) {
        await db.campaign.update({ where: { id: campaignId }, data: { allEmployeesEligible: false } });
      }
    }
  } else if (deactivateMissing) {
    await db.employee.updateMany({ where: { id: { notIn: ids } }, data: { active: false } });
  }

  await audit({ actorType: "ADMIN", actorId: admin.id, action: "employees.imported", entityType: campaignId ? "Campaign" : "Employee", entityId: campaignId ?? "all", meta: { created, updated, skipped: parsed.skipped, file: file.name } });
  revalidatePath("/admin/employees");
  if (campaignId) revalidatePath(`/admin/campaigns/${campaignId}`);
  return { summary: { created, updated, skipped: parsed.skipped, eligible, errors: parsed.errors.slice(0, 10) } };
}

const employeeSchema = z.object({
  id: z.string().optional(),
  employeeNumber: z.string().trim().min(1, "Employee number is required").max(40),
  firstName: z.string().trim().max(80).optional().default(""),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  department: z.string().trim().max(80).optional(),
  email: z.string().trim().toLowerCase().max(160).optional(),
  active: z.string().optional(),
});

export type EmployeeFormState = { error?: string; success?: string } | null;

export async function saveEmployeeAction(_prev: EmployeeFormState, formData: FormData): Promise<EmployeeFormState> {
  const admin = await requireAdmin();
  const parsed = employeeSchema.safeParse({
    id: formData.get("id") || undefined,
    employeeNumber: formData.get("employeeNumber"),
    firstName: formData.get("firstName") ?? "",
    lastName: formData.get("lastName"),
    department: formData.get("department") ?? "",
    email: formData.get("email") ?? "",
    active: formData.get("active") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  const employeeNumber = normalizeEmployeeNumber(d.employeeNumber);
  const clash = await db.employee.findUnique({ where: { employeeNumber } });
  if (clash && clash.id !== d.id) return { error: `Employee number ${employeeNumber} already exists (${clash.firstName} ${clash.lastName}).` };
  if (d.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return { error: "Enter a valid email address or leave it empty." };
  const data = { employeeNumber, firstName: d.firstName, lastName: d.lastName, department: d.department || null, email: d.email || null, active: d.id ? d.active === "on" : true };
  if (d.id) {
    await db.employee.update({ where: { id: d.id }, data });
    await audit({ actorType: "ADMIN", actorId: admin.id, action: "employee.updated", entityType: "Employee", entityId: d.id });
  } else {
    const e = await db.employee.create({ data });
    await audit({ actorType: "ADMIN", actorId: admin.id, action: "employee.created", entityType: "Employee", entityId: e.id });
  }
  revalidatePath("/admin/employees");
  return { success: d.id ? "Employee updated." : `Added ${d.firstName} ${d.lastName} (${employeeNumber}).` };
}

export async function toggleEmployeeActiveAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const e = await db.employee.findUnique({ where: { id } });
  if (!e) return;
  await db.employee.update({ where: { id }, data: { active: !e.active } });
  await audit({ actorType: "ADMIN", actorId: admin.id, action: e.active ? "employee.deactivated" : "employee.activated", entityType: "Employee", entityId: id });
  revalidatePath("/admin/employees");
}

export async function deleteEmployeeAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const selections = await db.selection.count({ where: { employeeId: id } });
  if (selections > 0) {
    await db.employee.update({ where: { id }, data: { active: false } });
  } else {
    await db.employee.delete({ where: { id } }).catch(() => undefined);
  }
  await audit({ actorType: "ADMIN", actorId: admin.id, action: selections > 0 ? "employee.deactivated" : "employee.deleted", entityType: "Employee", entityId: id });
  revalidatePath("/admin/employees");
}
