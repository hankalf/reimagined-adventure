import Link from "next/link";
import { db } from "@/lib/db";
import { SetPasswordForm } from "./set-password-form";

export default async function SetPasswordPage({ params }: PageProps<"/admin/set-password/[token]">) {
  const { token } = await params;
  const user = await db.adminUser.findUnique({ where: { inviteToken: token }, select: { name: true, email: true, inviteExpiresAt: true, active: true, passwordHash: true } });
  const valid = Boolean(user && user.active && user.inviteExpiresAt && user.inviteExpiresAt > new Date());
  if (!valid || !user) {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-lg font-semibold">This link is invalid or has expired</h2>
        <p className="text-sm text-slate-600">Ask an administrator to send you a new invitation, or request a new link from the sign-in page.</p>
        <Link href="/admin/forgot-password" className="btn-primary">
          Request a new link
        </Link>
      </div>
    );
  }
  return <SetPasswordForm token={token} name={user.name} email={user.email} firstTime={!user.passwordHash} />;
}
