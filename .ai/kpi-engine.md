# .ai/kpi-engine.md — The KPI engine (the heart of AdsHub)

Exact spec for the pure functions in `lib/kpi.ts` (+ `lib/format.ts`). These are
**framework-agnostic and unit-tested**. Editing a product threshold must live-re-judge
every campaign — which works for free *because verdicts are never stored*: the UI calls
the engine on every render with the current (thresholds + overrides) from the store.

Distilled from `reference/AdsHub.prototype.dc.html` (`evalCamp`, `buildCampRow`,
`buildCampDetailVM`, `aggregateProfile`, budget math). Do not contradict DESIGN.md §5.

## The 7 metrics

| key   | label (short)   | dir   | money | unit | render |
|-------|-----------------|-------|-------|------|--------|
| `roas`| ROAS            | `min` | no    | `x`  | `4.62x` |
| `ctr` | CTR             | `min` | no    | `%`  | `1.83%` |
| `cpa` | CPA             | `max` | yes   | ฿    | `฿90.00`  |
| `cpm` | CPM             | `max` | yes   | ฿    | `฿95.32`  |
| `cpp` | ต้นทุน/ซื้อ (cost/purchase) | `max` | yes | ฿ | `฿150.00` |
| `cpr` | C/Result (cost/result)      | `max` | yes | ฿ | `฿55.00`  |
| `cost`| Cost/วัน (daily cost)       | `max` | yes | ฿ | `฿1,600.00` |

`min` ⇒ higher is better, threshold renders `≥`. `max` ⇒ lower is better, renders `≤`.
Define this table once as `METRIC_DEFS`; everything iterates it.

## 1. `evalCampaign(campaign, thresholds, skip, scaleThresholds)`

Per-metric judgement + verdict. **Only the judged KPI set** (`JUDGED_METRIC_KEYS` =
roas/ctr/cpm/cpp — same as `KPI_METRIC_DEFS`) gates the verdict. `cpa` & `Cost/วัน` get
cells for display but are **never enforced** (reference-only). `scaleThresholds` are the
tougher good-direction targets per judged metric (partial; a value reached = doing great).

```
for each metric m in METRIC_DEFS:
  value    = campaign.metrics[m.key]
  ok       = m.dir === 'min' ? value >= thresholds[m.key]
                             : value <= thresholds[m.key]
  enforced = JUDGED_METRIC_KEYS.includes(m.key) && !skip.includes(m.key)
  target   = scaleThresholds?.[m.key]
  reachedScale = target != null &&
                 (m.dir === 'min' ? value >= target : value <= target)
  tier     = !ok ? 'breach' : reachedScale ? 'scale' : 'ok'
  cell     = { key, value, disp, ok, enforced, tier }

enforcedCells = cells where enforced
breaches      = count of enforcedCells where !ok
passAll       = breaches === 0
scaleReached  = count of enforcedCells where tier === 'scale'
verdict = !passAll                                   ? 'breach'       // ควรปิด — wins
        : scaleReached === enforcedCells.length > 0  ? 'scale'        // ควรสเกล — all reach scale
        : scaleReached > 0                           ? 'interesting'  // น่าสนใจ — mixed
        :                                              'running'      // กำลังรัน

return { cells, breaches, passAll, scaleReached, verdict }
```

`Verdict = 'scale' | 'interesting' | 'running' | 'breach'`. **A breach on any judged
limit always wins over a scale-zone metric** (ควรปิด beats น่าสนใจ). `scale` requires
*every* enforced metric to reach its target; some-but-not-all → `interesting`. With no
`scaleThresholds` the verdict can only be `running`/`breach`. (The old `MARKED_ROAS_MULTIPLIER
= 1.2` rule is retired for campaigns; it survives only in **creative** ranking, §3.)

Scale targets are per-product & per-metric (`Product.scaleThresholds`, `effScaleThresholds`),
editable in the Product-KPI page's expandable "เป้าสเกล" panel; a metric with no explicit
value falls back to `deriveScaleThreshold(limit)` (min ×1.3, max ×0.75).

**verdictMeta** (label/icon/color for chips):
- `scale`       → `{ label: 'ควรสเกล', icon: '⤴', color: success #1f8a5b }`
- `interesting` → `{ label: 'น่าสนใจ', icon: '★', color: warn #c98a16 }`
- `running`     → `{ label: 'กำลังรัน', icon: '●', color: slate #6b7280 }`
- `breach`      → `{ label: 'เกินเกณฑ์', icon: '⚠', color: danger #d6453d }`

## 2. Auto-close & on/off resolution

A campaign's open/closed state is **derived**, then optionally overridden by the user.

```
ev        = evalCampaign(campaign, effThresholds(product))
autoClose = effAutoClose(product)                  // product setting, possibly overridden
closedAuto = ev.verdict === 'breach' && autoClose  // breaching + product auto-close ON
defaultOn  = !closedAuto                            // auto-closed campaigns default OFF
on         = campOverride[campaign.id] ?? defaultOn // user toggle wins
```

- When `closedAuto`, the status chip reads **"ปิดอัตโนมัติ"** in `danger`, and the row is dimmed.
- A user toggling on/off writes `campOverride[id]` — an explicit override of the derived default.
- A breaching campaign whose product has auto-close **off** stays running but flagged (`breach` chip).
- Row detail copy: scale → `ทุกเกณฑ์ถึงเป้าสเกล · พร้อม Scale`; interesting → `ผ่านทุกเกณฑ์ · ถึงเป้าสเกล {n} รายการ`; breach → `เกินเกณฑ์ {n} รายการ` + (`· แนะนำให้ปิด` if advise else `· รอตรวจสอบ`); running → `อยู่ในเกณฑ์ที่ตั้งไว้`.
- `resolveCampaignState` also derives `shouldScale = on && verdict === 'scale'` (advisory candidate to raise budget), alongside `shouldClose = on && verdict === 'breach' && advise`.

`effThresholds(product)` = for each metric, `prodThr[sku][key] ?? product.thresholds[key]`.
`effAutoClose(product)` = `autoOverride[sku] ?? product.autoClose`.
Editing any threshold in Product KPI updates `prodThr` → re-judges everything instantly.

## 3. Creative ranking (campaign detail only)

Within one campaign's creatives. **Note: the creative verdict uses only 3 metrics**
(roas/ctr/cpa), *not* all 7 — this matches the prototype and is intentional.

```
creatives = all creatives whose campaigns[] includes campaignId
ranked    = creatives sorted by roas DESC
for each cr (index i):
  pass   = cr.roas >= thr.roas && cr.ctr >= thr.ctr && cr.cpa <= thr.cpa
  strong = pass && cr.roas >= thr.roas * 1.2
  verdict = strong ? 'marked' : pass ? 'ok' : 'poor'
  defaultOn = verdict !== 'poor'
  on        = creativeOpen[cr.id] ?? defaultOn
openCount = number of creatives with on === true   // header shows "เปิดอยู่ X/Y"
```

Creative verdict labels/colors:
- `marked` → `ดีเด่น · พร้อม Scale` (success `#1f8a5b`)
- `ok`     → `ผ่านเกณฑ์` (`#2f6fd0`)
- `poor`   → `ต่ำกว่าเกณฑ์` (danger `#d6453d`)

Rank badge `#1` is success-colored; the rest are faint.

## 4. Aggregated audience (spend-weighted)

Used for per-campaign and per-creative breakdowns. An `AudienceProfile` has arrays
`age[6], gender[3], province[8], day[7], hour[12]`. Creatives reference a profile key
(`'A' | 'B' | 'C'`).

```
aggregateProfile(creatives):
  for key in ['age','gender','province','day','hour']:
    acc[key] = zeros(len)
  totalW = 0
  for cr in creatives:
    w = cr.spend || 1; totalW += w
    P = profiles[cr.profileKey]
    for key: for i: acc[key][i] += P[key][i] * w
  for key: for i: acc[key][i] /= (totalW || 1)
  return acc
```

Viz derivation (`profileVizData`):
- **Age**: vertical bars, height = `value / max(age) * 100%`, label = `%`.
- **Gender**: 3 horizontal segments (`#3b6fe0` female, `#16181d` male, `#c2c7cf` unknown), width = `value%`.
- **Province**: 8 horizontal bars, width = `value / max(province) * 100%` (min 4px).
- **Day×time heatmap**: 7 rows × 12 cols. `cell = day[d] * hour[h]`; background = `rgba(<accentRGB>, 0.05 + cell/max * 0.92)`. Legend น้อย→มาก.

The standalone **Breakdown page** (§4.4) renders the *same* four visualizations from the
account-level aggregate dataset (static seed: `ageData/genderData/provinceData/heatData`),
with per-segment ROAS labels (perf-colored). Keep the viz components shared; feed them
either the aggregated profile (campaign/creative) or the seed dataset (Breakdown page).

## 5. Budget math (modal)

```
current = budgetOverride[id] ?? campaign.budget
draft   = user input (number, clamped ≥ 0, rounded to integer)
diff    = draft - current
pct     = current ? diff / current * 100 : 0
monthly = draft * 30
util    = draft ? min(999, round(campaign.metrics.cost / draft * 100)) : 0

quick-increase buttons 25/50/75/100:
  draft = max(0, round(current * (1 + pct/100) / 10) * 10)   // snap to nearest 10
step +/- buttons: draft ± 100 (clamp ≥ 0)
confirm: budgetOverride[id] = draft
```

Modal shows current vs draft, the `↗/↘/→` direction (accent = success up / danger down /
accent same), diff + `%`, monthly (`×30`), and a current-performance mini-grid
(ROAS perf-colored, CPA, ใช้จริง/วัน = cost, ใช้งบ = util%) with the status chip.
A `+pct%` quick button shows a `✓` when the current draft equals that snapped value.

## 6. Formatters (`lib/format.ts`)

Money, ROAS and CTR render with **2 decimals** so every column reads 1:1 with Meta
Business Suite (`฿5,000.00`, `฿95.32`, `4.62x`, `1.83%`). The app keeps its `x`/`%`/`฿`
suffixes. `fmtK` (compact counts) stays at one decimal.

```
fmtMoney(v)      = '฿' + v.toLocaleString(_, {min/maxFractionDigits: 2})  // 2 decimals
fmtMetric(k, v)  = k==='roas' ? v.toFixed(2)+'x'
                 : k==='ctr'  ? v.toFixed(2)+'%'
                 :              fmtMoney(v)
fmtThreshold(k,v)= fmtMetric(k, v)                              // rendered after ≥/≤
fmtK(v)          = v>=1000 ? round1(v/1000)+'K' : String(v)     // impressions etc.
round1(v)        = Math.round(v*10)/10
roasColor(v, colorByPerformance):
    if !colorByPerformance → ink #16181d
    v>=5 → success #1f8a5b ; v>=4 → ink #16181d ; v>=3 → warn #c98a16 ; else danger #d6453d
```

`colorByPerformance` is the global flag (DESIGN §2). When off, ROAS and other perf
coloring collapse to `ink`.

## 7. Aggregations for headers/summaries

- **Campaign summary** (banner chips): count campaigns by resolved state — `closed` (`!on`),
  else by verdict `scale` / `interesting` (marked) / `running`.
- **Group score** (for "performance" group sort): mean of per-row `statusRank`, where
  `rank = scale ? 3 : interesting ? 2 : running ? 1 : 0`. Group sort asc/desc, or by name.
- **Group `⤴ / ★ / ⏸` counts**: scale count, interesting count, closed (`!on`) count per group.

## What to unit-test (`lib/kpi.test.ts`)

Required coverage (AGENTS.md build order step 2):
1. `evalCampaign` verdicts: `running` (passes limits, no scale reached), `scale` (all judged reach scale), `interesting` (mixed — some reach scale), `breach` (≥1 judged limit fails); correct `breaches`/`scaleReached`; `min` vs `max` boundary (`value === threshold` ⇒ ok); cpa & cost never enforced.
2. A judged **breach wins** over a scale-zone metric (ควรปิด beats น่าสนใจ); `scale` needs *every* enforced metric to reach its target; skipping a metric drops it from both the breach and scale requirements.
3. Auto-close resolution: breach + autoClose ⇒ `defaultOn=false`; breach + no autoClose ⇒ running-but-flagged; `campOverride` flips the resolved `on`.
4. Threshold edit re-judges: same campaign flips verdict when a threshold crosses its value.
5. Creative ranking: ROAS-desc order, 3-metric pass/strong/poor verdicts, `defaultOn` for poor, `openCount`.
6. `aggregateProfile`: spend-weighting (a heavier creative dominates), single-creative identity, normalization sums sane.
7. Budget math: `pct` snapping to nearest 10, `util` cap at 999, diff/monthly.
8. Formatters: money grouping/no-decimals, roas/ctr one-decimal, `fmtK`, `≥/≤` threshold rendering, `roasColor` thresholds incl. `colorByPerformance=false`.
