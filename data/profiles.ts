/**
 * Audience profile seed (keyed A/B/C, referenced by creatives) + label arrays.
 * Aggregations are spend-weighted across creatives (see lib/kpi.ts aggregateProfile).
 * Mirrors the reference prototype (prototype key `prov` → `province` here).
 */
import type { AudienceProfile, ProfileKey } from "./types";

export const CREATIVE_PROFILES: Record<ProfileKey, AudienceProfile> = {
  A: { age: [22, 38, 22, 11, 5, 2], gender: [72, 26, 2], province: [44, 10, 7, 8, 5, 4, 3, 3], day: [0.8, 0.85, 0.9, 0.95, 1.1, 1.35, 1.25], hour: [6, 5, 5, 8, 16, 30, 46, 55, 52, 68, 82, 64] },
  B: { age: [12, 30, 28, 18, 8, 4], gender: [54, 43, 3], province: [34, 9, 8, 7, 7, 5, 4, 4], day: [1, 1, 1.05, 1.05, 1.1, 1.0, 0.95], hour: [10, 8, 7, 9, 20, 40, 52, 58, 54, 50, 46, 30] },
  C: { age: [30, 40, 18, 8, 3, 1], gender: [60, 37, 3], province: [30, 8, 7, 12, 7, 6, 4, 4], day: [1.1, 1.05, 1, 1, 1.15, 1.2, 1.1], hour: [8, 6, 6, 14, 34, 30, 28, 34, 40, 58, 62, 40] },
};

export const AGE_LABELS = ["18–24", "25–34", "35–44", "45–54", "55–64", "65+"];
export const GENDER_LABELS = ["หญิง · Female", "ชาย · Male", "ไม่ระบุ · Unknown"];
export const GENDER_COLORS = ["#3b6fe0", "#16181d", "#c2c7cf"];
export const PROVINCE_LABELS = [
  "กรุงเทพฯ · Bangkok",
  "นนทบุรี",
  "สมุทรปราการ",
  "เชียงใหม่ · CM",
  "ชลบุรี",
  "ขอนแก่น",
  "นครราชสีมา",
  "สงขลา",
];
export const DAY_LABELS = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"];
