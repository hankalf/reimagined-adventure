import { describe, expect, it } from "vitest";
import { canonicalAmazonUrl, extractAsin, isAmazonUrl, parseProductMetadata } from "@/lib/amazon";

describe("extractAsin", () => {
  it("handles the common URL shapes", () => {
    expect(extractAsin("https://www.amazon.com/dp/B0CHWRXH8B")).toBe("B0CHWRXH8B");
    expect(extractAsin("https://www.amazon.com/Some-Product-Name/dp/B0CHWRXH8B/ref=sr_1_3?keywords=x")).toBe("B0CHWRXH8B");
    expect(extractAsin("https://www.amazon.com/gp/product/B08KFWF6GC?th=1")).toBe("B08KFWF6GC");
    expect(extractAsin("https://www.amazon.co.uk/gp/aw/d/B07ZK7ZRJ2")).toBe("B07ZK7ZRJ2");
    expect(extractAsin("https://amazon.ca/dp/b00006jsua")).toBe("B00006JSUA");
    expect(extractAsin("https://www.amazon.com/exec/obidos/ASIN/0596009208")).toBe("0596009208");
  });
  it("accepts a bare ASIN and a query parameter", () => {
    expect(extractAsin("B0CHWRXH8B")).toBe("B0CHWRXH8B");
    expect(extractAsin("https://www.amazon.com/s?asin=B0CHWRXH8B")).toBe("B0CHWRXH8B");
  });
  it("returns null for junk", () => {
    expect(extractAsin("https://example.com/product/123")).toBeNull();
    expect(extractAsin("not a url")).toBeNull();
    expect(extractAsin("")).toBeNull();
  });
});

describe("canonicalAmazonUrl", () => {
  it("keeps the regional marketplace", () => {
    expect(canonicalAmazonUrl("B0CHWRXH8B", "https://www.amazon.co.uk/dp/B0CHWRXH8B")).toBe("https://www.amazon.co.uk/dp/B0CHWRXH8B");
    expect(canonicalAmazonUrl("B0CHWRXH8B", "https://amazon.ca/dp/B0CHWRXH8B")).toBe("https://www.amazon.ca/dp/B0CHWRXH8B");
    expect(canonicalAmazonUrl("b0chwrxh8b")).toBe("https://www.amazon.com/dp/B0CHWRXH8B");
  });
});

describe("isAmazonUrl", () => {
  it("recognises Amazon hosts and short links", () => {
    expect(isAmazonUrl("https://www.amazon.com/dp/B0CHWRXH8B")).toBe(true);
    expect(isAmazonUrl("https://a.co/d/abc")).toBe(true);
    expect(isAmazonUrl("https://www.notamazon.com/")).toBe(false);
  });
});

describe("parseProductMetadata", () => {
  it("reads Open Graph tags and prices", () => {
    const html = `<html><head><meta property="og:title" content="Great Earbuds : Amazon.com: Electronics"><meta property="og:image" content="https://m.media-amazon.com/img.jpg"><meta name="description" content="Nice &amp; small"></head><body><span class="a-offscreen">$69.99</span></body></html>`;
    expect(parseProductMetadata(html)).toMatchObject({ title: "Great Earbuds", imageUrl: "https://m.media-amazon.com/img.jpg", price: 69.99, description: "Nice & small", source: "opengraph" });
  });
  it("reports nothing found for a bot wall", () => {
    expect(parseProductMetadata("<html><body>Robot check</body></html>").source).toBe("none");
  });
});
