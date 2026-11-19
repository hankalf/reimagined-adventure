import "server-only";
import { cookies, headers } from "next/headers";
import { LANG_COOKIE, pickLang, type Lang } from "@/i18n";

export async function getLang(explicit?: string | null): Promise<Lang> {
  const [store, h] = await Promise.all([cookies(), headers()]);
  return pickLang(explicit, store.get(LANG_COOKIE)?.value, h.get("accept-language"));
}
