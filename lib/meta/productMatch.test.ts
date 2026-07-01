import { describe, it, expect } from "vitest";
import { extractProductSegment, matchCampaignToProduct, type ProductLite } from "./productMatch";

const PRODUCTS: ProductLite[] = [
  { id: "p1", sku: "GLV-01", thName: "ถุงมือขนสัตว์" },
  { id: "p2", sku: "GLV-02", thName: "ถุงมือขนสัตว์กันหนาว" },
  { id: "p3", sku: "SRM-01", thName: "เซรั่มไบรท์เทนนิ่ง" },
  { id: "p4", sku: "DOL-01", thName: "ตุ๊กตาแมว" },
];

describe("extractProductSegment", () => {
  it("returns the Thai segment of a pipe-delimited name", () => {
    expect(extractProductSegment("09/06 | K14 | 1-3 | ถุงมือขนสัตว์ | No inter | 300")).toBe(
      "ถุงมือขนสัตว์",
    );
  });

  it("picks the longest Thai segment when several exist", () => {
    expect(extractProductSegment("K14 | เสื้อ | ถุงมือขนสัตว์กันหนาว | 300")).toBe(
      "ถุงมือขนสัตว์กันหนาว",
    );
  });

  it("falls back to the whole name without pipes/Thai", () => {
    expect(extractProductSegment("Serum – Retarget 7d")).toBe("Serum – Retarget 7d");
  });

  it("ignores Meta's สำเนา (copy) marker so the product name wins", () => {
    expect(
      extractProductSegment("08/06 | K12 | 1-3 | ตุ๊กตาแมว | No inter | 300 - สำเนา"),
    ).toBe("ตุ๊กตาแมว");
  });
});

describe("matchCampaignToProduct", () => {
  it("links the pipe-delimited Thai segment to the exact product", () => {
    expect(matchCampaignToProduct("09/06 | K14 | 1-3 | ถุงมือขนสัตว์ | No inter | 300", PRODUCTS)).toBe(
      "p1",
    );
  });

  it("prefers the most specific (longest) name on overlap", () => {
    expect(matchCampaignToProduct("K14 | ถุงมือขนสัตว์กันหนาว | 300", PRODUCTS)).toBe("p2");
  });

  it("ignores whitespace differences", () => {
    expect(matchCampaignToProduct("a | b | เซรั่ม ไบรท์เทนนิ่ง | c", PRODUCTS)).toBe("p3");
  });

  it("falls back to an exact SKU token in the name", () => {
    expect(matchCampaignToProduct("Promo SRM-01 broad", PRODUCTS)).toBe("p3");
  });

  it("returns null when nothing matches", () => {
    expect(matchCampaignToProduct("09/06 | K14 | 1-3 | กระเป๋า | No inter | 300", PRODUCTS)).toBeNull();
  });

  it("still groups a duplicated (สำเนา) campaign to its SKU", () => {
    expect(
      matchCampaignToProduct("08/06 | K12 | 1-3 | ตุ๊กตาแมว | No inter | 300 - สำเนา", PRODUCTS),
    ).toBe("p4");
    expect(
      matchCampaignToProduct("08/06 | K12 | 4-6 | ตุ๊กตาแมว | No inter | 300 - สำเนา - สำเนา", PRODUCTS),
    ).toBe("p4");
  });
});
