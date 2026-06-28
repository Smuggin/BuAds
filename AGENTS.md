# AGENTS.md — Building AdsHub

Instructions for an AI coding agent (Claude Code) building **AdsHub**, a Meta/Facebook Ads management suite for a Thai performance‑marketing team. Read `DESIGN.md` first — it is the visual + functional source of truth. The original prototype lives in `reference/AdsHub.prototype.dc.html` (a self‑contained reference; open it in a browser to see the intended result).

> **In this repo now:** `DESIGN.md` (visual + functional source of truth) and `reference/` — the untouched prototype: `AdsHub.standalone.html` (open in any browser, works offline) and `AdsHub.prototype.dc.html` (+ `support.js`). **`reference/` is read‑only: study it, never ship, import, or copy its runtime into the app.**
>
> **You will generate** (before writing app code — see "Repo setup" below): `CLAUDE.md` (root rules), `ARCHITECTURE.md` (technical structure), and the `.ai/` governance docs.

---

## Repo setup (do this FIRST, before app code)

Create the handoff scaffolding by distilling `DESIGN.md` + this file + the `reference/` prototype:

```
.ai/
  conventions.md     # TS/Next/Tailwind conventions, naming, localization, a11y, don'ts
  kpi-engine.md      # exact spec of evalCampaign / auto-close / creative ranking / aggregation
  data-contracts.md  # the typed shapes in data/types.ts + the app/api/* surface
  workflow.md        # plan→build order→checkpoints→Definition of Done
ARCHITECTURE.md      # layers (app/components/store/lib/data), server vs client, routing, theming, testing
CLAUDE.md            # short root rules pointing at AGENTS.md / DESIGN.md / ARCHITECTURE.md / .ai
```

Keep them consistent with this file and `DESIGN.md` (don't contradict the tokens, logic, or stack). `CLAUDE.md` should be brief and point to the others.

---

## What you are building

A single‑page dashboard app with 9 views (see `DESIGN.md` §3–4). It consolidates many Meta ad accounts, judges every campaign/creative against **per‑product KPI thresholds**, auto‑marks winners and auto‑closes losers, supports budget edits with a confirmation modal, logs every action (manual vs automation), and breaks down audience data (age/gender/province/day×time). UI is **mixed Thai + English**.

## Recommended stack

- **Next.js (App Router) + React + TypeScript.** Use the `app/` directory. This is a client‑heavy dashboard — most views are interactive, so mark page/leaf components with `"use client"` where they use state/handlers, and keep the root layout a server component. There is no SSR data need yet (data is mock), so don't over‑engineer server components; the value of Next here is routing, structure, and a clean path to API routes later.
- **Tailwind CSS** (or CSS Modules) — but keep the exact design tokens from `DESIGN.md` §2. If Tailwind, define the palette in `tailwind.config.ts` rather than hardcoding hex everywhere.
- **State:** start with React state + context (Zustand is fine, and plays well with the App Router). The prototype is entirely client‑side; structure for a future API. Put shared app state in a client provider mounted in the root layout.
- **Routing:** each of the 9 views can be a route under `app/` (e.g. `app/campaigns/page.tsx`) with the shell in `app/layout.tsx`, OR a single‑page view‑switcher mirroring the prototype. Prefer real routes — they're a Next.js strength — but the **campaign detail must stay an in‑page state swap on the Campaigns view** (not a separate route), per `DESIGN.md` §4.2. Use a query param (`?campaign=<id>`) if you want it linkable without a full navigation.
- **Charts:** the visuals are simple (bars, stacked bars, heatmap grid). Hand‑build with divs/flex as in the prototype, or use a light lib (visx/Recharts) — but match the calm, mono‑number aesthetic; do not introduce default chart‑library chrome (legends/gridlines) that clashes. Chart components must be client components.
- **Icons:** port the inline‑SVG set from the prototype (`DESIGN.md` §2 Iconography). Do **not** use emoji in UI. An icon lib (lucide‑react) is acceptable if you match weights/sizes.
- **Fonts:** IBM Plex Sans Thai + IBM Plex Mono — load via `next/font/google` in the root layout (gives self‑hosted, optimized fonts) and expose them as CSS variables wired into Tailwind. Mono for **all numbers**.

## Project structure (suggested — Next.js App Router)

```
app/
  layout.tsx        # root: fonts (next/font), <html>/<body>, shell (Sidebar +
                    #       TopBar + KpiSummaryStrip), client state provider
  page.tsx          # Overview (or redirect to /overview)
  overview/page.tsx
  campaigns/page.tsx   # list + in-page detail (state/query-param swap, not a route)
  creatives/page.tsx
  breakdown/page.tsx
  automation/page.tsx
  activity/page.tsx
  product-kpi/page.tsx
  catalog/page.tsx
  settings/page.tsx
src/ (or root-level)
  components/     # Card, StatusChip, Toggle, MetricCell, Modal, Avatar,
                  # icons/, charts/ (BarChart, StackedBar, Heatmap)  ← "use client"
  data/           # seed data (accounts, products, campaigns, creatives,
                  # rules, logs, notifications, categories) + types.ts
  lib/            # kpi engine (verdict, auto-close, ranking), format (money/roas/ctr)
  store/          # app state provider/hook (filters, overrides, modals, custom cats/products)
```

Mark interactive components/pages with `"use client"`. The KPI engine, formatters, types, and seed data in `lib/`/`data/` are framework‑agnostic — keep them free of React/Next imports so they're trivially unit‑testable and API‑swappable.

## Core domain logic — implement these exactly (see `DESIGN.md` §5)

1. **`evalCampaign(campaign, thresholds)`** → per‑metric `{value, ok}` for the 7 KPIs, breach count, and verdict (`marked | running | breach`). `ok = dir==='min' ? v>=thr : v<=thr`. `marked = passAll && roas >= thr.roas*1.2`.
2. **Auto‑close**: a breaching campaign with its product's `autoClose` on defaults to OFF (status "ปิดอัตโนมัติ"); user toggles act as overrides.
3. **Creative ranking**: within a campaign, sort by ROAS desc; verdict marked/ok/poor; poor defaults to closed.
4. **Aggregated audience**: spend‑weighted average of creative `AudienceProfile`s for campaign/creative breakdowns.
5. **Formatters**: money `฿` + thousands (no decimals); roas `Nx`; ctr `N%`; thresholds rendered with `≥`/`≤`.

The 7 metrics and directions: `roas(≥) ctr(≥) cpa(≤) cpm(≤) cpp(≤) cpr(≤) cost(≤)`.

## State the UI must track (from the prototype)

- `activeView`, date range, account selector.
- Campaign on/off **overrides** (vs the auto‑derived default), budget **overrides**.
- Per‑product threshold **edits** and `autoClose` overrides.
- Group‑by / group‑sort / column‑sort + direction for Campaigns.
- Creatives: selected creative, account+product filters (product list scoped to account).
- Catalog: custom products, new‑product draft, per‑product edits, edit modal target.
- Categories: custom categories + draft (built‑ins not removable).
- Modals: budget modal, history modal, edit modal. Notifications: open + read.
- Account connect/disconnect overrides; sync timestamps.

## Conventions

- **Numbers are monospace, always.** Labels follow `ไทย · English`.
- Status via chips: `bg = color@~9% alpha`, `text = color`. Perf coloring: ROAS ≥5 success, ≥4 ink, ≥3 warn, else danger — behind a `colorByPerformance` flag.
- Toggles, cards, chips, spacing per `DESIGN.md` §2. Card = white, 1px `#e9ebef`, radius 12, faint shadow.
- Dense tables get `min-width` + an `overflow-x:auto` wrapper. Truncate with ellipsis, never char‑wrap.
- Accent color (`#3b6fe0` default) should be a single token so it can be re‑themed (the prototype exposes it as a tweak with options `#3b6fe0 / #6E56CF / #1F8A5B / #16181d`).
- No gradients, no emoji UI, no left‑accent‑border rounded cards. Keep it calm and dense.

## Build order

1. Shell: root `layout.tsx` with fonts (`next/font`), Sidebar + TopBar + KPI summary strip + client state provider; route scaffolding for the 9 views.
2. Seed data + `types.ts` + the KPI engine + formatters (with unit tests on `evalCampaign`).
3. Overview (validates tables/charts/tokens).
4. Product KPI (thresholds) → Campaigns (consumes them: grouping, sorting, judging, auto‑close, budget modal, in‑page detail).
5. Creatives, Breakdown.
6. Automation, Activity log (manual vs automation tagging), Notifications bell.
7. Catalog (add/edit, photo, accounts, category) + Settings (connect/review, category manager, platforms).
8. Polish, responsive, a11y pass.

## Definition of done

- All 9 views match `DESIGN.md`. Editing a product threshold live‑re‑judges campaigns. Auto‑close behaves correctly. Budget modal with 25/50/75/100% options. Column‑sort on every campaign column. Creative filters scope product→account. Activity entries clearly tagged manual vs automation. Category manager feeds catalog dropdowns. No console errors.

## Data is currently sample/mock

The prototype uses realistic in‑memory data. Keep it in `data/` behind the same shapes so a real **Meta Marketing API** layer can replace it later — in Next.js, expose it through `app/api/*/route.ts` handlers (or server actions) and have the client read from there, so swapping mock → real API is a one‑layer change. Settings is where accounts connect. Don't hardcode data inside components.

## Out of scope (for now)

Real Meta OAuth/API, multi‑user auth, persistence/back end, TikTok/Google connectors (TikTok shows a disabled "coming soon").
