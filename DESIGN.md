# AdsHub — Design Specification

A consolidated Facebook/Meta Ads management suite for a Thai performance‑marketing team. One dashboard that unifies many ad accounts, consolidates campaigns, judges them against per‑product KPI thresholds, auto‑opens/closes them, and breaks down audience data. UI language is **mixed Thai + English** (Thai for labels/actions, English for metrics).

> Reference implementation: `reference/AdsHub.standalone.html` (open in any browser, works offline) and `reference/AdsHub.prototype.dc.html` (source + `support.js`). This document is the source of truth for rebuilding it as a production app. The `reference/` prototype is read‑only — study it, never ship or import from it.

---

## 1. Product purpose (the pain points it solves)

| Pain point (Thai) | Where it's solved |
|---|---|
| มีบัญชี Ads เยอะเกิน / ไม่มีที่รวม | **Overview**, **Settings** |
| ไม่มีที่รวม Campaign | **Campaigns** |
| วัดผลจากสื่อยาก | **Creatives** |
| เสียเวลาเปิดปิด / Scale ยาก | **Campaigns** (toggle + budget), **Automation** |
| ไม่มีที่เก็บ Data ที่รวมแล้ว | **Overview / Breakdown** |
| Breakdown เห็นภาพ | **Breakdown**, per‑campaign & per‑creative breakdowns |
| ไม่มีที่เก็บ KPI / Automate ไม่ได้ | **Product KPI**, **Automation** |
| ไม่รู้ Target group | **Breakdown** |
| ข้อมูลย่อย วัน/อายุ/เพศ/จังหวัด | **Breakdown** |

---

## 2. Brand & visual system

**Aesthetic:** clean, data‑dense professional analytics tool (think a pro media‑buying console). No gradients, no emoji as UI, no rounded‑corner+left‑accent "AI slop" cards. Inline‑styled, calm, monospace for all numbers.

### Color palette

| Token | Hex | Use |
|---|---|---|
| `ink` | `#16181d` | Primary text, dark sidebar, dark header bars, primary buttons |
| `ink-2` | `#3a3f47` | Table cell text |
| `slate` | `#5b6068` | Secondary text |
| `muted` | `#838992` | Labels, captions |
| `muted-2` | `#9aa0a8` | Sub‑captions |
| `faint` | `#aeb3bb` / `#b3b8c0` | Hints, placeholders |
| `accent` | `#3b6fe0` | Primary accent — charts, links, active nav dot, primary CTA fill on light |
| `success` | `#1f8a5b` | Pass / good ROAS / connected / scale |
| `warn` | `#c98a16` | Borderline / needs attention |
| `danger` | `#d6453d` | Breach / disconnect / auto‑close |
| `violet` | `#6E56CF` | Automation actor, secondary categorical |
| `page-bg` | `#f5f6f8` | App background |
| `card` | `#ffffff` | Cards/sections |
| `border` | `#e9ebef` | Card borders |
| `border-2` | `#eef0f3` / `#f1f2f5` | Inner dividers / table row lines |
| `field-bg` | `#fafbfc` | Inputs, table headers |

Accent is **tweakable** (options: `#3b6fe0`, `#6E56CF`, `#1F8A5B`, `#16181d`) and threads through charts, daily‑spend bars, heatmaps, nav active dot.

**Categorical ramp** (account avatars, spend‑share, charts): `['#16181d','#2f57b0','#3b6fe0','#6c93ea','#9db8f1','#cdd9f8']`.

**Performance color coding** (ROAS etc.): ≥5 → success, ≥4 → ink, ≥3 → warn, else danger. This is toggleable via a `colorByPerformance` flag (off ⇒ everything ink).

### Typography

- **IBM Plex Sans Thai** (300/400/500/600/700) — all UI text, Thai + Latin.
- **IBM Plex Mono** (400/500/600) — **every number**: money, ROAS, CTR, percentages, IDs, timestamps, counts.
- Scale (px): page title 17, section title 14.5, card metric 22–26, body 12.5–13.5, label/caption 10.5–12, table header 10.5–11 (uppercase, letter‑spacing .04em).
- Minimum body text ~11px; never smaller than 10px for captions.

### Shape, depth, spacing

- Card: `background:#fff; border:1px solid #e9ebef; border-radius:12px; box-shadow:0 1px 2px rgba(16,18,29,.04)`.
- Buttons/inputs radius 8–9px; pills/chips radius 20px; avatars/thumbs radius 8–11px.
- Section padding 16–22px; card gaps 16px; control gaps 9–14px.
- Status chips: `padding:4px 10px; border-radius:20px; background:<color>18; color:<color>` (the `18` = ~9% alpha hex suffix).
- Toggles: pill track 34×19 (or 38–40×21–22), white knob, `#1f8a5b` when on / `#cdd1d8` when off, justify‑content flips.

### Iconography

Custom inline‑SVG icon set (stroke‑based, 24×24 viewBox, `stroke-width:2`, round caps). Icons used: bell, bolt, check, alert, info, pause, play, trendUp/Down, clock, gear, plus, image, upload, tag, shield, refresh, box, wallet, unlink. **No emoji** in the UI chrome. Build icons as small SVG components, sized 13–24px.

---

## 3. Information architecture

Left sidebar (dark `#16181d`, 236px, sticky full‑height) + sticky translucent top bar + scrolling content. Brand mark "AdsHub / MEDIA COMMAND CENTER" top‑left; user/team footer bottom.

**Top bar (all pages):** page title + subtitle, account selector ("ทุกบัญชี · All accounts (6)"), date range segmented control (7D / 30D / 90D), **notifications bell** (unread badge + dropdown), Export button. A 6‑card KPI summary strip sits under the top bar on every page (Total Spend, Revenue, ROAS, Purchases, Avg CPA, CTR — each with value, Thai+English label, delta vs prev).

### Nav items / pages

1. **ภาพรวมบัญชี · Overview** — multi‑account performance
2. **แคมเปญรวม · Campaigns** — consolidated, KPI‑judged, grouped/sortable, in‑page detail
3. **สื่อ/ครีเอทีฟ · Creatives** — creative library + per‑creative breakdown
4. **เจาะลึกข้อมูล · Breakdown** — audience: age/gender/province/day×time
5. **ระบบอัตโนมัติ · Automation** — IF/THEN rules
6. **ประวัติการทำงาน · Activity log** — action history, manual vs automation
7. **เกณฑ์ KPI สินค้า · Product KPI** — per‑product acceptable limits (drives automation)
8. **คลังสินค้า · Product catalog** — add/edit products, photos, cost, accounts
9. **ตั้งค่า & เชื่อมต่อ · Settings** — connect accounts, review, category manager

---

## 4. Page specifications

### 4.1 Overview
- Daily‑spend bar chart (30 bars, accent fill, last‑day highlighted) + average label.
- Spend‑share stacked bar + legend (6 accounts, ramp colors, % split).
- Ad‑accounts table: avatar+name+platform, Spend, Revenue, ROAS (perf‑colored), Purchases, CPA, CTR, Status chip (Active/Paused). "+ เชื่อมบัญชี" CTA.

### 4.2 Campaigns
- Dark intro banner with summary chips: ★ marked / ● running / ⏸ closed; CTA to Product KPI.
- **Controls bar:** มุมมอง (group by **product / account / none**), เรียงกลุ่ม (group sort: performance / name + asc/desc).
- **Grouped tables** (one card per group). Group header: avatar, title, subtitle, ★/⏸ counts, auto‑close chip (product groups only).
- Table columns: campaign (with status icon, history ◷ button, name is a button → opens detail), the 7 metric columns showing value vs the product threshold (`≥`/`≤` label), each cell **green if pass / red if breach**; สถานะ; **budget** (click amount/pencil → budget modal); เปิด/ปิด toggle. **Every column header is click‑to‑sort** (name, all 7 metrics, status, open/close) with ↑/↓ and a faint ⇅ hint; first click sorts "best first" per metric.
- **Auto‑mark / auto‑close engine:** a campaign passing all metrics + ROAS ≥ 1.2× threshold → "marked" (★). Breaching → if that product's auto‑close is on, it's toggled off + dimmed ("ปิดอัตโนมัติ"); else flagged but left running.
- **Budget modal:** confirmation dialog showing current budget, draft, diff, % change, before/after; quick‑increase buttons **25% / 50% / 75% / 100%**; confirm/cancel.
- **In‑page campaign detail** (no route change; state‑swapped on the same page): back button; header (name/product/account/status/budget‑adjust); 7‑metric breakdown vs thresholds (green/red); **creatives ranked best‑ROAS‑first** each judged (ดีเด่น/ผ่านเกณฑ์/ต่ำกว่าเกณฑ์) with **open/close toggle** ("เปิดอยู่ X/Y"); audience breakdown (age/gender/province/day×time) aggregated spend‑weighted across the campaign's creatives.

### 4.3 Creatives
- Two‑column: left = filterable creative list, right = detail.
- **Filters:** account + product. Product options are **scoped to the selected account** (only products present there). Live count "X/Y", empty state, selection auto‑snaps to a visible item.
- Detail: big thumb + format chip + product/account + "used in N campaigns"; 7 KPI tiles (Spend, ROAS, CTR, Purchases, CPA, Impr., Freq.); **"In campaigns" table** (each campaign running this creative + its results + KPI status); **audience breakdown** (age/gender/province/day×time) for the creative.
- Formats: Video / Reels / Carousel / Image — each a colored thumb tile + chip.

### 4.4 Breakdown
- Age (vertical bars, %+ROAS, perf‑colored), Gender (horizontal bars, 3 segments), Top provinces (8, horizontal bars + ROAS), Day×time heatmap (7×12 cells, accent alpha by intensity, legend น้อย→มาก).

### 4.5 Automation
- Dark summary banner (active rules count, total runs, "+ สร้างกฎใหม่").
- Rule cards: type icon, name + scope, **IF** condition → **THEN** action (stacked tags), run count + last‑run, on/off toggle. Rule types: auto‑close high‑CPA, scale good‑ROAS, reduce low‑ROAS, prime‑time activation, budget alert, ad‑fatigue pause.

### 4.6 Activity log
- Dark banner with counts (total / manual / automation).
- Filter select: all / manual / automation.
- Timeline grouped by day (วันนี้ / เมื่อวาน / dates). Each entry: type icon, title + subject, before→after detail, time, **actor badge** — **ทีมงาน (manual, blue, PJ avatar)** vs **⚡ ระบบอัตโนมัติ (automation, violet)**; automation entries name the triggering rule.
- Per‑campaign history available via a **modal** opened from each campaign row's ◷ icon.

### 4.7 Product KPI
- Dark banner + CTA to Campaigns.
- Editable threshold matrix: one row per product (avatar+name+SKU), 7 editable numeric inputs (ROAS ≥, CTR ≥ minimums; CPA, CPM, cost/purchase, cost/result, cost ≤ maximums), plus a per‑product **auto‑close toggle**. Header marks each metric's direction (`≥`/`≤`). Editing a value live‑recomputes all campaign judging.

### 4.8 Product catalog
- Add form (card): photo upload/dropzone (preview + clear), Thai name*, English name, **unit cost*** + **หมวดหมู่ (category) select**, **account multi‑select chips** (one product → many accounts), add button (disabled until name+cost). Auto‑generates SKU.
- Product grid: card per product — photo or colored SKU‑initials placeholder tile, name/EN/SKU, assigned‑accounts line, unit cost, category chip, "เพิ่มเอง"/"แก้ไขแล้ว" badge, **edit** (gear → modal) and remove (custom only).
- **Edit modal:** same fields (incl. category from dynamic list + accounts), save/cancel.

### 4.9 Settings
- Dark banner (connected vs available counts).
- Two‑column grid (`minmax(0,1fr) 300px`):
  - **Left:** "Connect account" (available accounts found in Meta Business, "+ เชื่อมต่อ"); "Connected accounts" (avatar, name, status chip [active/syncing/warning], platform·ID, spend·products·sync line, icon‑only re‑sync / disconnect).
  - **Right sidebar (sticky):** health card (green ok / amber attention), connection overview (total spend managed, products linked, syncing), Platforms panel (**Meta — connected**; **TikTok — disabled "เร็วๆ นี้/coming soon"**), read‑only‑access security note.
- **Category manager** (full‑width section below): text input + เพิ่ม to add custom categories; chips show product counts; custom categories removable, the 5 built‑ins (Skincare, Fashion, Bundle, Beauty, Other) not. New categories flow into catalog add + edit dropdowns immediately.

---

## 5. Data model (entities)

- **Account**: `{ id, name, platform, initials, color, connected, status: active|syncing|warning, lastSync, spend, products }`. Short keys used in relations: `SKIN, MAIN, FASH, LAZ` (+ display meta).
- **Product**: `{ sku, th, en, category, accounts:[accountKey], unitCost, img, thresholds:{roas,ctr,cpa,cpm,cpp,cpr,cost}, autoClose:bool }`.
- **Campaign**: `{ id, name, sku (product), account, budget, metrics:{roas,ctr,cpa,cpm,cpp,cpr,cost} }`. Verdict derived vs the product's thresholds.
- **Creative**: `{ id, name, format: Video|Reels|Carousel|Image, sku, campaigns:[campaignId], audienceProfile, spend, impressions, roas, ctr, cpa, purchases, frequency }`.
- **AudienceProfile**: `{ age:[6], gender:[3], province:[8], day:[7], hour:[12] }` (aggregations are spend‑weighted).
- **Rule**: `{ id, name, scope, ifCondition, thenAction, type, runs, lastRun, on }`.
- **LogEntry**: `{ id, day, time, campaignId|sku, actor: manual|auto, type, title, detail, ruleName? }`.
- **Notification**: `{ id, kind: success|warn|info, time, title, detail }`.
- **Category**: string; defaults `[Skincare, Fashion, Bundle, Beauty, Other]` + user‑added.

### Metric definitions (the 7 judged KPIs)
`roas` (≥), `ctr` (≥), `cpa` (≤), `cpm` (≤), `cpp` cost/purchase (≤), `cpr` cost/result (≤), `cost` daily cost (≤). Money metrics render `฿` + grouped thousands; roas as `x`, ctr as `%`.

### Core derived logic
- **Campaign verdict**: per metric `ok = dir==='min' ? value>=threshold : value<=threshold`. `passAll = no breaches`. `marked = passAll && roas >= threshold*1.2`. Else `running` (pass) or `breach`.
- **Auto‑close**: `breach && product.autoClose` ⇒ default off + "ปิดอัตโนมัติ".
- **Creative rank**: sort by ROAS desc within a campaign; verdict marked/ok/poor; poor defaults to off.

---

## 6. Interaction & motion

- Transitions are subtle: `transition: background .12–.15s`, `opacity .15s`. No flashy animation.
- Hover states on rows/buttons (slightly tinted bg). Active nav item gets `#262a33` bg + accent dot + accent sub‑label.
- Modals: fixed overlay `rgba(16,18,29,.55)` + blur, centered card, click‑outside + ✕ to close, `stopPropagation` on the card.
- Dropdowns (notifications): fixed click‑catcher overlay + absolutely‑positioned panel.
- Everything is in‑page/state‑driven; the campaign detail is a state swap, not a route.

---

## 7. Localization & formatting

- Thai for nav, section titles, actions, statuses; English for metric names + as secondary labels (pattern: `ไทย · English`).
- Currency: `฿` prefix, thousands separators, no decimals for money.
- ROAS one decimal + `x`; CTR one decimal + `%`; relative times in Thai ("2 นาทีที่แล้ว", "เมื่อวาน").

---

## 8. Responsive / sizing

- Designed at **1440×960** content width; the dark sidebar is fixed 236px.
- Tables get `min-width` + horizontal scroll wrappers so dense metric grids never crush.
- Long text uses `white-space:nowrap; overflow:hidden; text-overflow:ellipsis` rather than character wrapping.
- Two‑column layouts use `minmax(0,1fr)` so the flexible column can shrink without overflow.
