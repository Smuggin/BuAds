import { NextResponse } from "next/server";
import { createProductsFromCampaigns } from "@/lib/products/fromCampaigns";
import { requireAuth } from "@/lib/auth/guard";

export const maxDuration = 60;

/** Create a product for each distinct campaign product-name, then regroup. */
export async function POST() {
  const denied = await requireAuth();
  if (denied) return denied;
  try {
    return NextResponse.json(await createProductsFromCampaigns());
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
