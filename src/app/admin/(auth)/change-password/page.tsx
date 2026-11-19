import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { ChangePasswordForm } from "./change-password-form";

export default async function ChangePasswordPage() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return <ChangePasswordForm name={admin.name} forced={Boolean(admin.mustChangePassword)} />;
}
