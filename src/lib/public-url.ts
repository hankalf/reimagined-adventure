import type { NextRequest } from "next/server";

/**
 * The origin employees and admins actually use. Behind Railway's proxy the request's own host is the
 * internal one (localhost:8080), so prefer APP_URL, then the forwarded headers, then the request itself.
 */
export function publicOrigin(request: NextRequest): string {
  const env = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (env) return env;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || request.nextUrl.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim() || request.headers.get("host") || request.nextUrl.host;
  return `${proto}://${host}`;
}

/** Absolute URL for a path on the public origin. */
export function publicUrl(request: NextRequest, pathAndQuery: string): URL {
  return new URL(pathAndQuery, `${publicOrigin(request)}/`);
}
