import { describe, expect, it } from "vitest";
import { amazonHost, cartAsin, cartUrl, planAmazonCart } from "@/lib/amazon-cart";

describe("amazon cart", () => {
  it("builds an add-to-cart link with ASINs and quantities", () => {
    expect(cartUrl("www.amazon.com", [{ asin: "B0CHWRXH8B", quantity: 3 }, { asin: "B09B8V1LZ3", quantity: 1 }])).toBe(
      "https://www.amazon.com/gp/aws/cart/add.html?ASIN.1=B0CHWRXH8B&Quantity.1=3&ASIN.2=B09B8V1LZ3&Quantity.2=1",
    );
  });
  it("keeps the marketplace of each product", () => {
    expect(amazonHost("https://www.amazon.co.uk/dp/B0CHWRXH8B")).toBe("www.amazon.co.uk");
    expect(amazonHost("https://amazon.ca/dp/X")).toBe("www.amazon.ca");
    expect(amazonHost(null)).toBe("www.amazon.com");
    expect(amazonHost("https://example.com/x")).toBe("www.amazon.com");
  });
  it("merges option rows of the same ASIN, flags them for a variant check, and lists non-Amazon items", () => {
    const plan = planAmazonCart([
      { itemId: "h", name: "Hoodie", asin: "B07P5RTMQ6", productUrl: "https://www.amazon.com/dp/B07P5RTMQ6", quantity: 2, optionText: "Teal / M" },
      { itemId: "h", name: "Hoodie", asin: "B07P5RTMQ6", productUrl: "https://www.amazon.com/dp/B07P5RTMQ6", quantity: 1, optionText: "Black / L" },
      { itemId: "e", name: "Earbuds", asin: "b0chwrxh8b", productUrl: "https://www.amazon.com/dp/B0CHWRXH8B", quantity: 4 },
      { itemId: "m", name: "Company mug", asin: null, productUrl: "https://shop.example.com/mug", quantity: 5 },
      { name: "Nothing to order", asin: "B09B8V1LZ3", productUrl: null, quantity: 0 },
    ]);
    expect(plan.totalUnits).toBe(7);
    expect(plan.links).toHaveLength(1);
    expect(plan.links[0].lines).toEqual([
      { asin: "B07P5RTMQ6", name: "Hoodie", quantity: 3 },
      { asin: "B0CHWRXH8B", name: "Earbuds", quantity: 4 },
    ]);
    expect(plan.checkVariants).toEqual([{ name: "Hoodie", asin: "B07P5RTMQ6", options: ["Teal / M × 2", "Black / L × 1"] }]);
    expect(plan.notOnAmazon).toEqual([{ name: "Company mug", quantity: 5 }]);
    expect(plan.itemIds).toEqual(["h", "e"]);
  });
  it("reads the ASIN from an Amazon link when the ASIN field is blank", () => {
    expect(cartAsin(null, "https://www.amazon.com/Company-Hoodie/dp/B07P5RTMQ6?th=1")).toBe("B07P5RTMQ6");
    expect(cartAsin(" b0chwrxh8b ", null)).toBe("B0CHWRXH8B");
    expect(cartAsin(null, "https://shop.example.com/dp/B07P5RTMQ6")).toBeNull();
    expect(cartAsin("not-an-asin", null)).toBeNull();
    const plan = planAmazonCart([{ itemId: "h", name: "Hoodie", asin: null, productUrl: "https://www.amazon.ca/dp/B07P5RTMQ6", quantity: 2 }]);
    expect(plan.links.map((l) => l.url)).toEqual(["https://www.amazon.ca/gp/aws/cart/add.html?ASIN.1=B07P5RTMQ6&Quantity.1=2"]);
    expect(plan.notOnAmazon).toEqual([]);
  });
  it("splits large orders into several links and separates marketplaces", () => {
    const many = Array.from({ length: 45 }, (_, i) => ({ name: `Item ${i}`, asin: `B0000000${String(i).padStart(2, "0")}`, productUrl: null, quantity: 1 }));
    const uk = { name: "UK thing", asin: "B0UKUKUKUK", productUrl: "https://www.amazon.co.uk/dp/B0UKUKUKUK", quantity: 2 };
    const plan = planAmazonCart([...many, uk], 20);
    const us = plan.links.filter((l) => l.host === "www.amazon.com");
    expect(us.map((l) => [l.part, l.parts, l.lines.length])).toEqual([[1, 3, 20], [2, 3, 20], [3, 3, 5]]);
    expect(plan.links.find((l) => l.host === "www.amazon.co.uk")?.url).toBe("https://www.amazon.co.uk/gp/aws/cart/add.html?ASIN.1=B0UKUKUKUK&Quantity.1=2");
  });
});
