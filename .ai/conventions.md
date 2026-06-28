# .ai/conventions.md — Code conventions

Authoritative for *how* we write code. For *what* to build see `DESIGN.md`; for the
KPI math see `.ai/kpi-engine.md`; for data shapes see `.ai/data-contracts.md`; for
build order and DoD see `.ai/workflow.md`. Nothing here may contradict `AGENTS.md` or
`DESIGN.md` — if it does, those win.

## Stack (fixed — do not substitute)

- **Next.js App Router** + **React** + **TypeScript** (`strict: true`). No Vite, no CRA, no Pages Router.
- **Tailwind CSS**, tokens defined in `tailwind.config.ts` (DESIGN.md §2). Never hardcode hex in components — use token classes/CSS vars.
- **State:** Zustand store mounted via a client provider in the root layout. React `useState` only for trivial local-only UI (e.g. a hover flag).
- **Fonts:** `next/font/google` — IBM Plex Sans Thai (300/400/500/600/700) + IBM Plex Mono (400/500/600), exposed as CSS variables and wired into Tailwind `fontFamily`.

## Server vs. client

- Root `app/layout.tsx` is a **server component** (fonts, `<html>`/`<body>`, mounts the client provider).
- Anything with state, effects, event handlers, or charts gets `"use client"` at the top. Most page/leaf components are client.
- `lib/` and `data/` are **framework-agnostic**: no `react`, no `next` imports. They must be unit-testable and API-swappable in isolation.

## Files & naming

- Components: `PascalCase.tsx` (one component per file, default export the component).
- Hooks: `useThing.ts`. Store: `store/useAppStore.ts`. Pure modules: `lib/kpi.ts`, `lib/format.ts`.
- Types live in `data/types.ts`; import with `import type`.
- Directories lowercase. Route folders match the nav id where practical (`overview`, `campaigns`, `creatives`, `breakdown`, `automation`, `activity`, `product-kpi`, `catalog`, `settings`).
- No default-exported barrels that hide dependencies; prefer explicit imports.

## TypeScript

- `strict` on. No `any` in committed code — use `unknown` + narrowing, or a precise type.
- Model the 7 metrics as a `MetricKey` union and a `Record<MetricKey, number>`, never loose strings.
- Derive, don't duplicate: a campaign's verdict/status is **always** computed by the engine from `(campaign, thresholds, overrides)` — never stored on the entity.

## Numbers & localization (hard rules)

- **Every number is monospace** (`font-mono` → Plex Mono): money, ROAS, CTR, %, IDs, timestamps, counts, deltas. Wrap them or apply the mono class; never let a number render in Plex Sans.
- Format only through `lib/format.ts`. Never inline `toLocaleString`/`'฿'+...` in a component.
  - money → `฿` + grouped thousands, **no decimals**.
  - roas → one decimal + `x` (`4.6x`). ctr/percent → one decimal + `%`.
  - thresholds render with their direction symbol: `≥` for `min` metrics, `≤` for `max`.
- Labels follow **`ไทย · English`** (Thai primary for nav/actions/status, English for metric names and as secondary). Relative times in Thai ("2 นาทีที่แล้ว", "เมื่อวาน").
- Keep Thai copy from the prototype/DESIGN verbatim — do not re-translate or "improve" it.

## Visual rules (enforced in review)

- **No gradients** on UI chrome, **no emoji as UI**, **no rounded-corner + left-accent "AI-slop" cards.** Calm, dense, professional.
  - (The prototype uses a subtle vertical bar gradient only inside chart bars; flat accent fill is acceptable and preferred. No decorative gradients anywhere else.)
- Card = `background #fff; border 1px #e9ebef; radius 12; box-shadow 0 1px 2px rgba(16,18,29,.04)`.
- Status chips: `padding 4px 10px; radius 20px; background <color>@~9% alpha; color <color>`. Express the alpha as a token (e.g. `<color>18` hex suffix) — one helper, not ad-hoc.
- Toggles: pill track (34×19 default, 38–40×21–22 large), white knob, `#1f8a5b` on / `#cdd1d8` off, `justify-content` flips end/start.
- Buttons/inputs radius 8–9; pills/chips radius 20; avatars/thumbs radius 8–11.
- Accent is a **single re-themeable token** (`--accent`, default `#3b6fe0`; options `#3b6fe0 / #6E56CF / #1F8A5B / #16181d`). It threads charts, daily-spend bars, heatmap alpha, active-nav dot, primary CTA. Performance coloring is gated by a `colorByPerformance` flag (off ⇒ everything `ink`).
- Icons: port the inline-SVG set (DESIGN.md §2 Iconography) as small `<Icon name=… size=…/>` components (stroke 2, round caps, 24-viewBox). `lucide-react` is acceptable only if weights/sizes match. **No emoji.**

## Tables

- Dense metric tables get a `min-width` and an `overflow-x:auto` wrapper so columns never crush.
- Truncate long text with `white-space:nowrap; overflow:hidden; text-overflow:ellipsis` — never character-wrap.
- Two-column layouts use `minmax(0,1fr)` for the flexible column.

## Accessibility

- Real `<button>` for clickable things (nav, sort headers, toggles, chips-as-actions). Toggles get `role="switch"` + `aria-checked`; sort headers convey direction (`aria-sort`).
- Inputs have associated labels (visible or `aria-label`). Modals: focusable, `Esc` to close, click-outside closes, `stopPropagation` on the card, focus trapped while open.
- Color is never the *only* signal — pair green/red cells with the value and the `≥/≤` threshold context.
- Hit targets ≥ ~28px. Respect `prefers-reduced-motion` (transitions are already subtle: `background .12–.15s`, `opacity .15s`).

## Don'ts (quick list)

- ❌ Hardcoded hex in components. ❌ Numbers in a non-mono font. ❌ Inline number formatting.
- ❌ Storing derived verdict/status on entities. ❌ React/Next imports in `lib/`/`data/`.
- ❌ A route for campaign detail (it is an in-page state swap — see DESIGN §4.2).
- ❌ Importing/porting anything from `reference/` runtime (`support.js`, `.dc.html`). Study only.
- ❌ Default chart-library chrome (legends/gridlines) that clashes with the calm aesthetic.
