import { db } from "@/lib/db";
import { BrandingForm } from "./branding-form";

export default async function BrandingPage({ params }: PageProps<"/admin/campaigns/[id]/branding">) {
  const { id } = await params;
  const c = await db.campaign.findUniqueOrThrow({ where: { id } });
  return (
    <BrandingForm
      campaign={{
        id: c.id,
        slug: c.slug,
        companyName: c.companyName ?? "",
        primaryColor: c.primaryColor,
        accentColor: c.accentColor,
        logoImageId: c.logoImageId,
        heroImageId: c.heroImageId,
        welcomeHeadline: c.welcomeHeadline,
        welcomeHeadlineEs: c.welcomeHeadlineEs ?? "",
        welcomeMessage: c.welcomeMessage,
        welcomeMessageEs: c.welcomeMessageEs ?? "",
        pickupInstructions: c.pickupInstructions,
        pickupInstructionsEs: c.pickupInstructionsEs ?? "",
        leadershipMessage: c.leadershipMessage ?? "",
        leadershipMessageEs: c.leadershipMessageEs ?? "",
        leadershipName: c.leadershipName ?? "",
        mascotEnabled: c.mascotEnabled,
        mascotImageId: c.mascotImageId,
        mascotCaption: c.mascotCaption ?? "",
        mascotCaptionEs: c.mascotCaptionEs ?? "",
        mascotShowOnDone: c.mascotShowOnDone,
        mascotKind: c.mascotKind,
        mascotFaceZoom: c.mascotFaceZoom,
        mascotFaceOffsetX: c.mascotFaceOffsetX,
        mascotFaceOffsetY: c.mascotFaceOffsetY,
        mascotFaceRotate: c.mascotFaceRotate,
        mascotFaceFlip: c.mascotFaceFlip,
        videoUrl: c.videoUrl ?? "",
        showPickCount: c.showPickCount,
        notifyEmployeesOnReceived: c.notifyEmployeesOnReceived,
      }}
    />
  );
}
