import { db } from "@/lib/db";
import { BrandingForm } from "./branding-form";

export default async function BrandingPage({ params }: PageProps<"/admin/campaigns/[id]/branding">) {
  const { id } = await params;
  const c = await db.campaign.findUniqueOrThrow({ where: { id }, include: { mascots: { orderBy: { sortOrder: "asc" } } } });
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
        mascots: c.mascots.map((m) => ({
          id: m.id,
          kind: m.kind,
          imageId: m.imageId,
          caption: m.caption ?? "",
          captionEs: m.captionEs ?? "",
          faceZoom: m.faceZoom,
          faceOffsetX: m.faceOffsetX,
          faceOffsetY: m.faceOffsetY,
          faceRotate: m.faceRotate,
          faceFlip: m.faceFlip,
          showOnLanding: m.showOnLanding,
          showOnDone: m.showOnDone,
          showOnPoster: m.showOnPoster,
        })),
        videoUrl: c.videoUrl ?? "",
        showPickCount: c.showPickCount,
        notifyEmployeesOnReceived: c.notifyEmployeesOnReceived,
      }}
    />
  );
}
