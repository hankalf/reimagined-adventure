"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { newInviteToken, requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { emailShell, escapeHtml, sendEmail } from "@/lib/email";
import { setSetting, SETTING_KEYS } from "@/lib/settings";
import { appUrl } from "@/lib/utils";
import { sendTestEvent, WEBHOOK_KEYS } from "@/lib/webhook";
import { randomBytes } from "node:crypto";

export type SettingsState = { error?: string; success?: string; link?: string } | null;

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
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: z.enum(["ADMIN", "HR"]),
});

async function sendInvite(user: { id: string; email: string; name: string }, inviter: string): Promise<string> {
  const { token, expiresAt } = newInviteToken();
  await db.adminUser.update({ where: { id: user.id }, data: { inviteToken: token, inviteExpiresAt: expiresAt } });
  const link = `${appUrl()}/admin/set-password/${token}`;
  await sendEmail({
    to: [user.email],
    subject: "You've been added to the gift portal admin",
    html: emailShell(
      "Welcome to the gift portal",
      `<p>Hi ${escapeHtml(user.name)},</p><p>${escapeHtml(inviter)} added you as an administrator. Choose your password with the link below (valid for 7 days):</p><p><a href="${link}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Choose my password</a></p><p style="font-size:12px;color:#6b7280">${link}</p>`,
    ),
  });
  return link;
}

export async function saveUserAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const admin = await requireAdmin({ role: "ADMIN" });
  const parsed = userSchema.safeParse({ id: formData.get("id") || undefined, name: formData.get("name"), email: formData.get("email"), role: formData.get("role") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const d = parsed.data;
  const clash = await db.adminUser.findUnique({ where: { email: d.email } });
  if (clash && clash.id !== d.id) return { error: "A user with that email already exists." };

  if (d.id) {
    if (d.id === admin.id && d.role !== "ADMIN") return { error: "You can't remove your own ADMIN role." };
    await db.adminUser.update({ where: { id: d.id }, data: { name: d.name, email: d.email, role: d.role } });
    await audit({ actorType: "ADMIN", actorId: admin.id, action: "admin_user.updated", entityType: "AdminUser", entityId: d.id, meta: { role: d.role } });
    revalidatePath("/admin/settings/users");
    return { success: "User updated." };
  }
  const user = await db.adminUser.create({ data: { name: d.name, email: d.email, role: d.role } });
  const link = await sendInvite(user, admin.name);
  await audit({ actorType: "ADMIN", actorId: admin.id, action: "admin_user.created", entityType: "AdminUser", entityId: user.id, meta: { role: d.role } });
  revalidatePath("/admin/settings/users");
  return { success: `${d.name} was added. They've been emailed a link to choose their password; you can also copy it here:`, link };
}

export async function resendInviteAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const admin = await requireAdmin({ role: "ADMIN" });
  const id = String(formData.get("id") ?? "");
  const user = await db.adminUser.findUnique({ where: { id } });
  if (!user) return { error: "User not found." };
  const link = await sendInvite(user, admin.name);
  await audit({ actorType: "ADMIN", actorId: admin.id, action: "admin_user.invite_resent", entityType: "AdminUser", entityId: id });
  revalidatePath("/admin/settings/users");
  return { success: `A new set-password link was emailed to ${user.email}. Copy it here if needed:`, link };
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
  await audit({ actorType: "ADMIN", actorId: admin.id, action: "admin_user.deleted", entityType: "AdminUser", entityId: id, meta: { email: user.email } });
  revalidatePath("/admin/settings/users");
}
