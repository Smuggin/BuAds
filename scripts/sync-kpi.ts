/**
 * One-off: sync product KPI config to match a snapshot of the local DB, matched by SKU.
 * Sets thresholds (roas/ctr/cpm/cpp) + skipMetrics + closeMode on EXISTING products only.
 * Leaves every other field (unitCost, category, image, cpa/cpr/cost thresholds) and any
 * product not listed here untouched. Idempotent — safe to re-run.
 *
 * SKUs not found in the target DB are reported, NOT created (a create needs a category +
 * unitCost we can't reliably map). If any are missing, tell us and we'll handle them.
 *
 * Usage (run against PRODUCTION yourself — keep the prod URL on your machine):
 *   DATABASE_URL="<prod connection string>" npx tsx scripts/sync-kpi.ts --dry   # preview, no writes
 *   DATABASE_URL="<prod connection string>" npx tsx scripts/sync-kpi.ts         # apply
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY = process.argv.includes("--dry");

// Snapshot of local KPI config (2026-07-02). roas/ctr/cpm are uniform; cpp + skip vary.
const KPI: {
  sku: string;
  thrRoas: number;
  thrCtr: number;
  thrCpm: number;
  thrCpp: number;
  closeMode: "OFF" | "SUGGEST" | "AUTO";
  skipMetrics: string[];
}[] = [
  { sku: "AUTO-001", thrRoas: 4, thrCtr: 1.5, thrCpm: 100, thrCpp: 70, closeMode: "SUGGEST", skipMetrics: ["cpm", "roas", "ctr", "cpr"] },
  { sku: "AUTO-002", thrRoas: 4, thrCtr: 1.5, thrCpm: 100, thrCpp: 80, closeMode: "SUGGEST", skipMetrics: ["roas", "ctr", "cpm", "cpr"] },
  { sku: "AUTO-003", thrRoas: 4, thrCtr: 1.5, thrCpm: 100, thrCpp: 100, closeMode: "SUGGEST", skipMetrics: ["roas", "ctr", "cpm", "cpr"] },
  { sku: "AUTO-004", thrRoas: 4, thrCtr: 1.5, thrCpm: 100, thrCpp: 160, closeMode: "SUGGEST", skipMetrics: ["roas", "ctr", "cpm", "cpr"] },
  { sku: "AUTO-005", thrRoas: 4, thrCtr: 1.5, thrCpm: 100, thrCpp: 160, closeMode: "SUGGEST", skipMetrics: ["roas", "ctr", "cpm", "cpr"] },
  { sku: "AUTO-006", thrRoas: 4, thrCtr: 1.5, thrCpm: 100, thrCpp: 90, closeMode: "SUGGEST", skipMetrics: ["roas", "ctr", "cpm", "cpr"] },
  { sku: "AUTO-007", thrRoas: 4, thrCtr: 1.5, thrCpm: 100, thrCpp: 65, closeMode: "SUGGEST", skipMetrics: ["roas", "ctr", "cpm", "cpr"] },
  { sku: "AUTO-008", thrRoas: 4, thrCtr: 1.5, thrCpm: 100, thrCpp: 75, closeMode: "SUGGEST", skipMetrics: ["roas", "ctr", "cpm", "cpr"] },
  { sku: "AUTO-009", thrRoas: 4, thrCtr: 1.5, thrCpm: 100, thrCpp: 160, closeMode: "SUGGEST", skipMetrics: ["roas", "ctr", "cpm", "cpr"] },
  { sku: "AUTO-010", thrRoas: 4, thrCtr: 1.5, thrCpm: 100, thrCpp: 160, closeMode: "SUGGEST", skipMetrics: ["roas", "ctr", "cpm", "cpr"] },
  { sku: "AUTO-011", thrRoas: 4, thrCtr: 1.5, thrCpm: 100, thrCpp: 160, closeMode: "SUGGEST", skipMetrics: ["cpr", "cpp", "roas", "ctr", "cpm"] },
  { sku: "AUTO-012", thrRoas: 4, thrCtr: 1.5, thrCpm: 100, thrCpp: 160, closeMode: "SUGGEST", skipMetrics: ["roas", "ctr", "cpm", "cpr"] },
  { sku: "AUTO-013", thrRoas: 4, thrCtr: 1.5, thrCpm: 100, thrCpp: 160, closeMode: "SUGGEST", skipMetrics: ["cpr", "cpp", "cpm", "roas", "ctr"] },
  { sku: "NEW-MQZ4G400", thrRoas: 4, thrCtr: 1.5, thrCpm: 100, thrCpp: 85, closeMode: "SUGGEST", skipMetrics: ["roas", "ctr", "cpm", "cpr"] },
];

function safeHost(url: string | undefined): string {
  if (!url) return "(DATABASE_URL not set)";
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return "(unparseable)";
  }
}

async function main() {
  console.log(`target DB: ${safeHost(process.env.DATABASE_URL)}`);
  console.log(DRY ? "DRY RUN — no writes\n" : "APPLYING writes\n");

  let updated = 0;
  const missing: string[] = [];
  for (const k of KPI) {
    const found = await prisma.product.findUnique({ where: { sku: k.sku }, select: { sku: true } });
    if (!found) {
      missing.push(k.sku);
      console.log(`• ${k.sku} — NOT FOUND (skipped)`);
      continue;
    }
    if (!DRY) {
      await prisma.product.update({
        where: { sku: k.sku },
        data: {
          thrRoas: k.thrRoas,
          thrCtr: k.thrCtr,
          thrCpm: k.thrCpm,
          thrCpp: k.thrCpp,
          closeMode: k.closeMode,
          skipMetrics: k.skipMetrics,
        },
      });
    }
    updated++;
    console.log(`${DRY ? "[dry] " : ""}✓ ${k.sku} → roas ${k.thrRoas} · ctr ${k.thrCtr} · cpm ${k.thrCpm} · cpp ${k.thrCpp} · ${k.closeMode} · skip ${JSON.stringify(k.skipMetrics)}`);
  }

  console.log(`\n${DRY ? "would update" : "updated"} ${updated}/${KPI.length} products; not found: ${missing.length ? missing.join(", ") : "none"}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
