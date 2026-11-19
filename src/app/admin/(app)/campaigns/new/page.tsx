import { PageHeader } from "@/components/admin/page-header";
import { db } from "@/lib/db";
import { NewCampaignForm } from "./new-form";

export default async function NewCampaignPage() {
  const existing = await db.campaign.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "desc" } });
  return (
    <div>
      <PageHeader title="New campaign" description="Start with the basics. You can change everything later in the campaign's Settings and Branding tabs." />
      <NewCampaignForm existing={existing} />
    </div>
  );
}
