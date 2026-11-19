"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { generateTempPassword, hashPassword, normalizeUsername, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { setSetting, SETTING_KEYS } from "@/lib/settings";
import { sendTestEvent, WEBHOOK_KEYS } from "@/lib/webhook";
import { randomBytes } from "node:crypto";

export type SettingsState = { error?: string; success?: string; link?: string; tempPassword?: string; username?: string } | null;

export async function saveSettingsAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  await requireAdmin({ role: "ADMIN" });
  await setSetting(SETTING_KEYS.companyName, String(formData.get("companyName") ?? "").trim());
  revalidatePath("/admin/settings");
  return { success: "Settings saved." };
}

// ---------- orders spreadsheet: push webhook + live feed ----------

export async function saveOrdersWebhookAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  await requireAdmin({ role: "ADMIN" });
  const url = String(formData.get("url") ?? "").trim();
  const secret = String(formData.get("secret") ?? "").trim();
  if (url && !/^https?:\/\//i.test(url)) return { error: "The webhook URL must start with http:// or https://" };
  await setSetting(WEBHOOK_KEYS.url, url);
  await setSetting(WEBHOOK_KEYS.secret, secret);
  revalidatePath("/admin/settings");
  return { success: url ? "Webhook saved. Every order change will be posted there." : "Webhook cleared." };
}

export async function testOrdersWebhookAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  await requireAdmin();
  void formData;
  const res = await sendTestEvent();
  revalidatePath("/admin/settings");
  if (!res.sent) return { error: `Test failed: ${res.error ?? "unknown error"}` };
  return { success: `Test event delivered (HTTP ${res.status}). Check that a row appeared in your sheet or flow.` };
}

export async function rotateGlobalFeedTokenAction(): Promise<void> {
  await requireAdmin({ role: "ADMIN" });
  await setSetting(WEBHOOK_KEYS.feedToken, randomBytes(24).toString("hex"));
  revalidatePath("/admin/settings");
}

// ---------- admin users ----------

const userSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name is required").max(120),
  username: z.string().trim().min(2, "Username must be at least 2 characters").max(60).regex(/^[a-zA-Z0-9._@-]+$/, "Username can contain letters, numbers, dots, dashes and @"),
  email: z.string().trim().toLowerCase().max(160).optional(),
  role: z.enum(["ADMIN", "HR"]),
});

export async function saveUserAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const admin = await requireAdmin({ role: "ADMIN" });
  const parsed = userSchema.safeParse({ id: formData.get("id") || undefined, name: formData.get("name"), username: formData.get("username"), email: formData.get("email") ?? "", role: formData.get("role") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  const username = normalizeUsername(d.username);
  const email = d.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email) ? d.email : null;
  if (d.email && !email) return { error: "Enter a valid email address or leave it empty." };
  const clashUser = await db.adminUser.findFirst({ where: { username } });
  if (clashUser && clashUser.id !== d.id) return { error: "That username is already taken." };
  if (email) {
    const clashEmail = await db.adminUser.findFirst({ where: { email } });
    if (clashEmail && clashEmail.id !== d.id) return { error: "A user with that email already exists." };
  }

  if (d.id) {
    if (d.id === admin.id && d.role !== "ADMIN") return { error: "You can't remove your own ADMIN role." };
    await db.adminUser.update({ where: { id: d.id }, data: { name: d.name, username, email, role: d.role } });
    await audit({ actorType: "ADMIN", actorId: admin.id, action: "admin_user.updated", entityType: "AdminUser", entityId: d.id, meta: { role: d.role } });
    revalidatePath("/admin/settings/users");
    return { success: "User updated." };
  }
  const temp = generateTempPassword();
  const user = await db.adminUser.create({ data: { name: d.name, username, email, role: d.role, passwordHash: await hashPassword(temp), mustChangePassword: true } });
  await audit({ actorType: "ADMIN", actorId: admin.id, action: "admin_user.created", entityType: "AdminUser", entityId: user.id, meta: { role: d.role, username } });
  revalidatePath("/admin/settings/users");
  return { success: `${d.name} was added. Give them this username and temporary password; they will be asked to choose their own password at first sign-in. It is shown only once:`, tempPassword: temp, username };
}

/** Generate a new temporary password for a user (shown once) and require a change at next sign-in. */
export async function resetUserPasswordAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const admin = await requireAdmin({ role: "ADMIN" });
  const id = String(formData.get("id") ?? "");
  const user = await db.adminUser.findUnique({ where: { id } });
  if (!user) return { error: "User not found." };
  const temp = generateTempPassword();
  await db.adminUser.update({ where: { id }, data: { passwordHash: await hashPassword(temp), mustChangePassword: true, inviteToken: null, inviteExpiresAt: null } });
  await audit({ actorType: "ADMIN", actorId: admin.id, action: "admin_user.password_reset", entityType: "AdminUser", entityId: id });
  revalidatePath("/admin/settings/users");
  return { success: `New temporary password for ${user.name} (shown once):`, tempPassword: temp, username: user.username };
}

export async function toggleUserActiveAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin({ role: "ADMIN" });
  const id = String(formData.get("id") ?? "");
  if (id === admin.id) return;
  const user = await db.adminUser.findUnique({ where: { id } });
  if (!user) return;
  await db.adminUser.update({ where: { id }, data: { active: !user.active } });
  await audit({ actorType: "ADMIN", actorId: admin.id, action: user.active ? "admin_user.deactivated" : "admin_user.activated", entityType: "AdminUser", entityId: id });
  revalidatePath("/admin/settings/users");
}

export async function deleteUserAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin({ role: "ADMIN" });
  const id = String(formData.get("id") ?? "");
  if (id === admin.id) return;
  const user = await db.adminUser.findUnique({ where: { id } });
  if (!user) return;
  if (user.role === "ADMIN") {
    const otherAdmins = await db.adminUser.count({ where: { role: "ADMIN", active: true, id: { not: id } } });
    if (otherAdmins === 0) return;
  }
  await db.adminUser.delete({ where: { id } });
  await audit({ actorType: "ADMIN", actorId: admin.id, action: "admin_user.deleted", entityType: "AdminUser", entityId: id, meta: { username: user.username } });
  revalidatePath("/admin/settings/users");
}
