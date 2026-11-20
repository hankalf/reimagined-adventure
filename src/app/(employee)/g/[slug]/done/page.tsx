import Link from "next/link";
import { redirect } from "next/navigation";
import { dict, fill, formatDate, formatDateTime, localized } from "@/i18n";
import { getEmployeeSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { imageSrcForOption } from "@/lib/image-src";
import { getLang } from "@/lib/lang";
import { qrDataUrl } from "@/lib/qr";
import { optionDetail } from "@/lib/options";
import { DancingMascot } from "@/components/dancing-mascot";
import { mascotFaceProps } from "@/lib/mascot";
import { ItemThumb } from "@/components/item-thumb";
import { campaignAcceptsPicks, changeState } from "@/lib/selection-rules";
import { loadCampaign } from "../campaign";

export default async function DonePage({ params }: PageProps<"/g/[slug]/done">) {
  const { slug } = await params;
  const [campaign, lang] = await Promise.all([loadCampaign(slug), getLang()]);
  const t = dict(lang);
  const session = await getEmployeeSession(campaign.id);
  if (!session) redirect(`/g/${slug}`);
  if (session.preview) redirect(`/g/${slug}/pick`);

  const [selection, employee, mascots] = await Promise.all([
    db.selection.findUnique({ where: { campaignId_employeeId: { campaignId: campaign.id, employeeId: session.employeeId } }, include: { item: { include: { images: true } } } }),
    db.employee.findUniqueOrThrow({ where: { id: session.employeeId } }),
    campaign.mascotEnabled ? db.campaignMascot.findMany({ where: { campaignId: campaign.id, showOnDone: true }, orderBy: { sortOrder: "asc" }, take: 3 }) : Promise.resolve([]),
  ]);
  if (!selection) redirect(`/g/${slug}/pick`);
  if (selection.status === "NEEDS_REPICK" && campaignAcceptsPicks(campaign).ok) redirect(`/g/${slug}/pick`);

  const name = localized(lang, selection.item.name, selection.item.nameEs);
  const src = imageSrcForOption(selection.item, selection.option1Value, false);
  const accepting = campaignAcceptsPicks(campaign).ok;
  const change = changeState(selection, campaign);
  const canChange = accepting && change.ok;
  // Why the gift can't be changed, in the employee's words.
  const lockedText =
    !change.ok && change.reason === "window_closed" ? t.done.windowClosedHint : !change.ok && change.reason === "ordered" ? t.done.lockedHint : t.done.finalHint;
  const [untilBefore, untilAfter] = t.done.changeHintUntil.split("{time}");
  const pickup = localized(lang, campaign.pickupInstructions, campaign.pickupInstructionsEs) || t.done.pickupDefault;
  const statusLabel = t.done.statuses[selection.status as keyof typeof t.done.statuses] ?? selection.status;
  const codeQr = await qrDataUrl(selection.confirmationCode, 220);

  return (
    <main className="safe-x mx-auto max-w-3xl py-5 sm:py-10">
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-center gap-3 p-5 text-center sm:gap-4 sm:p-6" data-done-mascots={mascots.length} style={{ background: `linear-gradient(135deg, ${campaign.primaryColor}, ${campaign.accentColor})` }}>
          {/* Phones: all mascots in one row above the title. Wider screens: they flank the title. */}
          {mascots.length > 1 && (
            <div className="flex w-full items-end justify-center gap-3 sm:hidden">
              {mascots.map((m) => (
                <DancingMascot key={m.id} {...mascotFaceProps(m)} size={70} snow={false} tapHint={t.mascot.tap} />
              ))}
            </div>
          )}
          {mascots[0] && (
            <div className={mascots.length > 1 ? "hidden sm:block" : ""}>
              <DancingMascot {...mascotFaceProps(mascots[0])} size={mascots.length > 1 ? 80 : 90} snow={false} tapHint={t.mascot.tap} />
            </div>
          )}
          <div>
            <div className="text-4xl">🎉</div>
            <h1 className="mt-2 text-2xl font-bold text-white">{fill(t.done.thanks, { name: employee.firstName })}</h1>
          </div>
          {mascots.slice(1).map((m) => (
            <div key={m.id} className="hidden sm:block">
              <DancingMascot {...mascotFaceProps(m)} size={80} snow={false} tapHint={t.mascot.tap} />
            </div>
          ))}
        </div>
        <div className="grid gap-6 p-5 sm:grid-cols-5 sm:p-6">
          {/* Big photo on wider screens; on phones a small one sits next to the name so the code is visible right away. */}
          <div className="hidden sm:col-span-2 sm:block">
            <ItemThumb src={src} alt={name} framing={{ thumbFit: selection.item.thumbFit }} className="rounded-xl border border-slate-100" loading="eager" />
          </div>
          <div className="sm:col-span-3">
            <div className="flex items-center gap-4">
              <div className="w-20 shrink-0 sm:hidden">
                <ItemThumb src={src} alt="" framing={{ thumbFit: selection.item.thumbFit }} className="rounded-lg border border-slate-100" loading="eager" />
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-slate-500 sm:text-sm">{t.done.youChose}</p>
                <h2 className="text-lg font-semibold leading-snug text-slate-900 sm:text-xl">{name}</h2>
                {(selection.option1Value || selection.option2Value) && <p className="text-sm text-slate-700 sm:text-base">{optionDetail(selection.item, selection)}</p>}
              </div>
            </div>
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
            <div className="mt-4 flex flex-col items-center gap-3 rounded-lg border border-dashed border-slate-300 p-4 text-center sm:flex-row sm:gap-4 sm:p-3 sm:text-left" data-pickup-qr>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={codeQr} alt={selection.confirmationCode} width={160} height={160} className="h-40 w-40 shrink-0 rounded bg-white sm:h-[110px] sm:w-[110px]" />
              <p className="text-sm text-slate-700">{t.done.showAtPickup}</p>
            </div>
            <div className="mt-5">
              <h3 className="font-semibold text-slate-900">{t.done.pickupTitle}</h3>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{pickup}</p>
            </div>
            <p className="mt-4 text-xs text-slate-500">{t.done.saveThis}</p>
            {canChange &&
              (change.deadline ? (
                <p className="mt-5 text-sm text-slate-600" data-change-deadline>
                  {untilBefore}
                  <time dateTime={change.deadline.toISOString()} data-local-time className="whitespace-nowrap font-semibold">
                    {formatDateTime(change.deadline, lang)}
                  </time>
                  {untilAfter}
                </p>
              ) : (
                <p className="mt-5 text-sm text-slate-600">{t.done.changeHint}</p>
              ))}
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              {canChange ? (
                <Link href={`/g/${slug}/pick?change=1`} className="btn-secondary min-h-12 w-full text-base sm:min-h-0 sm:w-auto sm:text-sm">
                  {t.done.changeGift}
                </Link>
              ) : (
                <p className="text-xs text-slate-500" data-change-locked>
                  {lockedText}
                </p>
              )}
              <a href={`/g/${slug}/logout`} className="btn-ghost min-h-11 w-full sm:min-h-0 sm:w-auto">
                {fill(t.pick.notYou, { name: employee.firstName })}
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
