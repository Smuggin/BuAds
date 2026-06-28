import { NextResponse } from "next/server";
import {
  SUMMARY_CARDS,
  DAILY_SPEND,
  OVERVIEW_ACCOUNTS,
  AGE_DATA,
  GENDER_DATA,
  PROVINCE_DATA,
  HEAT_DATA,
} from "@/data/overview";

export function GET() {
  return NextResponse.json({
    summary: SUMMARY_CARDS,
    daily: DAILY_SPEND,
    accounts: OVERVIEW_ACCOUNTS,
    breakdown: { age: AGE_DATA, gender: GENDER_DATA, province: PROVINCE_DATA, heat: HEAT_DATA },
  });
}
