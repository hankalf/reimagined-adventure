import "server-only";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

export async function loadCampaign(slug: string) {
  const campaign = await db.campaign.findUnique({ where: { slug } });
  if (!campaign) notFound();
  return campaign;
}

export type EmployeeCampaign = Awaited<ReturnType<typeof loadCampaign>>;
