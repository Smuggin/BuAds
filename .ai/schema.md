# .ai/schema.md — Backend data model (design, build later)

Design-only for now (AGENTS.md scopes persistence out until after the UI phases).
Target stack: **Postgres + Prisma**. The schema mirrors `data/types.ts` (the current
in-memory contracts) + adds a Meta cache and auth/secrets. **Implementation = Phase 9**
(see `.ai/workflow.md`); this is the reviewable design that de-risks it.

Guiding principle (unchanged): **verdict / status / on-off are never stored** — they are
derived at read by `lib/kpi.ts` from cached metrics (`InsightSnapshot`) + product
thresholds (`Product`). The DB stores facts; the engine judges them.

## Three groups

1. **Domain** — what is mock today (products, thresholds, categories, accounts, mapping).
2. **Meta cache** — mirrors of pulled Meta objects (campaigns, ad sets, ads, creatives, insights) for rate-limit-aware reads.
3. **Auth & secrets** — users, encrypted tokens, OAuth grants.

## Prisma schema (sketch)

```prisma
// ---------------- Auth & secrets ----------------
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  initials  String   // actor avatar, e.g. "PJ"
  role      String   @default("member")
  createdAt DateTime @default(now())
  logs      ActivityLog[]
  tokens    MetaToken[]
}

model MetaToken {
  id            String   @id @default(cuid())
  kind          TokenKind            // USER | SYSTEM
  accessTokenEnc Bytes               // encrypted at rest — never sent to the client
  scopes        String[]             // ads_read, ads_management, business_management
  businessId    String?
  expiresAt     DateTime?
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  createdAt     DateTime @default(now())
}
enum TokenKind { USER SYSTEM }

// ---------------- Domain ----------------
model AdAccount {
  id            String   @id @default(cuid())
  metaAccountId String   @unique          // act_… (the real relation key)
  name          String
  platform      String                    // "Meta · FB + IG"
  initials      String
  color         String
  currency      String   @default("THB")
  connected     Boolean  @default(true)
  status        ConnStatus @default(ACTIVE)
  lastSyncAt    DateTime?
  products      ProductAccount[]
  campaigns     Campaign[]
}
enum ConnStatus { ACTIVE SYNCING WARNING }

model Category {
  id        String  @id @default(cuid())
  name      String  @unique
  isBuiltIn Boolean @default(false)       // built-ins (Skincare…) not removable
  products  Product[]
}

model Product {
  id         String  @id @default(cuid())
  sku        String  @unique
  thName     String
  enName     String
  unitCost   Int                          // ฿ major units
  imgUrl     String?
  custom     Boolean @default(false)
  autoClose  Boolean @default(true)
  categoryId String
  category   Category @relation(fields: [categoryId], references: [id])
  // thresholds (min: roas,ctr · max: cpa,cpm,cpp,cpr,cost). Editing these = a real
  // persisted change + an ActivityLog(KPI_EDIT) row (no separate "override" table).
  thrRoas Float
  thrCtr  Float
  thrCpa  Int
  thrCpm  Int
  thrCpp  Int
  thrCpr  Int
  thrCost Int
  accounts  ProductAccount[]
  campaigns Campaign[]
}

model ProductAccount {                     // product ↔ many ad accounts
  productId   String
  adAccountId String
  product     Product   @relation(fields: [productId], references: [id])
  adAccount   AdAccount @relation(fields: [adAccountId], references: [id])
  @@id([productId, adAccountId])
}

// ---------------- Meta cache ----------------
model Campaign {
  id             String   @id @default(cuid())
  metaCampaignId String   @unique
  name           String
  status         AdStatus                  // ACTIVE | PAUSED (mirror of Meta)
  effectiveStatus String?
  objective      String?
  dailyBudgetMinor Int                      // satang (minor units) — matches Meta writes
  statusSource   ChangeActor @default(META) // so automation won't re-pause a manual resume
  adAccountId    String
  adAccount      AdAccount @relation(fields: [adAccountId], references: [id])
  productId      String?
  product        Product?  @relation(fields: [productId], references: [id])
  syncedAt       DateTime
  adsets         AdSet[]
  creatives      CampaignCreative[]
  insights       InsightSnapshot[]
}
enum AdStatus { ACTIVE PAUSED }

model AdSet {
  id            String  @id @default(cuid())
  metaAdSetId   String  @unique
  campaignId    String
  campaign      Campaign @relation(fields: [campaignId], references: [id])
  name          String
  status        AdStatus
  dailyBudgetMinor Int?
  optimizationGoal String?
  billingEvent  String?
  targeting     Json?                       // age/gender/geo from Meta
  syncedAt      DateTime
}

model Creative {
  id             String  @id @default(cuid())
  metaCreativeId String  @unique
  name           String
  format         CreativeFormat
  thumbnailUrl   String?
  productId      String?
  product        Product? @relation(fields: [productId], references: [id])
  syncedAt       DateTime
  campaigns      CampaignCreative[]
  insights       InsightSnapshot[]
}
enum CreativeFormat { VIDEO REELS CAROUSEL IMAGE }

model CampaignCreative {
  campaignId String
  creativeId String
  campaign   Campaign @relation(fields: [campaignId], references: [id])
  creative   Creative @relation(fields: [creativeId], references: [id])
  @@id([campaignId, creativeId])
}

model InsightSnapshot {
  id          String   @id @default(cuid())
  level       InsightLevel                 // ACCOUNT|CAMPAIGN|ADSET|AD|CREATIVE
  window      String                       // "last_7d" | "last_30d" | "last_90d"
  campaignId  String?
  creativeId  String?
  adAccountId String?
  campaign    Campaign? @relation(fields: [campaignId], references: [id])
  creative    Creative? @relation(fields: [creativeId], references: [id])
  // metrics — major-unit decimals; the 7 judged KPIs derive from these
  spend       Decimal
  impressions Int
  clicks      Int
  ctr         Float
  cpm         Float
  reach       Int
  frequency   Float
  roas        Float                         // from purchase_roas
  purchases   Int
  cpa         Float
  cpp         Float                         // OUR cost/purchase (cost_per_action_type[purchase])
  cpr         Float
  // audience breakdowns (spend-weighted arrays) for the Breakdown view
  audience    Json?                         // { age[6], gender[3], province[8], day[7], hour[12] }
  fetchedAt   DateTime
  @@index([level, window, campaignId])
  @@index([level, window, creativeId])
}
enum InsightLevel { ACCOUNT CAMPAIGN ADSET AD CREATIVE }

// ---------------- Automation, activity, notifications ----------------
model Rule {
  id          String  @id @default(cuid())
  name        String
  scope       String
  ifCondition String
  thenAction  String
  type        String                        // pause|trendUp|trendDown|clock|bell
  tone        String
  runs        Int     @default(0)
  lastRunAt   DateTime?
  on          Boolean @default(true)
  metaRuleId  String?                        // if mirrored to Meta adrules_library
  logs        ActivityLog[]
}

model ActivityLog {
  id         String   @id @default(cuid())
  occurredAt DateTime @default(now())
  actor      ChangeActor                     // MANUAL | AUTO
  userId     String?                         // when MANUAL
  ruleId     String?                         // when AUTO
  user       User?    @relation(fields: [userId], references: [id])
  rule       Rule?    @relation(fields: [ruleId], references: [id])
  type       LogType                         // BUDGET_UP|BUDGET_DOWN|PAUSE|RESUME|AUTO_CLOSE|SCALE|KPI_EDIT
  campaignId String?
  productId  String?
  title      String
  detail     String
  beforeVal  String?
  afterVal   String?
  @@index([occurredAt])
}
enum ChangeActor { MANUAL AUTO META }
enum LogType { BUDGET_UP BUDGET_DOWN PAUSE RESUME AUTO_CLOSE SCALE KPI_EDIT }

model Notification {
  id        String   @id @default(cuid())
  kind      String                           // success|warn|info
  title     String
  detail    String
  createdAt DateTime @default(now())
  readAt    DateTime?
}
```

## How the prototype's override maps collapse into the DB

The store's session-only override maps become **real persisted edits + an audit row** —
no separate override tables:

| Prototype store | Persisted as | + log |
|---|---|---|
| `budgetOverride[id]` | `Campaign.dailyBudgetMinor` (also written to Meta) | `ActivityLog(BUDGET_UP/DOWN)` |
| `prodThr[sku][k]` | `Product.thr*` columns | `ActivityLog(KPI_EDIT)` |
| `autoOverride[sku]` | `Product.autoClose` | — |
| `campOverride[id]` | `Campaign.status` + `statusSource=MANUAL` | `ActivityLog(PAUSE/RESUME)` |
| `connOverride[id]` | `AdAccount.connected` | — |
| `customProducts`, `customCats` | rows in `Product` / `Category` | — |

`statusSource=MANUAL` is the key addition: it tells the automation engine **not** to
re-pause a campaign a human deliberately re-enabled.

## Decisions pinned

- **Money units:** budgets stored in **minor units** (`Int` satang) to match Meta writes; insight monetary metrics stored as **`Decimal` major units**. Convert at the edges (`lib/meta/map.ts`, `lib/format.ts`). Mirrors `.ai/meta-integration.md` gotcha #1.
- **Our `cpp` ≠ Meta `cpp`:** `InsightSnapshot.cpp` holds *cost per purchase* (from `cost_per_action_type[purchase]`), not Meta's reach-based `cpp`.
- **Derived stays derived:** no `verdict`/`on`/`statusLabel` columns — `lib/kpi.ts` computes them from `InsightSnapshot` + `Product` thresholds at read, exactly as today.
- **Upsert by Meta id:** every cached model has a `@unique meta…Id` + `syncedAt`/`fetchedAt` for idempotent sync and staleness checks.
- **Tokens encrypted at rest** (`MetaToken.accessTokenEnc`), never exposed to the client; DB URL + encryption key in env.

## `data/types.ts` → model mapping

`Product→Product`, `Campaign→Campaign(+InsightSnapshot for metrics)`, `Creative→Creative(+InsightSnapshot)`, `AudienceProfile→InsightSnapshot.audience`, `Rule→Rule`, `LogEntry→ActivityLog`, `Notification→Notification`, `Category→Category`, `ConnectionAccount/AccountKey→AdAccount`. The `data/types.ts` interfaces stay as the **API DTO shapes**; `app/api/*` maps Prisma rows → those DTOs, so the UI never changes.

## Phase 9 build steps (later)

1. `prisma init` (Postgres), translate this sketch to `schema.prisma`, first migration.
2. Seed script from `data/*.ts` → DB (preserves the demo data).
3. Swap `app/api/*` bodies: `data/*` reads → Prisma reads (DTOs unchanged).
4. Write endpoints / server actions for budget, threshold, toggle, category, catalog — replacing store-only mutations, each emitting an `ActivityLog`.
5. Wire `lib/meta/` sync to upsert the cache tables (Phase 10).
