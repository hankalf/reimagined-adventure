import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { qrPng, qrSvg } from "@/lib/qr";
import { appUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * QR code for a campaign's employee landing page, in the campaign's brand colour with its logo in the middle.
 * `?format=svg` for vector, `?size=1024` for larger PNGs.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/campaigns/[slug]/qr">) {
  const { slug } = await ctx.params;
  const campaign = await db.campaign.findUnique({ where: { slug }, select: { slug: true, name: true, primaryColor: true, logoImageId: true } });
  if (!campaign) return new NextResponse("Not found", { status: 404 });
  const url = `${appUrl()}/g/${campaign.slug}`;
  const logo = campaign.logoImageId ? await db.image.findUnique({ where: { id: campaign.logoImageId }, select: { data: true } }) : null;
  const brand = { color: campaign.primaryColor, logo: logo ? Buffer.from(logo.data) : null };
  const format = request.nextUrl.searchParams.get("format");
  const download = request.nextUrl.searchParams.get("download") === "1";
  if (format === "svg") {
    const svg = await qrSvg(url, brand);
    return new NextResponse(svg, {
      headers: {
        "content-type": "image/svg+xml",
        "cache-control": "no-store",
        ...(download ? { "content-disposition": `attachment; filename="${campaign.slug}-qr.svg"` } : {}),
      },
    });
  }
  const size = Math.min(2048, Math.max(128, Number(request.nextUrl.searchParams.get("size") ?? 768) || 768));
  const png = await qrPng(url, size, brand);
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      "cache-control": "no-store",
      ...(download ? { "content-disposition": `attachment; filename="${campaign.slug}-qr.png"` } : {}),
    },
  });
}
