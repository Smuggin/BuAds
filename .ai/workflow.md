# .ai/workflow.md — Plan → build order → checkpoints → Definition of Done

How we build AdsHub. Build order is from `AGENTS.md`; this adds checkpoints and the DoD
gate. Work top-to-bottom; check in at each ▣ checkpoint before moving on.

## Operating rules

- Read `DESIGN.md` for *what*, `.ai/conventions.md` for *how*, `.ai/kpi-engine.md` for the math, `.ai/data-contracts.md` for shapes.
- The KPI engine + formatters + types + seed data are built and **unit-tested before** any view consumes them.
- `reference/` is read-only: open `AdsHub.standalone.html` in a browser to compare visuals; never import its runtime.
- Keep mutations in the store; keep reads behind `app/api/*`. Verdicts are always derived.
- No console errors at any checkpoint.

## Build order (with checkpoints)

**0. Scaffold.** `create-next-app` (App Router + TS + Tailwind). Wire DESIGN §2 tokens into `tailwind.config.ts`. Load Plex Sans Thai + Plex Mono via `next/font`, expose as CSS vars, set mono as the number font. Add the accent CSS var + `colorByPerformance` plumbing.
   ▣ **Checkpoint:** app boots, fonts render, token classes resolve, Thai text shows.

**1. Shell.** `app/layout.tsx` (server) → fonts + `<html>`/`<body>` + mount client store provider. Build `Sidebar` (dark 236px, nav with active dot + EN sub-label), `TopBar` (title/subtitle, account selector, 7D/30D/90D range, notifications bell + dropdown, Export), `KpiSummaryStrip` (6 cards). Route scaffolding for all 9 views.
   ▣ **Checkpoint:** every nav item routes; shell is sticky; bell dropdown opens/closes; KPI strip renders on every page.

**2. Engine + data.** `data/types.ts`, seed `data/*.ts` (values identical to prototype), `app/api/*` GET routes, `lib/format.ts`, `lib/kpi.ts` (`evalCampaign`, auto-close resolution, creative ranking, `aggregateProfile`, budget math, `roasColor`). **Unit tests** per `.ai/kpi-engine.md` §"What to unit-test".
   ▣ **Checkpoint:** `npm test` green; engine imported with **no** React/Next deps.

**3. Overview.** Daily-spend bars (accent, last-day highlight, avg label), spend-share stacked bar + legend, ad-accounts table (perf-colored ROAS, status chips, "+ เชื่อมบัญชี"). Validates tables/charts/tokens/formatters end-to-end.
   ▣ **Checkpoint:** Overview matches the prototype side-by-side.

**4. Product KPI → Campaigns.** Product KPI editable threshold matrix (7 numeric inputs/row + per-product auto-close toggle, `≥/≤` header marks). Then Campaigns: group-by (product/account/none), group-sort + dir, grouped tables, **click-to-sort every column** (best-first first click), per-cell green/red vs threshold, status chips, budget button → **budget modal** (25/50/75/100%), on/off toggle, auto-mark/auto-close, **in-page detail** (state swap: header, 7-metric breakdown, ranked creatives w/ toggles + "เปิดอยู่ X/Y", spend-weighted audience). History `◷` → modal.
   ▣ **Checkpoint (critical):** editing a threshold in Product KPI **live-re-judges** every campaign (cells recolor, verdicts/auto-close flip). Budget modal math correct. Every column sorts. Detail is a state swap, not a navigation.

**5. Creatives + Breakdown.** Creatives: two-column, account+product filters (**product scoped to account**), live "X/Y" count, empty state, auto-snap selection; detail = thumb + format chip + 7 KPI tiles + "in campaigns" table + audience breakdown. Breakdown page: age/gender/province/day×time from seed aggregate.
   ▣ **Checkpoint:** changing account re-scopes the product filter and re-snaps selection; both breakdowns render from the shared viz components.

**6. Automation + Activity + Notifications.** Automation rule cards (IF/THEN, run counts, on/off). Activity log timeline grouped by day, actor badges (ทีมงาน manual / ⚡ ระบบอัตโนมัติ automation), manual-vs-automation filter, automation entries name the rule. Notifications bell dropdown wired to logs/rules state.
   ▣ **Checkpoint:** filter toggles manual/auto; automation entries show the triggering rule; per-campaign history modal works from Campaigns.

**7. Catalog + Settings.** Catalog: add form (photo dropzone, Thai/EN name, unit cost, **category select**, **account multi-select chips**, auto-SKU, disabled until name+cost), product grid (photo or SKU-initials tile, badges, edit gear → modal, remove custom only). Settings: connect/connected lists (re-sync/disconnect), health card, connection overview, Platforms (Meta connected / TikTok disabled "เร็วๆ นี้"), security note, **Category manager** (add/remove custom; 5 built-ins locked; feeds catalog dropdowns immediately).
   ▣ **Checkpoint:** adding a category appears in catalog add+edit dropdowns; adding a product appears in the grid; connect/disconnect updates Settings counts.

**8. Polish.** Responsive (1440 design width, table overflow wrappers, `minmax(0,1fr)`), a11y pass (roles, focus, `aria-*`, reduced motion), hover/active states, modal blur/click-outside. Re-theme check across the 4 accent options + `colorByPerformance` off.
   ▣ **Checkpoint:** DoD below fully satisfied.

## Definition of Done (from AGENTS.md)

- [ ] All 9 views match `DESIGN.md`.
- [ ] Editing a product threshold **live-re-judges** campaigns (cells, verdicts, auto-close).
- [ ] Auto-close behaves correctly (breach + product auto-close ⇒ default off + "ปิดอัตโนมัติ"; overrides win).
- [ ] Budget modal with **25/50/75/100%** quick options + correct diff/%/monthly/util.
- [ ] **Column-sort on every campaign column** (name, 7 metrics, budget, status, open/close) with direction + best-first first click.
- [ ] Creative filters **scope product → account**; live count, empty state, auto-snap.
- [ ] Activity entries clearly tagged **manual vs automation**; automation names its rule.
- [ ] Category manager feeds catalog dropdowns immediately.
- [ ] Campaign detail is an **in-page state swap**, not a route.
- [ ] Numbers monospace everywhere; labels `ไทย · English`; no gradients/emoji/AI-slop cards.
- [ ] `npm test` green (engine + formatters). **No console errors.**

## Commands

```
npm run dev     # local
npm run build   # production build must pass before "done"
npm test        # vitest — engine + formatters
npm run lint    # eslint + tsc --noEmit (strict)
```

## Out of scope (for now)

Real Meta OAuth/API, multi-user auth, persistence/back end, TikTok/Google connectors
(TikTok shows disabled "coming soon").
