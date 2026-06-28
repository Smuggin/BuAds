# ARCHITECTURE.md — AdsHub technical structure

How the code is organized and why. Pairs with `DESIGN.md` (visual/functional truth),
`AGENTS.md` (build guide), and `.ai/*` (conventions, KPI engine, data contracts, workflow).

## Stack

Next.js **App Router** + React + TypeScript (`strict`) · Tailwind (tokens in
`tailwind.config.ts`) · Zustand for app state · `next/font/google` for IBM Plex Sans Thai
+ IBM Plex Mono · hand-built div/flex charts. Data is mock, read through `app/api/*`,
structured for a future Meta Marketing API swap.

## Layers

```
app/        Routing + the 9 views + API routes. Server layout, client pages.
components/  Presentational + interactive UI (Card, StatusChip, Toggle, MetricCell,
             Modal, Avatar, icons/, charts/). "use client" where stateful.
store/       Zustand store + provider (filters, overrides, modals, drafts, custom data).
lib/         Pure, framework-agnostic: kpi.ts (engine), format.ts, resolvers, constants.
data/        types.ts + seed data, served via app/api/*. No React/Next.
```

Dependency direction is one-way: `app` → `components` → (`store`, `lib`) → `data`.
`lib/` and `data/` never import React or Next — they are unit-tested and API-swappable.

## Directory tree (target)

```
app/
  layout.tsx            # SERVER: fonts, <html>/<body>, mounts <AppProvider>, renders shell
  page.tsx              # Overview (or redirect to /overview)
  overview/page.tsx
  campaigns/page.tsx    # list + in-page detail (state/?campaign= swap, NOT a route)
  creatives/page.tsx
  breakdown/page.tsx
  automation/page.tsx
  activity/page.tsx
  product-kpi/page.tsx
  catalog/page.tsx
  settings/page.tsx
  api/
    overview/route.ts  products/route.ts     campaigns/route.ts
    creatives/route.ts rules/route.ts        logs/route.ts
    notifications/route.ts categories/route.ts settings/route.ts
components/
  shell/ Sidebar.tsx TopBar.tsx KpiSummaryStrip.tsx NotificationsBell.tsx
  ui/    Card.tsx StatusChip.tsx Toggle.tsx MetricCell.tsx Modal.tsx Avatar.tsx
  icons/ Icon.tsx (inline-SVG set)
  charts/ BarChart.tsx StackedBar.tsx Heatmap.tsx AudienceBreakdown.tsx   # "use client"
  campaigns/ CampaignGroup.tsx CampaignRow.tsx BudgetModal.tsx HistoryModal.tsx CampaignDetail.tsx
  ... (one folder per view for its leaf components)
store/
  useAppStore.ts        # Zustand store
  AppProvider.tsx       # "use client" provider mounted in layout
lib/
  kpi.ts format.ts resolvers.ts constants.ts
  kpi.test.ts format.test.ts
data/
  types.ts accounts.ts products.ts campaigns.ts creatives.ts profiles.ts
  rules.ts logs.ts notifications.ts categories.ts overview.ts settings.ts
```

## Server vs. client

- **Server:** root `layout.tsx` (fonts, shell frame), `app/api/*` route handlers.
- **Client (`"use client"`):** the store provider, every interactive page, all chart and
  control components. This is a client-heavy dashboard with no SSR data need yet — we use
  Next for routing, structure, and the API seam, not for server rendering of data.

## Routing & the campaign-detail rule

Each of the 9 views is a real route under `app/`. **Exception:** campaign detail is an
**in-page state swap** on `app/campaigns/page.tsx` — selecting a campaign sets
`campDetail` in the store and swaps the list for the detail panel (optionally synced to
`?campaign=<id>` for linkability), with **no navigation**. This is mandated by DESIGN §4.2.

## State model

Zustand holds all mutable UI/app state (see `.ai/data-contracts.md` §"Store-owned"). The
pattern is **seed/API value + override map**: products/campaigns/thresholds come from the
API; user edits live in override maps (`prodThr`, `campOverride`, `budgetOverride`,
`autoOverride`, …); pure resolvers (`effThresholds`, `effAutoClose`, `effBudget`,
`effProduct`) merge them. Views render by calling the engine with resolved values, so a
threshold edit **live-re-judges** every campaign with zero wiring — nothing derived is
stored.

## The KPI engine

`lib/kpi.ts` is the heart (full spec in `.ai/kpi-engine.md`): `evalCampaign`,
auto-close/on-off resolution, creative ranking, `aggregateProfile`, budget math,
`roasColor`. Pure functions of `(entity, thresholds, overrides, flags)`. Unit-tested in
isolation. The accent color and `colorByPerformance` flag are inputs/CSS vars, not
hardcoded.

## Theming

DESIGN §2 tokens defined once in `tailwind.config.ts`. Accent is a single CSS var
(`--accent`, 4 options) threaded through charts, daily-spend bars, heatmap alpha,
active-nav dot, primary CTA. `colorByPerformance` toggles ROAS/perf coloring → `ink`.
No hardcoded hex in components.

## Data flow

```
data/*.ts (seed) ──> app/api/*/route.ts (GET) ──> client fetch / lib/api.ts
                                                        │
                                          store (overrides, drafts, filters)
                                                        │
                                  resolvers + lib/kpi.ts (derive verdicts)
                                                        │
                                              components render
```

Swapping mock → Meta API replaces only `data/` + the route handlers.

## Testing

Vitest. `lib/kpi.test.ts` and `lib/format.test.ts` cover the engine and formatters per
`.ai/kpi-engine.md`. Pure layer means no DOM/React needed for the critical logic. Visual
parity is checked against `reference/AdsHub.standalone.html` by eye at each checkpoint.

## Out of scope (now)

Real Meta OAuth/API, auth, persistence/back end, TikTok/Google connectors (TikTok shows
a disabled "coming soon" in Settings).
