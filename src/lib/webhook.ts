import "server-only";
import { createHmac } from "node:crypto";
import { db } from "./db";
import { optionDetail, optionSummary } from "./options";
import { getSetting, setSetting } from "./settings";
import { dec } from "./utils";

/** Settings keys for the "orders spreadsheet" push integration. */
export const WEBHOOK_KEYS = {
  url: "orders_webhook_url",
  secret: "orders_webhook_secret",
  lastStatus: "orders_webhook_last_status",
  lastAt: "orders_webhook_last_at",
  lastError: "orders_webhook_last_error",
  feedToken: "orders_feed_token",
} as const;

export type OrderEventName = "test" | "selection.created" | "selection.changed" | "selection.status_changed" | "selection.needs_repick" | "selection.reset" | "item.price_updated";

export type OrderRow = {
  campaign: string;
  campaignSlug: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  department: string | null;
  gift: string;
  giftType: "PRODUCT" | "CUSTOM";
  options: string;
  optionsDetail: string;
  option1Value: string | null;
  option2Value: string | null;
  cost: number | null;
  status: string;
  confirmationCode: string;
  productUrl: string | null;
  asin: string | null;
  sku: string | null;
  selectedAt: string;
  orderedAt: string | null;
  receivedAt: string | null;
  collectedAt: string | null;
  language: string;
};

const include = { employee: true, item: true, campaign: { select: { name: true, slug: true } } } as const;

export function toOrderRow(s: {
  option1Value: string | null;
  option2Value: string | null;
  confirmationCode: string;
  status: string;
  costAtSelection: unknown;
  selectedAt: Date;
  orderedAt: Date | null;
  receivedAt: Date | null;
  collectedAt: Date | null;
  language: string;
  employee: { employeeNumber: string; firstName: string; lastName: string; department: string | null };
  item: { name: string; type: "PRODUCT" | "CUSTOM"; option1Label: string | null; option2Label: string | null; productUrl: string | null; asin: string | null; sku: string | null };
  campaign: { name: string; slug: string };
}): OrderRow {
  return {
    campaign: s.campaign.name,
    campaignSlug: s.campaign.slug,
    employeeNumber: s.employee.employeeNumber,
    firstName: s.employee.firstName,
    lastName: s.employee.lastName,
    department: s.employee.department,
    gift: s.item.name,
    giftType: s.item.type,
    options: optionSummary(s),
    optionsDetail: optionDetail(s.item, s),
    option1Value: s.option1Value,
    option2Value: s.option2Value,
    cost: dec(s.costAtSelection),
    status: s.status,
    confirmationCode: s.confirmationCode,
    productUrl: s.item.productUrl,
    asin: s.item.asin,
    sku: s.item.sku,
    selectedAt: s.selectedAt.toISOString(),
    orderedAt: s.orderedAt?.toISOString() ?? null,
    receivedAt: s.receivedAt?.toISOString() ?? null,
    collectedAt: s.collectedAt?.toISOString() ?? null,
    language: s.language,
  };
}

export async function getWebhookConfig(): Promise<{ url: string; secret: string; lastStatus: string | null; lastAt: string | null; lastError: string | null }> {
  const [url, secret, lastStatus, lastAt, lastError] = await Promise.all([
    getSetting(WEBHOOK_KEYS.url),
    getSetting(WEBHOOK_KEYS.secret),
    getSetting(WEBHOOK_KEYS.lastStatus),
    getSetting(WEBHOOK_KEYS.lastAt),
    getSetting(WEBHOOK_KEYS.lastError),
  ]);
  return { url: url ?? "", secret: secret ?? "", lastStatus, lastAt, lastError };
}

/** POST an event to the configured webhook. Never throws; records the last result in settings. */
export async function postOrderEvent(event: OrderEventName, rows: OrderRow[], extra: Record<string, unknown> = {}): Promise<{ sent: boolean; status?: number; error?: string }> {
  const { url, secret } = await getWebhookConfig();
  if (!url) return { sent: false, error: "No webhook URL configured" };
  const body = JSON.stringify({ event, sentAt: new Date().toISOString(), count: rows.length, selections: rows, ...extra });
  const headers: Record<string, string> = { "content-type": "application/json", "user-agent": "GiftPortal-Webhook/1.0", "x-giftportal-event": event };
  if (secret) headers["x-giftportal-signature"] = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { method: "POST", headers, body, signal: controller.signal });
    const ok = res.ok;
    await Promise.all([
      setSetting(WEBHOOK_KEYS.lastStatus, ok ? `ok ${res.status}` : `failed ${res.status}`),
      setSetting(WEBHOOK_KEYS.lastAt, new Date().toISOString()),
      setSetting(WEBHOOK_KEYS.lastError, ok ? "" : (await res.text().catch(() => "")).slice(0, 300)),
    ]);
    return { sent: ok, status: res.status, error: ok ? undefined : `HTTP ${res.status}` };
  } catch (err) {
    const message = err instanceof Error ? (err.name === "AbortError" ? "Timed out after 8 s" : err.message) : String(err);
    await Promise.all([setSetting(WEBHOOK_KEYS.lastStatus, "failed"), setSetting(WEBHOOK_KEYS.lastAt, new Date().toISOString()), setSetting(WEBHOOK_KEYS.lastError, message.slice(0, 300))]);
    return { sent: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

/** Load selections by id and push them as one event. Skips silently when no webhook is configured. */
export async function notifySelections(event: OrderEventName, selectionIds: string[], extra: Record<string, unknown> = {}): Promise<void> {
  if (selectionIds.length === 0) return;
  const url = await getSetting(WEBHOOK_KEYS.url);
  if (!url) return;
  const rows = await db.selection.findMany({ where: { id: { in: selectionIds } }, include });
  await postOrderEvent(event, rows.map(toOrderRow), extra);
}

export async function sendTestEvent(): Promise<{ sent: boolean; status?: number; error?: string }> {
  const sample: OrderRow = {
    campaign: "Holiday Gifts (test)",
    campaignSlug: "holiday-test",
    employeeNumber: "10001",
    firstName: "Test",
    lastName: "Employee",
    department: "Operations",
    gift: "Insulated Travel Tumbler 40 oz",
    giftType: "PRODUCT",
    options: "Teal",
    optionsDetail: "Color: Teal",
    option1Value: "Teal",
    option2Value: null,
    cost: 45,
    status: "SELECTED",
    confirmationCode: "TEST01",
    productUrl: "https://www.amazon.com/dp/B0BZYCJK89",
    asin: "B0BZYCJK89",
    sku: null,
    selectedAt: new Date().toISOString(),
    orderedAt: null,
    receivedAt: null,
    collectedAt: null,
    language: "en",
  };
  return postOrderEvent("test", [sample]);
}
