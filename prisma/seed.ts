/**
 * Minimal, non-destructive seed: ensures the demo user + built-in categories
 * exist. It does NOT create demo accounts/products/campaigns/creatives and does
 * NOT wipe domain data — real accounts/campaigns come from Meta sync, products
 * are added manually. (A prior version wiped + recreated demo data on every
 * `prisma migrate dev`, which clobbered synced accounts.)
 *
 * For a true clean slate use `npm run db:reset` (drops + re-migrates the DB).
 * Relative imports — tsx doesn't resolve the @/ alias.
 */
import { PrismaClient } from "@prisma/client";
import { DEFAULT_CATEGORIES } from "../data/categories";

const prisma = new PrismaClient();

async function main() {
  // demo user (ActivityLog actor / attachment uploader) — keyed by email
  await prisma.user.upsert({
    where: { email: "team@adshub.local" },
    update: {},
    create: { email: "team@adshub.local", name: "Performance Team", initials: "PJ" },
  });

  // built-in categories — keyed by unique name
  for (const name of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { name },
      update: { isBuiltIn: true },
      create: { name, isBuiltIn: true },
    });
  }

  // built-in automation rule: nightly ฿300 budget reset (also seeded via migration)
  await prisma.rule.upsert({
    where: { id: "rule_budget_reset" },
    update: {},
    create: {
      id: "rule_budget_reset",
      name: "รีเซ็ตงบทุกแคมเปญ · Reset all budgets",
      scope: "ทุกแคมเปญ · All campaigns",
      ifCondition: "เที่ยงคืน เวลาไทย · midnight (Bangkok)",
      thenAction: "ตั้งงบ/วัน ฿300 · Set daily budget ฿300",
      type: "clock",
      tone: "#3b6fe0",
      runs: 0,
      on: true,
    },
  });

  console.log("Seeded (non-destructive):", {
    users: await prisma.user.count(),
    categories: await prisma.category.count(),
    accounts: await prisma.adAccount.count(),
    products: await prisma.product.count(),
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
