import { redirect } from "next/navigation";
import { bootstrapAdmin, getAdmin } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  await bootstrapAdmin();
  const sp = await searchParams;
  if (await getAdmin()) redirect("/admin");
  const next = typeof sp.next === "string" ? sp.next : "";
  return <LoginForm next={next} />;
}
