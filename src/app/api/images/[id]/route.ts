import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Serve a stored image. `?thumb=1` returns the thumbnail. Immutable cache: image ids never change content. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/images/[id]">) {
  const { id } = await ctx.params;
  const thumb = request.nextUrl.searchParams.get("thumb") === "1";
  const image = await db.image.findUnique({ where: { id }, select: { mime: true, data: !thumb, thumb } });
  if (!image) return new NextResponse("Not found", { status: 404 });
  const bytes = thumb ? image.thumb : image.data;
  if (!bytes) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": image.mime,
      "cache-control": "public, max-age=31536000, immutable",
      "content-length": String(bytes.byteLength),
    },
  });
}
