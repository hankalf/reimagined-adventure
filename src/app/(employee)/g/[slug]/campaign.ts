import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";

/** One query per request, shared by the layout, viewport/metadata and the page. */
export const loadCampaign = cache(async (slug: string) => {
  const campaign = await db.campaign.findUnique({ where: { slug } });
  if (!campaign) notFound();
  return campaign;
});

export type EmployeeCampaign = Awaited<ReturnType<typeof loadCampaign>>;
