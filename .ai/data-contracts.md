# .ai/data-contracts.md — Typed shapes + API surface

The contract between mock data (`data/`) and the UI. Types live in `data/types.ts`;
seed data in `data/*.ts`; the client reads everything through `app/api/*/route.ts` so
mock → real **Meta Marketing API** is a one-layer swap (AGENTS.md "Data is sample/mock").
Components never import seed arrays directly — they fetch from the API (or a typed
data-access hook that wraps fetch).

Derived from `reference/AdsHub.prototype.dc.html`. Verdict/status/on-off are **never**
fields — they are computed by the engine (`.ai/kpi-engine.md`).

## Shared scalars

```ts
export type AccountKey = 'SKIN' | 'MAIN' | 'FASH' | 'LAZ';   // relation keys
export type MetricKey  = 'roas' | 'ctr' | 'cpa' | 'cpm' | 'cpp' | 'cpr' | 'cost';
export type MetricDir  = 'min' | 'max';
export type Thresholds = Record<MetricKey, number>;
export type Metrics    = Record<MetricKey, number>;
export type Verdict    = 'marked' | 'running' | 'breach';
export type CreativeFormat = 'Video' | 'Reels' | 'Carousel' | 'Image';
export type ProfileKey = 'A' | 'B' | 'C';

export interface MetricDef { key: MetricKey; short: string; dir: MetricDir; money: boolean; suffix: '' | 'x' | '%'; }
```

`accountMeta` (display meta for the 4 relation keys):
```ts
// SKIN: Skincare Brand · FB+IG · 'SK' · #3b6fe0
// MAIN: ร้านหลัก TH   · FB+IG · 'TH' · #16181d
// FASH: Fashion Line  · IG    · 'FL' · #6E56CF
// LAZ:  Lazada Push   · FB    · 'LZ' · #1f8a5b
export interface AccountMeta { th: string; en: string; initials: string; color: string; }
```

## Entities (DESIGN.md §5)

```ts
export interface Product {
  sku: string; th: string; en: string;
  category: string;            // from Category list (5 built-ins + custom)
  accounts: AccountKey[];      // one product → many accounts
  unitCost: number;
  img: string | null;          // data-URL when user-uploaded
  thresholds: Thresholds;
  autoClose: boolean;
  custom?: boolean;            // user-added vs seed
}

export interface Campaign {
  id: string; name: string;
  sku: string;                 // → Product
  account: AccountKey;
  budget: number;              // daily, ฿
  metrics: Metrics;            // the 7 measured values
}

export interface Creative {
  id: string; name: string;
  format: CreativeFormat;
  sku: string;
  campaigns: string[];         // campaign ids this creative runs in
  profileKey: ProfileKey;      // → AudienceProfile
  spend: number; impressions: number;
  roas: number; ctr: number; cpa: number; purchases: number; frequency: number;
}

export interface AudienceProfile {
  age: number[];      // length 6  → ['18–24','25–34','35–44','45–54','55–64','65+']
  gender: number[];   // length 3  → [female, male, unknown]
  province: number[]; // length 8
  day: number[];      // length 7  → [จ,อ,พ,พฤ,ศ,ส,อา]
  hour: number[];     // length 12 → 2-hour buckets across the day
}

export interface Rule {
  id: string; name: string; scope: string;
  ifCondition: string; thenAction: string;
  type: 'pause' | 'trendUp' | 'trendDown' | 'clock' | 'bell';  // icon/type
  tone: string;       // accent color for the type
  runs: number; lastRun: string; on: boolean;
}

export interface LogEntry {
  id: string; day: LogDayKey; time: string;
  campaignId?: string; sku?: string;     // subject is one or the other
  actor: 'manual' | 'auto';
  type: 'budget_up'|'budget_down'|'pause'|'resume'|'auto_close'|'scale'|'kpi_edit';
  title: string; detail: string;
  ruleName?: string;                     // present on automation entries
}
export type LogDayKey = 'today' | 'yesterday' | string;  // + dated buckets

export interface Notification {
  id: string; kind: 'success' | 'warn' | 'info';
  time: string; title: string; detail: string;
}

export type Category = string;  // defaults: Skincare, Fashion, Bundle, Beauty, Other
```

### Presentation-only datasets

These are pre-aggregated display rows in the prototype; keep them typed and seeded, to
be replaced by API aggregations later.

```ts
// Overview KPI strip (6 cards) — value strings + delta + tone
export interface SummaryCard { en: string; th: string; value: string; delta: string; tone: 'pos'|'neg'|'neutral'; up: boolean; }

// Overview accounts table (6 rows) — display strings + raw spend for share math
export interface OverviewAccountRow { name: string; platform: string; initials: string; spend: string; revenue: string; roas: string; purchases: string; cpa: string; ctr: string; status: 'Active'|'Paused'; rawSpend: number; }

// Overview daily-spend chart: number[] (30 values)
// Overview breakdown / Breakdown page seed:
//   ageData:     [label, pct, roas][]   (6)
//   genderData:  [label, pct, roas, color][] (3)
//   provinceData:[label, pct, roas][]   (8)
//   heatData:    { days: string[7], grid: number[7][12] }

// Settings — connection accounts (distinct from the 4 relation keys)
export interface ConnectionAccount {
  id: string; name: string; platform: string; initials: string; color: string;
  connected: boolean; status: 'active'|'syncing'|'warning';
  lastSync: string; spend?: string; products?: number;
}
export interface AvailableAccount { id: string; name: string; platform: string; initials: string; color: string; }
```

> Note: there are **two** notions of "account". `AccountKey` (SKIN/MAIN/FASH/LAZ) is the
> relational key joining products/campaigns/creatives. `ConnectionAccount` /
> `OverviewAccountRow` are the richer Settings/Overview lists. Keep them separate; do not
> try to force one into the other.

## Static config (constants, not API)

`METRIC_DEFS`, `accountMeta`, label arrays (`ageLabels`, `genderLabels`, `provLabels`),
`fmtMeta` (format → icon/color), `ramp` (categorical), `creativeProfiles` (A/B/C),
nav/titles, `rangeDef`. These are app constants in `data/` or `lib/`, imported directly.

## API surface (`app/api/*/route.ts`)

Read-only `GET` handlers returning JSON from `data/`. One route per resource; the client
fetches on mount (or via a thin typed `lib/api.ts` wrapper). Mutations (budget edits,
toggles, threshold edits, catalog/category/connection changes) stay **client-side in the
Zustand store** for now (no persistence) — the API is the read seam for the future Meta layer.

| Route | Returns |
|---|---|
| `GET /api/overview` | `{ summary: SummaryCard[], daily: number[], accounts: OverviewAccountRow[], breakdown: {...} }` |
| `GET /api/products` | `Product[]` |
| `GET /api/campaigns` | `Campaign[]` |
| `GET /api/creatives` | `Creative[]` |
| `GET /api/rules` | `Rule[]` |
| `GET /api/logs` | `LogEntry[]` |
| `GET /api/notifications` | `Notification[]` |
| `GET /api/categories` | `Category[]` |
| `GET /api/settings` | `{ connected: ConnectionAccount[], available: AvailableAccount[] }` |

Each route imports its seed from `data/` and returns it verbatim (typed). Keep the seed
values **identical to the prototype** so the rebuild is visually faithful.

## Store-owned mutable state (Zustand)

Mirrors the prototype's `state`. Reads merge over API/seed via the `eff*` resolvers:

- `activeView`, `range`, account selector.
- `campOverride: Record<id, boolean>`, `budgetOverride: Record<id, number>`.
- `prodThr: Record<sku, Partial<Thresholds>>`, `autoOverride: Record<sku, boolean>`.
- `groupBy`, `groupSort`, `groupDir`, `campSort`, `campDir`.
- `selectedCreative`, `mediaAcc`, `mediaProd` (product list scoped to account).
- `customProducts: Product[]`, `newProd` draft, `prodEdits: Record<sku, Partial<Product>>`, `editModal`.
- `customCats: string[]`, `newCat`.
- `budgetModal`, `historyModal`, `campDetail` (selected campaign id — **in-page**, not a route), `creativeOpen: Record<id, boolean>`.
- `notifOpen`, `notifRead`.
- `connOverride: Record<id, boolean>`, `syncMap: Record<id, string>`, `logActor`.

Resolver helpers (pure, live alongside the store or in `lib/`): `effThresholds`,
`effAutoClose`, `effBudget`, `effProduct`, `isConnected`, `allCategories`.
