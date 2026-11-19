import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { kioskStatsAction } from "./actions";
import { KioskClient } from "./kiosk-client";

export default async function KioskPage({ params }: PageProps<"/admin/campaigns/[id]/kiosk">) {
  await requireAdmin();
  const { id } = await params;
  const campaign = await db.campaign.findUnique({ where: { id }, select: { id: true, name: true, currency: true, primaryColor: true } });
  if (!campaign) notFound();
  const stats = await kioskStatsAction(id);
  return <KioskClient campaign={campaign} initialStats={stats} />;
}
