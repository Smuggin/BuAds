# Roadmap

Deferred work, tracked so it isn't lost. Nearest-term first.

## Meta write-backs (in progress)

Shipped: a fail-closed write layer ([lib/meta/writeGuard.ts](lib/meta/writeGuard.ts)) gating
pause/resume + daily-budget writes, plus a deliberate test trigger
([app/api/meta/write-test/route.ts](app/api/meta/write-test/route.ts)). Writes require
`META_WRITES_ENABLED=on` and an account in the `META_AD_ACCOUNTS` allowlist.

### Deferred write features

1. **Create / edit campaign objects** — create & edit campaigns, ad sets, and ads via the
   Marketing API (not just status/budget on existing campaigns). Needed to push new objects
   into empty sandbox accounts. New mutations + higher-risk guards; keep behind the same
   master switch + allowlist.
2. **Conversions API (send events)** — send conversion/purchase events to a Meta dataset
   (server-side CAPI). Entirely new subsystem (dataset id, event schema, hashing/PII,
   dedup with the pixel). No code today.

### Follow-ups once sandbox-verified

- Wire the existing UI actions to the guarded write layer: [BudgetModal.tsx](components/campaigns/BudgetModal.tsx)
  (currently local-state only) and campaign pause/resume controls → real writes via
  `/api/meta/write-test` logic (or a dedicated action route) with an in-app confirm.
- Per-account write tokens (`MetaToken.businessId` / kind SYSTEM) instead of one active token.
- Dry-run mode for auto-close ([lib/meta/sync.ts](lib/meta/sync.ts)), matching budget-reset's `dryRun`.
