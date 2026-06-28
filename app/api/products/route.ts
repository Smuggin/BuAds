import { NextResponse } from "next/server";
import { PRODUCTS } from "@/data/products";

export function GET() {
  return NextResponse.json(PRODUCTS);
}
