import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Rule, RuleType } from "@/data/types";

/** Real automation rules from the DB (empty until the user creates any). */
export async function GET() {
  const rows = await prisma.rule.findMany({ orderBy: { id: "asc" } });
  const rules: Rule[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    scope: r.scope,
    ifCondition: r.ifCondition,
    thenAction: r.thenAction,
    type: r.type as RuleType,
    tone: r.tone,
    runs: r.runs,
    lastRun: r.lastRunAt ? r.lastRunAt.toISOString().slice(0, 10) : "—",
    on: r.on,
  }));
  return NextResponse.json(rules);
}
