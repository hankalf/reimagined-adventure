"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { bootstrapAdmin, clientIp, hashPassword, newInviteToken, setAdminCookie, validatePassword, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { emailShell, escapeHtml, sendEmail } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";
import { appUrl } from "@/lib/utils";

export type AuthState = { error?: string; success?: string; link?: string } | null;

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  await bootstrapAdmin();
  const parsed = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1), next: z.string().optional() }).safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { error: "Enter your email and password." };
  const ip = await clientIp();
  if (!checkRateLimit(`admin-login:${ip}`, 15, 10 * 60_000).ok) return { error: "Too many attempts. Please wait a few minutes." };

  const user = await db.adminUser.findUnique({ where: { email: parsed.data.email } });
  if (!user || !user.active || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Incorrect email or password." };
  }
  await db.adminUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await setAdminCookie({ id: user.id, email: user.email, name: user.name, role: user.role });
  await audit({ actorType: "ADMIN", actorId: user.id, action: "admin.login", entityType: "AdminUser", entityId: user.id });
  const next = parsed.data.next && parsed.data.next.startsWith("/admin") ? parsed.data.next : "/admin";
  redirect(next);
}

export async function forgotPasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z.object({ email: z.string().trim().toLowerCase().email() }).safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "Enter a valid email address." };
  const ip = await clientIp();
  if (!checkRateLimit(`forgot:${ip}`, 5, 10 * 60_000).ok) return { error: "Too many attempts. Please wait a few minutes." };
  const user = await db.adminUser.findUnique({ where: { email: parsed.data.email } });
  const generic = "If an account exists for that email, we've sent a link to set a new password.";
  if (!user || !user.active) return { success: generic };
  const { token, expiresAt } = newInviteToken();
  await db.adminUser.update({ where: { id: user.id }, data: { inviteToken: token, inviteExpiresAt: expiresAt } });
  const link = `${appUrl()}/admin/set-password/${token}`;
  await sendEmail({
    to: [user.email],
    subject: "Reset your gift portal password",
    html: emailShell("Reset your password", `<p>Hi ${escapeHtml(user.name)},</p><p>Use the link below to choose a new password. It expires in 7 days.</p><p><a href="${link}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Set a new password</a></p><p style="font-size:12px;color:#6b7280">${link}</p>`),
  });
  await audit({ actorType: "ADMIN", actorId: user.id, action: "admin.password_reset_requested", entityType: "AdminUser", entityId: user.id });
  return { success: generic };
}

export async function setPasswordAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z.object({ token: z.string().min(20), password: z.string(), confirm: z.string() }).safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: "Invalid request." };
  if (parsed.data.password !== parsed.data.confirm) return { error: "Passwords do not match." };
  const problem = validatePassword(parsed.data.password);
  if (problem) return { error: problem };
  const user = await db.adminUser.findUnique({ where: { inviteToken: parsed.data.token } });
  if (!user || !user.inviteExpiresAt || user.inviteExpiresAt < new Date() || !user.active) {
    return { error: "This link is invalid or has expired. Ask an administrator to send a new one." };
  }
  await db.adminUser.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.password), inviteToken: null, inviteExpiresAt: null, lastLoginAt: new Date() },
  });
  await setAdminCookie({ id: user.id, email: user.email, name: user.name, role: user.role });
  await audit({ actorType: "ADMIN", actorId: user.id, action: "admin.password_set", entityType: "AdminUser", entityId: user.id });
  redirect("/admin");
}
