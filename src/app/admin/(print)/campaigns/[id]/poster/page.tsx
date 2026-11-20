import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { PrintButton } from "./print-button";
import { FitToPage } from "./fit-to-page";
import { DancingMascot } from "@/components/dancing-mascot";
import { ItemThumb } from "@/components/item-thumb";
import { imageSrc } from "@/lib/image-src";
import { mascotFaceProps } from "@/lib/mascot";
import { posterLayout, posterTiles } from "@/lib/poster";

const PX_PER_IN = 96;

export default async function PosterPage({ params, searchParams }: PageProps<"/admin/campaigns/[id]/poster">) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const showGifts = sp.gifts !== "0";
  const campaign = await db.campaign.findUnique({ where: { id } });
  if (!campaign) notFound();
  const gifts = showGifts
    ? (await db.campaignItem.findMany({ where: { campaignId: id }, include: { item: true }, orderBy: [{ sortOrder: "asc" }, { item: { name: "asc" } }] })).filter(
        (ci) => ci.item.active && ci.status === "AVAILABLE",
      )
    : [];
  const L = posterLayout(gifts.length);
  const posterMascots = campaign.mascotEnabled ? await db.campaignMascot.findMany({ where: { campaignId: id, showOnPoster: true }, orderBy: { sortOrder: "asc" }, take: 2 }) : [];
  // Two mascots flank the QR code; shrink them so the row stays within the 7.7 in printable width.
  const mascotIn = posterMascots.length > 1 ? Math.min(L.mascotIn, (7.7 - L.qrIn - 0.6) / 2) : L.mascotIn;
  const mascotEl = (m: (typeof posterMascots)[number]) => <DancingMascot key={m.id} {...mascotFaceProps(m)} still snow={false} size={Math.round(mascotIn * PX_PER_IN)} />;
  // At most 3 rows of 8; with more gifts than that, the last tile says "and more!".
  const { shown, more } = posterTiles(gifts);
  const gapIn = L.cols >= 8 ? 0.12 : 0.15;
  const tileWidth = L.cols > 0 ? `calc((100% - ${(L.cols - 1) * gapIn}in) / ${L.cols})` : "0";
  const steps = [
    ["Scan the code with your phone camera.", "Escanea el código con la cámara de tu teléfono."],
    [`Enter your employee number${campaign.requireLastName ? " and last name" : ""}.`, `Ingresa tu número de empleado${campaign.requireLastName ? " y apellido" : ""}.`],
    ["Pick one gift and confirm.", "Elige un regalo y confirma."],
  ];

  return (
    <div className="py-6 print:py-0">
      {/* US Letter, portrait, no page margin: browsers then print no page address, date or page number.
          The 0.4 in margin is padding on the sheet instead. Applies only while this page is printed. */}
      <style>{`@page { size: letter portrait; margin: 0; }`}</style>

      <div className="no-print mx-auto mb-4 flex w-[8.5in] max-w-full flex-wrap items-center justify-between gap-2 px-2 text-sm">
        <a href={`/admin/campaigns/${id}`} className="text-blue-700 hover:underline">
          ← Back to campaign
        </a>
        <span className="text-xs text-slate-600">US Letter · 8.5 × 11 in · print at 100% scale</span>
        <div className="flex items-center gap-3">
          <a href={`/admin/campaigns/${id}/poster${showGifts ? "?gifts=0" : ""}`} className="text-blue-700 hover:underline" data-poster-gifts-toggle>
            {showGifts ? "Hide gifts" : "Show gifts"}
          </a>
          <PrintButton />
        </div>
      </div>

      <div
        data-poster-sheet
        className="print-exact mx-auto h-[11in] w-[8.5in] overflow-hidden bg-white px-[0.4in] pb-[0.5in] pt-[0.4in] shadow-xl print:h-[10.9in] print:pb-[0.4in] print:shadow-none"
      >
        <FitToPage>
          <header className="w-full">
            {campaign.logoImageId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/images/${campaign.logoImageId}`} alt={campaign.companyName ?? ""} className="mx-auto mb-[0.12in] max-h-[0.7in]" />
            ) : (
              campaign.companyName && (
                <p className="mb-[0.08in] font-semibold text-slate-600" style={{ fontSize: "14pt" }}>
                  {campaign.companyName}
                </p>
              )
            )}
            <h1 className="font-black leading-tight tracking-tight" style={{ color: campaign.primaryColor, fontSize: `${L.headlinePt}pt` }}>
              {campaign.welcomeHeadline}
            </h1>
            {campaign.welcomeHeadlineEs && (
              <p className="font-semibold text-slate-600" style={{ fontSize: `${Math.round(L.headlinePt * 0.5)}pt` }}>
                {campaign.welcomeHeadlineEs}
              </p>
            )}
          </header>

          <section className="w-full">
            <div className="flex items-center justify-center gap-[0.3in]">
              {posterMascots[0] && mascotEl(posterMascots[0])}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/campaigns/${campaign.slug}/qr?size=1024`} alt="QR code" data-poster-qr style={{ width: `${L.qrIn}in`, height: `${L.qrIn}in` }} />
              {posterMascots[1] && mascotEl(posterMascots[1])}
            </div>
            <p className="mt-[0.08in] font-bold leading-tight" style={{ fontSize: "20pt" }}>
              Scan to choose your gift
            </p>
            <p className="font-semibold leading-tight text-slate-600" style={{ fontSize: "14pt" }}>
              Escanea para elegir tu regalo
            </p>
          </section>

          {gifts.length > 0 && (
            <section className="w-full" data-poster-gifts>
              <h2 className="mb-[0.1in] font-bold" style={{ color: campaign.primaryColor, fontSize: "15pt" }}>
                Gifts to choose from <span className="font-semibold text-slate-500">/ Regalos para elegir</span>
              </h2>
              <ul className="flex flex-wrap justify-center" style={{ gap: `${gapIn}in` }}>
                {shown.map((ci) => (
                  <li key={ci.itemId} className="break-inside-avoid" style={{ width: tileWidth }} data-poster-gift>
                    <ItemThumb src={imageSrc(ci.item, true)} alt={ci.item.name} framing={ci.item} className="rounded-lg border border-slate-200" loading="eager" />
                    <p className="mt-[0.03in] line-clamp-2 font-semibold leading-tight text-slate-900" style={{ fontSize: `${L.namePt}pt` }}>
                      {ci.item.name}
                    </p>
                    {ci.item.nameEs && (
                      <p className="line-clamp-2 leading-tight text-slate-500" style={{ fontSize: `${L.nameEsPt}pt` }}>
                        {ci.item.nameEs}
                      </p>
                    )}
                  </li>
                ))}
                {more && (
                  <li style={{ width: tileWidth }} data-poster-more>
                    <div
                      className="flex aspect-square w-full flex-col items-center justify-center rounded-lg border-2 border-dashed bg-slate-50 font-black leading-tight"
                      style={{ fontSize: `${L.namePt + 4}pt`, color: campaign.primaryColor, borderColor: campaign.accentColor }}
                    >
                      and more!
                      <span className="font-semibold text-slate-500" style={{ fontSize: `${L.nameEsPt + 1}pt` }}>
                        ¡y más!
                      </span>
                    </div>
                  </li>
                )}
              </ul>
            </section>
          )}

          <section className="w-full rounded-xl border-2 px-[0.25in] py-[0.12in] text-left" style={{ borderColor: campaign.accentColor, fontSize: "11pt" }}>
            <ol className="list-decimal space-y-[0.03in] pl-[0.25in]">
              {steps.map(([en, es]) => (
                <li key={en}>
                  {en} <span className="text-slate-500">/ {es}</span>
                </li>
              ))}
            </ol>
          </section>

          {campaign.closesAt && (
            <footer className="w-full leading-tight" data-poster-deadline>
              <p className="font-black" style={{ color: campaign.primaryColor, fontSize: "17pt" }}>
                Choose your gift by {campaign.closesAt.toLocaleDateString("en-US", { dateStyle: "long" })}
              </p>
              <p className="font-semibold text-slate-600" style={{ fontSize: "12pt" }}>
                Elige tu regalo antes del {campaign.closesAt.toLocaleDateString("es-US", { dateStyle: "long" })}
              </p>
            </footer>
          )}
        </FitToPage>
      </div>
    </div>
  );
}
