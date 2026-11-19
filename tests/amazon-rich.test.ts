import { describe, expect, it } from "vitest";
import { parseProductMetadata, parseVariants } from "@/lib/amazon";

const html = `<html><head><title>Hoodie : Amazon.com: Clothing</title></head><body>
<span id="productTitle"> Cozy Company Hoodie </span>
<div id="wayfinding-breadcrumbs_feature_div"><a>Clothing</a><a>Men</a><a> Hoodies </a></div>
<div id="feature-bullets"><ul><li><span class="a-list-item">Soft fleece, 80% cotton</span></li><li><span class="a-list-item">Machine washable &amp; durable</span></li></ul></div>
<script>var data = {"colorImages":{"initial":[{"hiRes":"https://m.media-amazon.com/images/I/A._SX679_.jpg","large":"https://m.media-amazon.com/images/I/A.jpg"},{"hiRes":"https://m.media-amazon.com/images/I/B._SX679_.jpg","large":"https://m.media-amazon.com/images/I/B.jpg"}]};
var v = {"variationValues":{"color_name":["Black","Teal"],"size_name":["S","M","L"]}};</script>
<span class="a-offscreen">$55.00</span>
</body></html>`;

describe("rich Amazon parsing", () => {
  it("collects all gallery photos without size duplicates, bullets, category and variants", () => {
    const meta = parseProductMetadata(html);
    expect(meta.title).toBe("Cozy Company Hoodie");
    expect(meta.images).toEqual(["https://m.media-amazon.com/images/I/A._SX679_.jpg", "https://m.media-amazon.com/images/I/B._SX679_.jpg"]);
    expect(meta.imageUrl).toBe(meta.images[0]);
    expect(meta.price).toBe(55);
    expect(meta.description).toBe("Soft fleece, 80% cotton\nMachine washable & durable");
    expect(meta.category).toBe("Hoodies");
    expect(meta.variants).toEqual([
      { label: "Color", values: ["Black", "Teal"] },
      { label: "Size", values: ["S", "M", "L"] },
    ]);
  });
  it("handles pages without variants", () => {
    expect(parseVariants("<html></html>")).toEqual([]);
    expect(parseProductMetadata("<html><body>Robot Check</body></html>")).toMatchObject({ source: "none", images: [], variants: [] });
  });
});
