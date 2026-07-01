-- Seed the one built-in automation rule (idempotent). Runs on `prisma migrate
-- deploy` so the Automation page shows it immediately in production.
INSERT INTO "Rule" ("id", "name", "scope", "ifCondition", "thenAction", "type", "tone", "runs", "on")
VALUES (
  'rule_budget_reset',
  'รีเซ็ตงบทุกแคมเปญ · Reset all budgets',
  'ทุกแคมเปญ · All campaigns',
  'เที่ยงคืน เวลาไทย · midnight (Bangkok)',
  'ตั้งงบ/วัน ฿300 · Set daily budget ฿300',
  'clock',
  '#3b6fe0',
  0,
  true
)
ON CONFLICT ("id") DO NOTHING;