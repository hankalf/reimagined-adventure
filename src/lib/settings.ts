import { db } from "./db";

export const SETTING_KEYS = {
  companyName: "company_name",
} as const;

export async function getSetting(key: string): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await db.setting.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
