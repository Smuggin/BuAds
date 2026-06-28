# CLAUDE.md — AdsHub root rules

AdsHub is a Meta/Facebook Ads management suite for a Thai performance-marketing team —
a single-page dashboard with 9 views that consolidates many ad accounts, judges every
campaign/creative against per-product KPI thresholds, auto-marks winners / auto-closes
losers, and breaks down audience data. UI is **mixed Thai + English**.

## Read these (in order)

1. **`AGENTS.md`** — build guide: stack, structure, domain logic, build order, DoD.
2. **`DESIGN.md`** — visual + functional source of truth: tokens, typography, all 9 pages, data model, KPI logic, localization.
3. **`ARCHITECTURE.md`** — layers, server vs client, routing, theming, testing.
4. **`.ai/conventions.md`** — TS/Next/Tailwind conventions, localization, a11y, don'ts.
5. **`.ai/kpi-engine.md`** — exact spec of the engine (eval / auto-close / ranking / aggregation / budget / formatters).
6. **`.ai/data-contracts.md`** — typed shapes (`data/types.ts`) + the `app/api/*` surface.
7. **`.ai/workflow.md`** — plan, build order, checkpoints, Definition of Done.
8. **`.ai/schema.md`** — backend data model (Postgres + Prisma), designed now / built Phase 9.
9. **`.ai/meta-integration.md`** — live Meta Marketing API plan (endpoints, field→KPI map), Phase 10.

When these conflict, precedence is **DESIGN.md → AGENTS.md → ARCHITECTURE.md → .ai/**.

## Non-negotiables

- **Next.js App Router** (no Vite/CRA). Design tokens from DESIGN §2 in `tailwind.config.ts`.
- **IBM Plex Sans Thai + IBM Plex Mono** via `next/font`. **Every number is monospace.**
- The **KPI engine is the heart**: pure functions in `lib/`, unit-tested, framework-agnostic. Editing a product threshold must **live-re-judge every campaign**. Verdicts are derived, never stored.
- Mock data behind typed contracts in `data/`, served via `app/api/*`.
- **Campaign detail is an in-page state swap, not a route** (DESIGN §4.2).
- Labels follow **`ไทย · English`**. **No gradients, no emoji UI, no AI-slop cards.** Calm and dense.
- **`reference/` is read-only** — study `AdsHub.standalone.html`; never ship, import, or copy its runtime.

## Commands

`npm run dev` · `npm run build` · `npm test` · `npm run lint`
