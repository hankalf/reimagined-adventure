import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { db } from "./db";
import type { AdminRole } from "./db";

export const ADMIN_COOKIE = "gp_admin";
export const EMPLOYEE_COOKIE = "gp_emp";
const ADMIN_TTL_SEC = 12 * 60 * 60;
const EMPLOYEE_TTL_SEC = 2 * 60 * 60;
export const PASSWORD_MIN_LENGTH = 10;

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set (at least 16 characters)");
    return new TextEncoder().encode("dev-only-insecure-secret-0123456789");
  }
  return new TextEncoder().encode(secret);
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

// ---------- Admin sessions ----------

export type AdminSession = { id: string; email: string; name: string; role: AdminRole };

export async function signAdminToken(session: AdminSession): Promise<string> {
  return new SignJWT({ email: session.email, name: session.name, role: session.role, kind: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.id)
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_TTL_SEC}s`)
    .sign(secretKey());
}

export async function verifyAdminToken(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.kind !== "admin" || typeof payload.sub !== "string") return null;
    return {
      id: payload.sub,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      role: (payload.role === "HR" ? "HR" : "ADMIN") as AdminRole,
    };
  } catch {
    return null;
  }
}

export async function setAdminCookie(session: AdminSession): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE, await signAdminToken(session), cookieOptions(ADMIN_TTL_SEC));
}

export async function clearAdminCookie(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}

/** Current admin from the cookie, re-validated against the database (active flag, role changes). */
export async function getAdmin(): Promise<AdminSession | null> {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const session = await verifyAdminToken(token);
  if (!session) return null;
  const user = await db.adminUser.findUnique({ where: { id: session.id } });
  if (!user || !user.active || !user.passwordHash) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/** For pages and server actions: redirect to login when not signed in; optionally require the ADMIN role. */
export async function requireAdmin(opts?: { role?: AdminRole }): Promise<AdminSession> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  if (opts?.role === "ADMIN" && admin.role !== "ADMIN") redirect("/admin?forbidden=1");
  return admin;
}

// ---------- Passwords & invites ----------

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) return false;
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return "Password must include at least one letter and one number.";
  return null;
}

export function newInviteToken(): { token: string; expiresAt: Date } {
  return { token: randomBytes(32).toString("hex"), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) };
}

/** Create the first admin from ADMIN_EMAIL / ADMIN_PASSWORD when the users table is empty. */
export async function bootstrapAdmin(): Promise<void> {
  const count = await db.adminUser.count();
  if (count > 0) return;
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  await db.adminUser.create({
    data: { email, name: "Administrator", role: "ADMIN", passwordHash: await hashPassword(password) },
  });
  console.log(`[auth] Created first admin user ${email} from environment variables.`);
}

// ---------- Employee sessions (campaign-scoped) ----------

export type EmployeeSession = { employeeId: string; campaignId: string };

export async function setEmployeeCookie(session: EmployeeSession): Promise<void> {
  const token = await new SignJWT({ campaignId: session.campaignId, kind: "employee" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.employeeId)
    .setIssuedAt()
    .setExpirationTime(`${EMPLOYEE_TTL_SEC}s`)
    .sign(secretKey());
  const store = await cookies();
  store.set(EMPLOYEE_COOKIE, token, cookieOptions(EMPLOYEE_TTL_SEC));
}

export async function clearEmployeeCookie(): Promise<void> {
  const store = await cookies();
  store.delete(EMPLOYEE_COOKIE);
}

export async function getEmployeeSession(campaignId: string): Promise<EmployeeSession | null> {
  const store = await cookies();
  const token = store.get(EMPLOYEE_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.kind !== "employee" || typeof payload.sub !== "string") return null;
    if (payload.campaignId !== campaignId) return null;
    return { employeeId: payload.sub, campaignId };
  } catch {
    return null;
  }
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}
