import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { publicOrigin, publicUrl } from "@/lib/public-url";

function req(url: string, headers: Record<string, string> = {}) {
  return new NextRequest(url, { headers });
}

describe("publicOrigin", () => {
  it("prefers APP_URL", () => {
    process.env.APP_URL = "https://gifts.example.com/";
    expect(publicOrigin(req("http://localhost:8080/g/x"))).toBe("https://gifts.example.com");
    expect(publicUrl(req("http://localhost:8080/g/x"), "/g/x?lang=es").toString()).toBe("https://gifts.example.com/g/x?lang=es");
    delete process.env.APP_URL;
  });
  it("falls back to forwarded headers, then the request host", () => {
    delete process.env.APP_URL;
    expect(publicOrigin(req("http://localhost:8080/admin", { "x-forwarded-proto": "https", "x-forwarded-host": "gifts.up.railway.app" }))).toBe("https://gifts.up.railway.app");
    expect(publicOrigin(req("http://localhost:3000/admin", { host: "localhost:3000" }))).toBe("http://localhost:3000");
  });
});
