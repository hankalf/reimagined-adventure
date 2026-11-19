import Link from "next/link";
import { redirect } from "next/navigation";
import { dict, fill, formatDate, localized } from "@/i18n";
import { getEmployeeSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { imageSrcForOption } from "@/lib/image-src";
import { getLang } from "@/lib/lang";
import { qrDataUrl } from "@/lib/qr";
import { optionDetail } from "@/lib/options";
import { DancingMascot } from "@/components/dancing-mascot";
import { ItemThumb } from "@/components/item-thumb";
import { campaignAcceptsPicks, canChangeSelection } from "@/lib/selection-rules";
import { loadCampaign } from "../campaign";

export default async function DonePage({ params }: PageProps<"/g/[slug]/done">) {
  const { slug } = await params;
  const [campaign, lang] = await Promise.all([loadCampaign(slug), getLang()]);
  const t = dict(lang);
  const session = await getEmployeeSession(campaign.id);
  if (!session) redirect(`/g/${slug}`);
  if (session.preview) redirect(`/g/${slug}/pick`);

  const [selection, employee] = await Promise.all([
    db.selection.findUnique({ where: { campaignId_employeeId: { campaignId: campaign.id, employeeId: session.employeeId } }, include: { item: { include: { images: true } } } }),
    db.employee.findUniqueOrThrow({ where: { id: session.employeeId } }),
  ]);
  if (!selection) redirect(`/g/${slug}/pick`);
  if (selection.status === "NEEDS_REPICK" && campaignAcceptsPicks(campaign).ok) redirect(`/g/${slug}/pick`);

  const name = localized(lang, selection.item.name, selection.item.nameEs);
  const src = imageSrcForOption(selection.item, selection.option1Value, false);
  const canChange = campaignAcceptsPicks(campaign).ok && canChangeSelection(selection.status, campaign.allowChangeUntilOrdered);
  const pickup = localized(lang, campaign.pickupInstructions, campaign.pickupInstructionsEs) || t.done.pickupDefault;
  const statusLabel = t.done.statuses[selection.status as keyof typeof t.done.statuses] ?? selection.status;
  const codeQr = await qrDataUrl(selection.confirmationCode, 220);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="card overflow-hidden">
        <div className="flex items-center justify-center gap-4 p-6 text-center" style={{ background: `linear-gradient(135deg, ${campaign.primaryColor}, ${campaign.accentColor})` }}>
          {campaign.mascotEnabled && campaign.mascotShowOnDone && (
            <DancingMascot
              kind={campaign.mascotKind}
              faceSrc={campaign.mascotImageId ? `/api/images/${campaign.mascotImageId}?thumb=1` : null}
              faceZoom={campaign.mascotFaceZoom}
              faceOffsetX={campaign.mascotFaceOffsetX}
              faceOffsetY={campaign.mascotFaceOffsetY}
              faceRotate={campaign.mascotFaceRotate}
              faceFlip={campaign.mascotFaceFlip}
              size={90}
              snow={false}
              tapHint={t.mascot.tap}
            />
          )}
          <div>
            <div className="text-4xl">🎉</div>
            <h1 className="mt-2 text-2xl font-bold text-white">{fill(t.done.thanks, { name: employee.firstName })}</h1>
          </div>
        </div>
        <div className="grid gap-6 p-6 sm:grid-cols-5">
          <div className="sm:col-span-2">
            <ItemThumb src={src} alt={name} framing={{ thumbFit: selection.item.thumbFit }} className="rounded-xl border border-slate-100" loading="eager" />
          </div>
          <div className="sm:col-span-3">
            <p className="text-sm uppercase tracking-wide text-slate-500">{t.done.youChose}</p>
            <h2 className="text-xl font-semibold text-slate-900">{name}</h2>
            {(selection.option1Value || selection.option2Value) && <p className="text-slate-700">{optionDetail(selection.item, selection)}</p>}
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-slate-500">{t.done.confirmationCode}</dt>
                <dd className="font-mono text-lg font-bold tracking-wider text-slate-900">{selection.confirmationCode}</dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <dt className="text-slate-500">{t.done.status}</dt>
                <dd className="font-semibold text-slate-900">{statusLabel}</dd>
                <dd className="text-xs text-slate-500">{formatDate(selection.selectedAt, lang)}</dd>
              </div>
            </dl>
            <div className="mt-4 flex items-center gap-4 rounded-lg border border-dashed border-slate-300 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={codeQr} alt={selection.confirmationCode} width={110} height={110} className="h-[110px] w-[110px] shrink-0 rounded bg-white" />
              <p className="text-sm text-slate-700">{t.done.showAtPickup}</p>
            </div>
            <div className="mt-5">
              <h3 className="font-semibold text-slate-900">{t.done.pickupTitle}</h3>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{pickup}</p>
            </div>
            <p className="mt-4 text-xs text-slate-500">{t.done.saveThis}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              {canChange ? (
                <Link href={`/g/${slug}/pick?change=1`} className="btn-secondary">
                  {t.done.changeGift}
                </Link>
              ) : (
                <p className="text-xs text-slate-500">{t.done.lockedHint}</p>
              )}
              <a href={`/g/${slug}/logout`} className="btn-ghost">
                {fill(t.pick.notYou, { name: employee.firstName })}
              </a>
            </div>
            {canChange && <p className="mt-2 text-xs text-slate-500">{t.done.changeHint}</p>}
          </div>
        </div>
      </div>
    </main>
  );
}
