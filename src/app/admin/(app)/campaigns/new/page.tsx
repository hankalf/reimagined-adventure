import { PageHeader } from "@/components/admin/page-header";
import { db } from "@/lib/db";
import { getSetting, SETTING_KEYS } from "@/lib/settings";
import { NewCampaignForm } from "./new-form";

export default async function NewCampaignPage() {
  const [existing, defaultHr] = await Promise.all([db.campaign.findMany({ select: { id: true, name: true }, orderBy: { createdAt: "desc" } }), getSetting(SETTING_KEYS.defaultHrEmails)]);
  return (
    <div>
      <PageHeader title="New campaign" description="Start with the basics. You can change everything later in the campaign's Settings and Branding tabs." />
      <NewCampaignForm existing={existing} defaultHr={defaultHr ?? ""} />
    </div>
  );
}
