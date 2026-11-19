import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { sendHrOrderEmail } from "@/lib/hr-email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled digest: emails HR the new selections for every OPEN campaign with digests enabled.
 * Protect with CRON_SECRET and call it from a Railway cron service:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.up.railway.app/api/cron/digest
 */
export async function GET(request: NextRequest) {
  return run(request);
}
export async function POST(request: NextRequest) {
  return run(request);
}

async function run(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? request.nextUrl.searchParams.get("secret");
  if (!secret || provided !== secret) return new NextResponse("Unauthorized", { status: 401 });

  const campaigns = await db.campaign.findMany({ where: { status: "OPEN", digestEnabled: true } });
  const results: Array<{ campaign: string; sent: boolean; newRows: number; status: string }> = [];
  for (const c of campaigns) {
    if (c.hrEmails.length === 0) {
      results.push({ campaign: c.slug, sent: false, newRows: 0, status: "no_recipients" });
      continue;
    }
    const since = c.lastHrEmailAt;
    const newCount = await db.selection.count({ where: { campaignId: c.id, status: { not: "NEEDS_REPICK" }, ...(since ? { selectedAt: { gt: since } } : {}) } });
    if (newCount === 0) {
      results.push({ campaign: c.slug, sent: false, newRows: 0, status: "nothing_new" });
      continue;
    }
    const { log } = await sendHrOrderEmail({ campaignId: c.id, mode: "new", actorType: "SYSTEM" });
    results.push({ campaign: c.slug, sent: log.status !== "FAILED", newRows: newCount, status: log.status });
  }
  return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), results });
}
