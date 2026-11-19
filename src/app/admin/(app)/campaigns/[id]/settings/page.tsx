import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { dec } from "@/lib/utils";
import { SettingsForm } from "./settings-form";

export default async function CampaignSettingsPage({ params }: PageProps<"/admin/campaigns/[id]/settings">) {
  const { id } = await params;
  const [admin, c, selectionCount] = await Promise.all([requireAdmin(), db.campaign.findUniqueOrThrow({ where: { id } }), db.selection.count({ where: { campaignId: id } })]);
  const toInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
  return (
    <SettingsForm
      canDelete={admin.role === "ADMIN"}
      selectionCount={selectionCount}
      campaign={{
        id: c.id,
        name: c.name,
        slug: c.slug,
        status: c.status,
        opensAt: toInput(c.opensAt),
        closesAt: toInput(c.closesAt),
        currency: c.currency,
        requireLastName: c.requireLastName,
        allowChangeUntilOrdered: c.allowChangeUntilOrdered,
        showSoldOutItems: c.showSoldOutItems,
        hideItemsOverBudget: c.hideItemsOverBudget,
        allEmployeesEligible: c.allEmployeesEligible,
        hrEmails: c.hrEmails.join(", "),
        totalBudget: dec(c.totalBudget)?.toString() ?? "",
        defaultEmployeeBudget: dec(c.defaultEmployeeBudget)?.toString() ?? "",
      }}
    />
  );
}
