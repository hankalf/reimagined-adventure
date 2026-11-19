import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/utils";
import { PrintButton } from "./print-button";
import { DancingMascot } from "@/components/dancing-mascot";

export default async function PosterPage({ params }: PageProps<"/admin/campaigns/[id]/poster">) {
  await requireAdmin();
  const { id } = await params;
  const campaign = await db.campaign.findUnique({ where: { id } });
  if (!campaign) notFound();
  const url = `${appUrl()}/g/${campaign.slug}`;
  return (
    <main className="mx-auto flex min-h-screen max-w-[210mm] flex-col items-center justify-between p-10 text-center print:p-6" style={{ ["--brand" as string]: campaign.primaryColor }}>
      <div className="no-print mb-6 flex w-full items-center justify-between text-sm">
        <a href={`/admin/campaigns/${id}`} className="text-blue-700 hover:underline">
          ← Back to campaign
        </a>
        <PrintButton />
      </div>
      <header>
        {campaign.logoImageId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/images/${campaign.logoImageId}`} alt={campaign.companyName ?? ""} className="mx-auto mb-6 max-h-20" />
        ) : (
          campaign.companyName && <p className="mb-4 text-xl font-semibold text-slate-600">{campaign.companyName}</p>
        )}
        <h1 className="text-5xl font-black tracking-tight" style={{ color: campaign.primaryColor }}>
          {campaign.welcomeHeadline}
        </h1>
        {campaign.welcomeHeadlineEs && <p className="mt-2 text-2xl font-semibold text-slate-600">{campaign.welcomeHeadlineEs}</p>}
      </header>
      <section className="my-8">
        <div className="flex items-center justify-center gap-6">
          {campaign.mascotEnabled && (
            <DancingMascot
              kind={campaign.mascotKind}
              still
              snow={false}
              size={150}
              faceSrc={campaign.mascotImageId ? `/api/images/${campaign.mascotImageId}?thumb=1` : null}
              faceZoom={campaign.mascotFaceZoom}
              faceOffsetX={campaign.mascotFaceOffsetX}
              faceOffsetY={campaign.mascotFaceOffsetY}
              faceRotate={campaign.mascotFaceRotate}
              faceFlip={campaign.mascotFaceFlip}
            />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/campaigns/${campaign.slug}/qr?size=1024`} alt="QR code" className="h-[380px] w-[380px]" />
        </div>
        <p className="mt-4 text-3xl font-bold">Scan to choose your gift</p>
        <p className="text-2xl font-semibold text-slate-600">Escanea para elegir tu regalo</p>
      </section>
      <section className="w-full rounded-2xl border-2 p-5 text-left text-lg" style={{ borderColor: campaign.accentColor }}>
        <ol className="list-decimal space-y-1 pl-6">
          <li>
            Scan the code with your phone camera. <span className="text-slate-500">/ Escanea el código con la cámara de tu teléfono.</span>
          </li>
          <li>
            Enter your employee number{campaign.requireLastName ? " and last name" : ""}. <span className="text-slate-500">/ Ingresa tu número de empleado{campaign.requireLastName ? " y apellido" : ""}.</span>
          </li>
          <li>
            Pick one gift and confirm. <span className="text-slate-500">/ Elige un regalo y confirma.</span>
          </li>
        </ol>
        {campaign.closesAt && (
          <p className="mt-3 font-semibold">
            Choose by {campaign.closesAt.toLocaleDateString("en-US", { dateStyle: "long" })} · Elige antes del {campaign.closesAt.toLocaleDateString("es-US", { dateStyle: "long" })}
          </p>
        )}
      </section>
      <footer className="mt-6 text-slate-500">
        <p className="text-sm">Or type this link: </p>
        <p className="break-all font-mono text-lg font-semibold text-slate-800">{url}</p>
      </footer>
    </main>
  );
}
