"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { dict } from "@/i18n";
import { clientIp, getEmployeeSession, setEmployeeCookie } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLang } from "@/lib/lang";
import { checkRateLimit } from "@/lib/rate-limit";
import { identifyEmployee, submitSelection } from "@/lib/selection";
import { campaignAcceptsPicks } from "@/lib/selection-rules";

export type IdentifyState = { error?: string } | null;

const identifySchema = z.object({
  slug: z.string().min(1),
  employeeNumber: z.string().trim().min(1).max(40),
  lastName: z.string().trim().max(80).optional().default(""),
});

export async function identifyAction(_prev: IdentifyState, formData: FormData): Promise<IdentifyState> {
  const lang = await getLang();
  const t = dict(lang);
  const parsed = identifySchema.safeParse({
    slug: formData.get("slug"),
    employeeNumber: formData.get("employeeNumber"),
    lastName: formData.get("lastName") ?? "",
  });
  if (!parsed.success) return { error: t.landing.notFound };
  const { slug, employeeNumber, lastName } = parsed.data;

  const campaign = await db.campaign.findUnique({ where: { slug } });
  if (!campaign) return { error: t.errors.generic };
  const window = campaignAcceptsPicks(campaign);
  if (!window.ok) return { error: window.reason === "draft" || window.reason === "not_yet_open" ? t.landing.campaignDraft : t.landing.campaignClosed };

  const ip = await clientIp();
  const perIp = checkRateLimit(`identify:ip:${ip}`, 20, 60_000);
  const perNumber = checkRateLimit(`identify:num:${campaign.id}:${employeeNumber.toUpperCase()}`, 6, 60_000);
  if (!perIp.ok || !perNumber.ok) return { error: t.landing.tooManyAttempts };

  const result = await identifyEmployee({ campaign, employeeNumber, lastName });
  if (!result.ok) return { error: result.reason === "not_eligible" ? t.errors.notEligible : t.landing.notFound };

  await setEmployeeCookie({ employeeId: result.employee.id, campaignId: campaign.id });
  redirect(`/g/${slug}/pick`);
}

export type ChooseState = { error?: string } | null;

const chooseSchema = z.object({
  slug: z.string().min(1),
  itemId: z.string().min(1),
  optionValue: z.string().trim().max(80).optional().nullable(),
});

export async function chooseAction(_prev: ChooseState, formData: FormData): Promise<ChooseState> {
  const lang = await getLang();
  const t = dict(lang);
  const parsed = chooseSchema.safeParse({
    slug: formData.get("slug"),
    itemId: formData.get("itemId"),
    optionValue: formData.get("optionValue") || null,
  });
  if (!parsed.success) return { error: t.errors.generic };
  const { slug, itemId, optionValue } = parsed.data;

  const campaign = await db.campaign.findUnique({ where: { slug } });
  if (!campaign) return { error: t.errors.generic };
  const session = await getEmployeeSession(campaign.id);
  if (!session) return { error: t.errors.sessionExpired };

  const result = await submitSelection({ campaignId: campaign.id, employeeId: session.employeeId, itemId, optionValue: optionValue ?? null, lang });
  if (!result.ok) {
    switch (result.error) {
      case "already_picked":
      case "cannot_change":
        return { error: t.errors.alreadyPicked };
      case "unavailable":
      case "unknown_item":
        return { error: t.errors.itemUnavailable };
      case "over_budget":
        return { error: t.errors.overBudget };
      case "option_required":
      case "invalid_option":
        return { error: t.pick.optionRequired.replace("{label}", "") };
      case "not_eligible":
        return { error: t.errors.notEligible };
      case "not_open":
        return { error: t.landing.campaignClosed };
      default:
        return { error: t.errors.generic };
    }
  }
  redirect(`/g/${slug}/done`);
}
