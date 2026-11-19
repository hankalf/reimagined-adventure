import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/utils";
import { PrintButton } from "./print-button";
import { FitToPage } from "./fit-to-page";
import { DancingMascot } from "@/components/dancing-mascot";
import { ItemThumb } from "@/components/item-thumb";
import { imageSrc } from "@/lib/image-src";

/** Max gift tiles on one Letter page; beyond this the last tile becomes "+N more". */
const MAX_TILES = 24;
const PX_PER_IN = 96;

/**
 * Sizes (inches / points) for a US Letter poster. Printable area with 0.4 in margins is 7.7 × 10.2 in; the
 * sheet uses 7.7 × 10.1 in to leave a little slack. Bigger catalogs get a smaller QR code and more columns.
 * FitToPage shrinks everything slightly if a tier still runs over.
 */
function posterLayout(giftCount: number) {
  if (giftCount === 0) return { qrIn: 4.6, mascotIn: 1.9, cols: 0, headlinePt: 40, namePt: 0, nameEsPt: 0 };
  if (giftCount <= 4) return { qrIn: 3.2, mascotIn: 1.5, cols: 4, headlinePt: 32, namePt: 10, nameEsPt: 8 };
  if (giftCount <= 6) return { qrIn: 3.0, mascotIn: 1.4, cols: giftCount, headlinePt: 30, namePt: 9.5, nameEsPt: 7.5 };
  if (giftCount <= 12) return { qrIn: 2.6, mascotIn: 1.3, cols: 6, headlinePt: 28, namePt: 9, nameEsPt: 7.5 };
  return { qrIn: 2.3, mascotIn: 1.2, cols: 8, headlinePt: 26, namePt: 8, nameEsPt: 7 };
}

export default async function PosterPage({ params, searchParams }: PageProps<"/admin/campaigns/[id]/poster">) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const showGifts = sp.gifts !== "0";
  const campaign = await db.campaign.findUnique({ where: { id } });
  if (!campaign) notFound();
  const url = `${appUrl()}/g/${campaign.slug}`;
  const gifts = showGifts
    ? (await db.campaignItem.findMany({ where: { campaignId: id }, include: { item: true }, orderBy: [{ sortOrder: "asc" }, { item: { name: "asc" } }] })).filter(
        (ci) => ci.item.active && ci.status === "AVAILABLE",
      )
    : [];
  const L = posterLayout(gifts.length);
  const overflow = gifts.length > MAX_TILES;
  const shown = overflow ? gifts.slice(0, MAX_TILES - 1) : gifts;
  const moreCount = gifts.length - shown.length;
  const gapIn = L.cols >= 8 ? 0.12 : 0.15;
  const tileWidth = L.cols > 0 ? `calc((100% - ${(L.cols - 1) * gapIn}in) / ${L.cols})` : "0";
  const steps = [
    ["Scan the code with your phone camera.", "Escanea el código con la cámara de tu teléfono."],
    [`Enter your employee number${campaign.requireLastName ? " and last name" : ""}.`, `Ingresa tu número de empleado${campaign.requireLastName ? " y apellido" : ""}.`],
    ["Pick one gift and confirm.", "Elige un regalo y confirma."],
  ];

  return (
    <div className="py-6 print:py-0">
      {/* US Letter, portrait. Applies only while this page is printed. */}
      <style>{`@page { size: letter portrait; margin: 0.4in; }`}</style>

      <div className="no-print mx-auto mb-4 flex w-[8.5in] max-w-full flex-wrap items-center justify-between gap-2 px-2 text-sm">
        <a href={`/admin/campaigns/${id}`} className="text-blue-700 hover:underline">
          ← Back to campaign
        </a>
        <span className="text-xs text-slate-600">US Letter · 8.5 × 11 in · print at 100% scale with default margins</span>
        <div className="flex items-center gap-3">
          <a href={`/admin/campaigns/${id}/poster${showGifts ? "?gifts=0" : ""}`} className="text-blue-700 hover:underline" data-poster-gifts-toggle>
            {showGifts ? "Hide gifts" : "Show gifts"}
          </a>
          <PrintButton />
        </div>
      </div>

      <div
        data-poster-sheet
        className="print-exact mx-auto h-[11in] w-[8.5in] overflow-hidden bg-white px-[0.4in] pb-[0.5in] pt-[0.4in] shadow-xl print:h-[10.1in] print:w-[7.7in] print:p-0 print:shadow-none"
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
              {campaign.mascotEnabled && (
                <DancingMascot
                  kind={campaign.mascotKind}
                  still
                  snow={false}
                  size={Math.round(L.mascotIn * PX_PER_IN)}
                  faceSrc={campaign.mascotImageId ? `/api/images/${campaign.mascotImageId}?thumb=1` : null}
                  faceZoom={campaign.mascotFaceZoom}
                  faceOffsetX={campaign.mascotFaceOffsetX}
                  faceOffsetY={campaign.mascotFaceOffsetY}
                  faceRotate={campaign.mascotFaceRotate}
                  faceFlip={campaign.mascotFaceFlip}
                />
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/campaigns/${campaign.slug}/qr?size=1024`} alt="QR code" data-poster-qr style={{ width: `${L.qrIn}in`, height: `${L.qrIn}in` }} />
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
                {moreCount > 0 && (
                  <li style={{ width: tileWidth }} data-poster-more>
                    <div className="flex aspect-square w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 font-bold text-slate-700" style={{ fontSize: `${L.namePt + 3}pt` }}>
                      +{moreCount}
                      <span className="font-semibold text-slate-500" style={{ fontSize: `${L.nameEsPt}pt` }}>
                        more · y más
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
            {campaign.closesAt && (
              <p className="mt-[0.06in] font-semibold">
                Choose by {campaign.closesAt.toLocaleDateString("en-US", { dateStyle: "long" })} · Elige antes del {campaign.closesAt.toLocaleDateString("es-US", { dateStyle: "long" })}
              </p>
            )}
          </section>

          <footer className="w-full text-slate-500">
            <p style={{ fontSize: "9pt" }}>Or type this link / O escribe este enlace:</p>
            <p className="break-all font-mono font-semibold text-slate-800" style={{ fontSize: "12pt" }}>
              {url}
            </p>
          </footer>
        </FitToPage>
      </div>
    </div>
  );
}
