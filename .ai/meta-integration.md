# .ai/meta-integration.md — Live Meta Marketing API integration

Design note for replacing AdsHub's mock data with the real **Meta Marketing API**.
Deferred until after the UI phases (AGENTS.md "Out of scope"), but the seam and field
mappings are pinned here so it drops in cleanly. Pairs with `.ai/data-contracts.md`.

## Status (what's set up)

- **App:** "AdsHub" in Meta for Developers — **App ID `1707035157036750`**, type Business, Development mode (no business verification / App Review needed for our own ad accounts).
- **Use case added:** *Create & manage ads with Marketing API*.
- **Token:** generated via Graph API Explorer; **granted scopes `ads_read`, `ads_management`, `business_management`** (+`public_profile`). Short-lived (~1–2h) — fine for dev/testing.
- **Verified working** (read calls against real data): `/me`, `/me/permissions`, `/me/adaccounts`, `/act_*/campaigns`, `/adsets`, `/ads→creative`, `/act_*/insights`.
- **Accessible ad accounts** (currency THB): `act_228465356501586` (Bu3.3 · BU3), `act_1381638356252543` (คุณธนา01), `act_739752863249917` (Natum Tongiyang), `act_2564930050557181` (Testtest1 · Testtest).
- Credentials live in git-ignored **`.env.local`** (template: `.env.example`).

## The swap seam

```
data/*.ts (mock)  ──>  app/api/*/route.ts  ──>  client ── unchanged ──> components
                            ▲ replace this body with lib/meta/ calls
lib/meta/
  client.ts     # fetch wrapper: base url, version, token, error + rate-limit handling
  map.ts        # Meta response → data/types.ts (Campaign, Creative, Product-less metrics…)
  insights.ts   # build insights queries (fields, level, breakdowns, date_preset)
```

Contracts in `data/types.ts` stay identical, so the KPI engine, store, and UI never change.
Mutations (toggle, budget, auto-close) become server actions / POST routes that call Meta
then refetch — today they only set store overrides.

## Env vars (`.env.local`)

`META_APP_ID`, `META_APP_SECRET` (blank until needed), `META_API_VERSION=v23.0`,
`META_ACCESS_TOKEN`, `META_AD_ACCOUNTS` (comma-separated `act_` ids).

## Endpoint catalog

Base `https://graph.facebook.com/v23.0/`. R = `ads_read`, W = `ads_management`. ✅ tested.

### Identity & accounts → Settings, Overview, account selector
- ✅ R `GET /me`, `GET /me/permissions`
- ✅ R `GET /me/adaccounts` — `fields=account_id,name,currency,account_status,amount_spent,timezone_name,business{id,name}`
- R `GET /me/businesses`, `GET /{business-id}/owned_ad_accounts`, `/client_ad_accounts`
- R `GET /act_{id}` — account detail/balance/spend cap

### Campaign hierarchy → Campaigns, Creatives
- ✅ R `GET /act_{id}/campaigns`, `GET /{campaign-id}` — `id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time`
- ✅ R `GET /act_{id}/adsets`, `GET /{adset-id}` — `+ optimization_goal,billing_event,targeting{age_min,age_max,genders,geo_locations}` (budget + targeting live here)
- ✅ R `GET /act_{id}/ads`, `GET /{ad-id}` — `+ creative{id,name,object_type,thumbnail_url}`
- R `GET /act_{id}/adcreatives`, `GET /{creative-id}`, `GET /act_{id}/adimages`, `/advideos`

### Insights (KPI engine fuel) → Overview, Campaigns judging, Breakdown
- ✅ R `GET /act_{id}/insights` and `/{campaign-id|adset-id|ad-id}/insights`
  - `level=account|campaign|adset|ad`
  - `date_preset=last_7d|last_30d|last_90d` (↔ 7D/30D/90D) or `time_range={since,until}`
  - `time_increment=1` → daily series (Overview daily-spend bars)
  - `breakdowns=age | gender | region | country | publisher_platform | hourly_stats_aggregated_by_advertiser_time_zone` → Breakdown (age/gender/province/day×time)
  - `fields=spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,purchase_roas,actions,action_values,cost_per_action_type`
- R async (large pulls): `POST /act_{id}/insights` → `report_run_id`; poll `GET /{report-run-id}`; `GET /{report-run-id}/insights`

### Writes → toggle, budget modal, auto-close, automation
- W `POST /{campaign-id}` — `status=PAUSED|ACTIVE`, `daily_budget`, `name`
- W `POST /{adset-id}` — `status`, `daily_budget`, `bid_amount`, `targeting`
- W `POST /{ad-id}` — `status`
- W `POST /act_{id}/campaigns | /adsets | /ads | /adcreatives` (create), `DELETE /{id}`
- *Not exercised in testing — writes change live ads.*

### Automated Rules → Automation view (native option vs our own engine)
- R/W `GET|POST /act_{id}/adrules_library`, `GET /{rule-id}`, `/{rule-id}/history`, `POST /{rule-id}/execute`

### Change history → Activity log (manual vs automation)
- R `GET /act_{id}/activities` — budget/status changes, actor, before→after

### Targeting / audiences → Breakdown, future targeting
- R `GET /act_{id}/targetingsearch`, `/targetingbrowse`, `/customaudiences`, `/saved_audiences`

### Catalog (optional) → Product catalog
- R `GET /{business-id}/owned_product_catalogs`, `GET /{catalog-id}/products`
- Our "products" are an app-domain concept; Meta catalogs are an optional join, not required.

### Token tools
- R `GET /debug_token`
- `GET /oauth/access_token?grant_type=fb_exchange_token` — extend to ~60 days (needs `META_APP_SECRET`)
- System User token (Business Settings) for non-expiring production use

## Field → our MetricKey mapping (`lib/meta/map.ts`)

| Our `MetricKey` | Meta insights source | Note |
|---|---|---|
| `roas` | `purchase_roas[].value` (omni_purchase) | array — pick purchase action |
| `ctr` | `ctr` | direct |
| `cpa` | `cost_per_action_type[]` (chosen action) | per optimization goal |
| `cpm` | `cpm` | direct |
| `cpp` (cost/purchase) | `cost_per_action_type[]` where `action_type=purchase`/`omni_purchase` | **NOT** Meta's `cpp` field |
| `cpr` (cost/result) | `cost_per_result` or derive (`spend / results`) | per optimization goal |
| `cost` (daily) | `spend` (with `time_increment=1`) | daily |

Creative metrics: `spend, impressions, ctr, purchase_roas, actions(purchase)→purchases, frequency`.
Audience profile: `breakdowns` of age/gender/region + hourly → our `AudienceProfile` arrays.

## Two correctness gotchas (pin these)

1. **Money units differ by endpoint.** `daily_budget` / `amount_spent` are **minor units** (satang; `"30000"` = ฿300, ÷100). Insights `spend`/`cpm`/etc. are **major units** already (`4745.56` = ฿4,745.56). Normalize in `map.ts`.
2. **Meta `cpp` ≠ our `cpp`.** Meta `cpp` = cost per 1,000 people reached. Our "cpp" = cost per purchase → use `cost_per_action_type` (purchase). Same care for `cpr`.

## Operational

- **Rate limits:** per-account BUC throttling; watch `X-Business-Use-Case-Usage` header. → background sync into a cache/DB on a schedule (Settings says "ทุก 15 นาที"), not fetch-per-pageview.
- **Persistence (new dependency):** tokens + cached insights + our own threshold/catalog/category data need a DB + secret store (the prototype has none).
- **Auth flow (production):** replace the Graph Explorer token with the Settings "เชื่อมต่อ" OAuth flow (Facebook Login) → exchange for long-lived / System User token. `ConnectionAccount.id` is already `act_…`-shaped for this.

## Out of scope until the integration phase

OAuth callback route, DB/secret store, write execution, async insight jobs, webhooks,
TikTok (stays disabled "เร็วๆ นี้"). Build the UI on mock first; this note is the drop-in plan.
