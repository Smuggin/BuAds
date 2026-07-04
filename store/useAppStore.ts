/**
 * Central app state (Zustand). Mirrors the prototype's `state`.
 * Pattern: seed/API value + override maps; pure resolvers (lib/resolvers.ts) merge them.
 * Nothing derived (verdicts, on/off, status) is stored — it is computed on read.
 *
 * Created per-provider-mount (see AppProvider) to stay SSR-safe.
 */
import { createStore } from "zustand/vanilla";
import {
  getSyncState,
  startFullSync,
  startRangeSync,
  type SyncResult,
  type SyncRunDto,
} from "@/lib/api";
import type { CampFilters } from "@/lib/campaigns";
import type {
  AccountKey,
  Category,
  CloseMode,
  MetricKey,
  Product,
  ScaleThresholds,
  Thresholds,
} from "@/data/types";

/** Live-sync progress surfaced on the notifications bell. null = not syncing. */
export interface SyncProgress {
  pct: number; // 0..100
  stage: string; // bilingual current-stage label
}

export type GroupBy = "product" | "account" | "status" | "none";
export type GroupSort = "perf" | "name";
export type SortDir = "asc" | "desc";
export type CampSortKey = MetricKey | "name" | "status" | "open" | "budget";
export type RangeId = "today" | "7d" | "30d" | "90d" | "custom";
export interface CustomRange {
  since: string; // YYYY-MM-DD
  until: string; // YYYY-MM-DD
}
export type AccentKeyTheme = "blue" | "violet" | "green" | "ink";

export interface BudgetModalState {
  id: string;
  draft: number;
}

export interface AssignModalState {
  campaignId: string;
  draftSku: string;
}

export interface NewProductDraft {
  th: string;
  cat: string;
  sku: string;
  cost: string;
  img: string | null;
  accounts: AccountKey[];
}

export interface EditModalState {
  sku: string;
  th: string;
  cat: string;
  cost: string;
  img: string | null;
  accounts: AccountKey[];
}

export const emptyNewProduct = (cat = "Skincare"): NewProductDraft => ({
  th: "",
  cat,
  sku: "",
  cost: "",
  img: null,
  accounts: [],
});

/** KPI summary strip: default visible cards (keys match /api/overview summary.key). */
export const DEFAULT_KPI_KEYS = ["spend", "revenue", "roas", "purchases", "cpa", "ctr"];
const KPI_KEYS_STORAGE = "adshub.kpiCards";

/** Load the user's chosen KPI cards from localStorage (SSR-safe; falls back to default). */
function loadKpiKeys(): string[] {
  if (typeof window === "undefined") return DEFAULT_KPI_KEYS;
  try {
    const raw = window.localStorage.getItem(KPI_KEYS_STORAGE);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) && parsed.length && parsed.every((k) => typeof k === "string")
      ? parsed
      : DEFAULT_KPI_KEYS;
  } catch {
    return DEFAULT_KPI_KEYS;
  }
}

export interface AppState {
  // theme (DESIGN §2 tweaks)
  accent: AccentKeyTheme;
  colorByPerformance: boolean;

  // top bar
  range: RangeId;
  customRange: CustomRange | null; // active dates when range === "custom"
  // bumped when an on-demand range sync lands, so views refetch even when the
  // range value itself didn't change (e.g. the boot-time "today" refresh)
  rangeSyncTick: number;
  accountFilter: AccountKey | "all"; // global ad-account scope (metaAccountId | all)

  // KPI summary strip — which cards are visible (keys from /api/overview superset)
  visibleKpiKeys: string[];

  // notifications
  notifOpen: boolean;
  notifRead: boolean;

  // live manual sync (progress bar on the bell); null when idle
  syncProgress: SyncProgress | null;

  // campaigns: grouping + sorting
  groupBy: GroupBy;
  groupSort: GroupSort;
  groupDir: SortDir;
  campSort: CampSortKey;
  campDir: SortDir;
  campFilters: CampFilters; // ephemeral multi-select filters (status/on-off/product/close/search)

  // overrides
  campOverride: Record<string, boolean>;
  budgetOverride: Record<string, number>;
  prodThr: Record<string, Partial<Thresholds>>;
  prodScale: Record<string, ScaleThresholds>;
  closeOverride: Record<string, CloseMode>;
  skipOverride: Record<string, MetricKey[]>;
  creativeOpen: Record<string, boolean>;
  ruleOverride: Record<string, boolean>;

  // modals / in-page detail
  budgetModal: BudgetModalState | null;
  assignModal: AssignModalState | null;
  historyModal: string | null;
  campDetail: string | null;
  editModal: EditModalState | null;
  saveChangesOpen: boolean; // review-and-confirm modal for staged campaign edits

  // creatives view
  selectedCreative: string;
  mediaAcc: AccountKey | "all";
  mediaProd: string; // sku | "all"

  // activity
  logActor: "all" | "manual" | "auto";

  // catalog / categories
  customProducts: Product[];
  newProd: NewProductDraft;
  prodEdits: Record<string, Partial<Product>>;
  customCats: Category[];
  newCat: string;

  // settings / connections
  connOverride: Record<string, boolean>;
  syncMap: Record<string, string>;
}

export interface AppActions {
  setAccent: (accent: AccentKeyTheme) => void;
  toggleColorByPerformance: () => void;
  setRange: (range: RangeId) => void;
  /** Switch the global range. Presets apply instantly; "today"/"custom" first run
   *  an on-demand sync (streaming into `syncProgress`) then switch. Rejects on error. */
  applyRange: (range: RangeId, custom?: CustomRange | null) => Promise<void>;
  setAccountFilter: (account: AccountKey | "all") => void;
  setVisibleKpiKeys: (keys: string[]) => void;

  toggleNotif: () => void;
  closeNotif: () => void;

  /** Run a live Meta sync, streaming staged progress into `syncProgress`.
   *  Resolves with the final result; rejects (and clears progress) on error. */
  startSync: () => Promise<SyncResult>;

  setGroupBy: (g: GroupBy) => void;
  setGroupSort: (g: GroupSort) => void;
  toggleGroupDir: () => void;
  setCampSort: (key: CampSortKey, firstDir: SortDir) => void;

  /** Toggle one value in an array-valued filter dimension (status/onOff/skus/close). */
  toggleCampFilter: <K extends "status" | "onOff" | "skus" | "close">(
    key: K,
    value: CampFilters[K][number],
  ) => void;
  setCampQuery: (query: string) => void;
  clearCampFilters: () => void;

  toggleCamp: (id: string, defaultOn: boolean) => void;
  setBudgetOverride: (id: string, value: number) => void;
  /** Open / close the review-and-confirm modal for staged campaign edits. */
  openSaveChanges: () => void;
  closeSaveChanges: () => void;
  /** Drop all staged on/off + budget edits (Discard). */
  discardCampaignChanges: () => void;
  /** Drop staged edits for the given campaigns — used after a save commits them. */
  clearCampaignOverrides: (ids: string[]) => void;
  setThreshold: (sku: string, key: MetricKey, value: number) => void;
  setScaleThreshold: (sku: string, key: MetricKey, value: number) => void;
  setCloseMode: (sku: string, mode: CloseMode) => void;
  setSkipMetrics: (sku: string, keys: MetricKey[]) => void;
  /** Drop all Product-KPI drafts (thresholds / skip / close) — after a save persists them. */
  clearKpiDrafts: () => void;
  toggleCreativeOpen: (id: string, defaultOn: boolean) => void;
  toggleRule: (id: string, base: boolean) => void;

  openBudgetModal: (id: string, draft: number) => void;
  setBudgetDraft: (draft: number) => void;
  closeBudgetModal: () => void;

  openAssign: (campaignId: string, currentSku: string) => void;
  setAssignDraft: (sku: string) => void;
  closeAssign: () => void;

  openHistory: (id: string) => void;
  closeHistory: () => void;

  openCampDetail: (id: string) => void;
  closeCampDetail: () => void;

  selectCreative: (id: string) => void;
  setMediaAcc: (acc: AccountKey | "all", snap: { prod: string; sel: string }) => void;
  setMediaProd: (prod: string, sel: string) => void;

  setLogActor: (actor: "all" | "manual" | "auto") => void;

  setNewProd: <K extends keyof NewProductDraft>(
    key: K,
    value: NewProductDraft[K],
  ) => void;
  toggleNewAccount: (key: AccountKey) => void;
  addProduct: (product: Product) => void;
  resetNewProd: () => void;
  removeCustom: (sku: string) => void;

  openEdit: (state: EditModalState) => void;
  setEdit: <K extends keyof EditModalState>(key: K, value: EditModalState[K]) => void;
  toggleEditAccount: (key: AccountKey) => void;
  saveEdit: (sku: string, patch: Partial<Product>) => void;
  closeEdit: () => void;

  setNewCat: (value: string) => void;
  addCategory: (value: string) => void;
  removeCategory: (value: string) => void;

  connectAccount: (id: string) => void;
  disconnectAccount: (id: string) => void;
  resyncAccount: (id: string) => void;
}

export type AppStore = AppState & AppActions;

export const initialAppState: AppState = {
  accent: "blue",
  colorByPerformance: true,
  range: "today",
  customRange: null,
  rangeSyncTick: 0,
  accountFilter: "all",
  visibleKpiKeys: DEFAULT_KPI_KEYS,
  notifOpen: false,
  notifRead: false,
  syncProgress: null,
  groupBy: "product",
  groupSort: "perf",
  groupDir: "desc",
  campSort: "status",
  campDir: "desc",
  campFilters: { status: [], onOff: [], skus: [], close: [], query: "" },
  campOverride: {},
  budgetOverride: {},
  prodThr: {},
  prodScale: {},
  closeOverride: {},
  skipOverride: {},
  creativeOpen: {},
  ruleOverride: {},
  budgetModal: null,
  assignModal: null,
  historyModal: null,
  campDetail: null,
  editModal: null,
  saveChangesOpen: false,
  selectedCreative: "cr1",
  mediaAcc: "all",
  mediaProd: "all",
  logActor: "all",
  customProducts: [],
  newProd: emptyNewProduct(),
  prodEdits: {},
  customCats: [],
  newCat: "",
  connOverride: {},
  syncMap: {},
};

/** Poll cadence for the durable sync state (GET /api/sync/state). */
const SYNC_POLL_MS = 2_500;

export function createAppStore(init: Partial<AppState> = {}) {
  // One poller per sync kind per tab. The server-side SyncRun row is the source
  // of truth (the sync itself runs detached on the server); we mirror pct/stage
  // into syncProgress and resolve with the terminal row when it lands.
  const polls = new Map<string, Promise<SyncRunDto | null>>();

  return createStore<AppStore>()((set, get) => {
    const pollSync = (kind: "full" | "range"): Promise<SyncRunDto | null> => {
      const existing = polls.get(kind);
      if (existing) return existing;
      const p = (async () => {
        try {
          for (;;) {
            await new Promise((r) => setTimeout(r, SYNC_POLL_MS));
            let runs: SyncRunDto[];
            try {
              runs = await getSyncState();
            } catch {
              continue; // transient poll failure — keep polling
            }
            const run = runs.find((r) => r.kind === kind) ?? null;
            if (run && run.status === "running" && !run.stale) {
              set({ syncProgress: { pct: run.pct, stage: run.stage } });
              continue;
            }
            return run; // done | error | stale | idle | missing
          }
        } finally {
          polls.delete(kind);
        }
      })();
      polls.set(kind, p);
      return p;
    };

    /** Terminal-state UI: bump the data tick on success, linger the full bar briefly. */
    const settleProgress = (run: SyncRunDto | null): void => {
      if (run?.status === "done") {
        // bump the data tick so every read view (Overview chart, tables, …) refetches
        // in place — the finished sync rewrote the windows behind the current view.
        set((s) => ({
          rangeSyncTick: s.rangeSyncTick + 1,
          syncProgress: { pct: 100, stage: "เสร็จสิ้น · Done" },
        }));
        setTimeout(() => set((s) => (s.syncProgress?.pct === 100 ? { syncProgress: null } : {})), 1200);
      } else {
        set({ syncProgress: null });
      }
    };

    return {
    ...initialAppState,
    visibleKpiKeys: loadKpiKeys(),
    ...init,

    startSync: async () => {
      // Never throws on a concurrent sync anymore: alreadyRunning → adopt it.
      const { run: initial } = await startFullSync();
      set({ syncProgress: { pct: initial.pct, stage: initial.stage } });
      const run = await pollSync("full");
      if (!run || run.status !== "done" || !run.counts) {
        set({ syncProgress: null });
        throw new Error(run?.error ?? "การซิงค์หยุดกลางคัน · Sync was interrupted");
      }
      settleProgress(run);
      return run.counts as SyncResult;
    },

    setAccent: (accent) => set({ accent }),
    toggleColorByPerformance: () =>
      set((s) => ({ colorByPerformance: !s.colorByPerformance })),
    setRange: (range) => set({ range }),
    applyRange: async (range, custom) => {
      // presets are already cached — switch instantly
      if (range !== "today" && range !== "custom") {
        set({ range, customRange: null });
        return;
      }
      const c = range === "custom" ? custom ?? null : null;
      // Cache-first: flip the view immediately so the last cached snapshot for this
      // range renders while a fresh sync runs detached on the server — never block
      // the UI on a live Meta call. rangeSyncTick bumps on completion to pull the
      // new data. If a range sync is already in flight (boot refresh, another tab),
      // the server says alreadyRunning and we adopt its progress instead.
      set({ range, customRange: c });
      const { run: initial } = await startRangeSync(range, c);
      set({ syncProgress: { pct: initial.pct, stage: initial.stage } });
      const run = await pollSync("range");
      if (run?.status === "error") {
        set({ syncProgress: null });
        throw new Error(run.error ?? "ซิงค์ไม่สำเร็จ · Sync failed");
      }
      settleProgress(run);
      // If the user flipped to a different on-demand range while the adopted run
      // was in flight, that key is still stale — sync it now (the server lock
      // dedupes if several waiters re-kick at once).
      const s = get();
      const wantKey = s.range === "today" ? "today" : s.range === "custom" ? "custom" : null;
      if (wantKey && run?.status === "done" && run.rangeKey !== wantKey) {
        void s.applyRange(s.range, s.customRange ?? undefined).catch(() => {});
      }
    },
    setAccountFilter: (accountFilter) => set({ accountFilter }),

    setVisibleKpiKeys: (visibleKpiKeys) => {
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(KPI_KEYS_STORAGE, JSON.stringify(visibleKpiKeys));
        } catch {
          /* storage unavailable (private mode / quota) — keep in-memory only */
        }
      }
      set({ visibleKpiKeys });
    },

    toggleNotif: () => set((s) => ({ notifOpen: !s.notifOpen, notifRead: true })),
    closeNotif: () => set({ notifOpen: false }),

    setGroupBy: (groupBy) => set({ groupBy }),
    setGroupSort: (groupSort) => set({ groupSort }),
    toggleGroupDir: () =>
      set((s) => ({ groupDir: s.groupDir === "asc" ? "desc" : "asc" })),
    setCampSort: (key, firstDir) =>
      set((s) =>
        s.campSort === key
          ? { campDir: s.campDir === "asc" ? "desc" : "asc" }
          : { campSort: key, campDir: firstDir },
      ),

    toggleCampFilter: (key, value) =>
      set((s) => {
        const arr = s.campFilters[key] as (typeof value)[];
        const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
        return { campFilters: { ...s.campFilters, [key]: next } };
      }),
    setCampQuery: (query) => set((s) => ({ campFilters: { ...s.campFilters, query } })),
    clearCampFilters: () =>
      set({ campFilters: { status: [], onOff: [], skus: [], close: [], query: "" } }),

    toggleCamp: (id, defaultOn) =>
      set((s) => {
        const cur = s.campOverride[id] ?? defaultOn;
        return { campOverride: { ...s.campOverride, [id]: !cur } };
      }),
    setBudgetOverride: (id, value) =>
      set((s) => ({ budgetOverride: { ...s.budgetOverride, [id]: value } })),
    openSaveChanges: () => set({ saveChangesOpen: true }),
    closeSaveChanges: () => set({ saveChangesOpen: false }),
    discardCampaignChanges: () => set({ campOverride: {}, budgetOverride: {} }),
    clearCampaignOverrides: (ids) =>
      set((s) => {
        if (ids.length === 0) return {};
        const drop = new Set(ids);
        const campOverride = Object.fromEntries(
          Object.entries(s.campOverride).filter(([k]) => !drop.has(k)),
        );
        const budgetOverride = Object.fromEntries(
          Object.entries(s.budgetOverride).filter(([k]) => !drop.has(k)),
        );
        return { campOverride, budgetOverride };
      }),
    setThreshold: (sku, key, value) =>
      set((s) => ({
        prodThr: {
          ...s.prodThr,
          [sku]: { ...(s.prodThr[sku] ?? {}), [key]: value },
        },
      })),
    setScaleThreshold: (sku, key, value) =>
      set((s) => ({
        prodScale: {
          ...s.prodScale,
          [sku]: { ...(s.prodScale[sku] ?? {}), [key]: value },
        },
      })),
    setCloseMode: (sku, mode) =>
      set((s) => ({ closeOverride: { ...s.closeOverride, [sku]: mode } })),
    setSkipMetrics: (sku, keys) =>
      set((s) => ({ skipOverride: { ...s.skipOverride, [sku]: keys } })),
    clearKpiDrafts: () => set({ prodThr: {}, prodScale: {}, closeOverride: {}, skipOverride: {} }),
    toggleCreativeOpen: (id, defaultOn) =>
      set((s) => {
        const cur = s.creativeOpen[id] ?? defaultOn;
        return { creativeOpen: { ...s.creativeOpen, [id]: !cur } };
      }),
    toggleRule: (id, base) =>
      set((s) => {
        const cur = s.ruleOverride[id] ?? base;
        return { ruleOverride: { ...s.ruleOverride, [id]: !cur } };
      }),

    openBudgetModal: (id, draft) => set({ budgetModal: { id, draft } }),
    setBudgetDraft: (draft) =>
      set((s) => (s.budgetModal ? { budgetModal: { ...s.budgetModal, draft } } : {})),
    closeBudgetModal: () => set({ budgetModal: null }),

    openAssign: (campaignId, currentSku) =>
      set({ assignModal: { campaignId, draftSku: currentSku } }),
    setAssignDraft: (sku) =>
      set((s) => (s.assignModal ? { assignModal: { ...s.assignModal, draftSku: sku } } : {})),
    closeAssign: () => set({ assignModal: null }),

    openHistory: (id) => set({ historyModal: id }),
    closeHistory: () => set({ historyModal: null }),

    openCampDetail: (id) => set({ campDetail: id }),
    closeCampDetail: () => set({ campDetail: null }),

    selectCreative: (id) => set({ selectedCreative: id }),
    setMediaAcc: (acc, snap) =>
      set({ mediaAcc: acc, mediaProd: snap.prod, selectedCreative: snap.sel }),
    setMediaProd: (prod, sel) => set({ mediaProd: prod, selectedCreative: sel }),

    setLogActor: (logActor) => set({ logActor }),

    setNewProd: (key, value) =>
      set((s) => ({ newProd: { ...s.newProd, [key]: value } })),
    toggleNewAccount: (key) =>
      set((s) => {
        const a = s.newProd.accounts;
        return {
          newProd: {
            ...s.newProd,
            accounts: a.includes(key) ? a.filter((x) => x !== key) : [...a, key],
          },
        };
      }),
    addProduct: (product) =>
      set((s) => ({
        customProducts: [...s.customProducts, product],
        newProd: emptyNewProduct(s.newProd.cat),
      })),
    resetNewProd: () => set((s) => ({ newProd: emptyNewProduct(s.newProd.cat) })),
    removeCustom: (sku) =>
      set((s) => ({ customProducts: s.customProducts.filter((p) => p.sku !== sku) })),

    openEdit: (state) => set({ editModal: state }),
    setEdit: (key, value) =>
      set((s) => (s.editModal ? { editModal: { ...s.editModal, [key]: value } } : {})),
    toggleEditAccount: (key) =>
      set((s) => {
        if (!s.editModal) return {};
        const a = s.editModal.accounts;
        return {
          editModal: {
            ...s.editModal,
            accounts: a.includes(key) ? a.filter((x) => x !== key) : [...a, key],
          },
        };
      }),
    saveEdit: (sku, patch) =>
      set((s) => ({
        prodEdits: { ...s.prodEdits, [sku]: patch },
        editModal: null,
      })),
    closeEdit: () => set({ editModal: null }),

    setNewCat: (newCat) => set({ newCat }),
    addCategory: (value) =>
      set((s) => ({ customCats: [...s.customCats, value], newCat: "" })),
    removeCategory: (value) =>
      set((s) => ({ customCats: s.customCats.filter((c) => c !== value) })),

    connectAccount: (id) =>
      set((s) => ({
        connOverride: { ...s.connOverride, [id]: true },
        syncMap: { ...s.syncMap, [id]: "เพิ่งเชื่อมต่อ" },
      })),
    disconnectAccount: (id) =>
      set((s) => ({ connOverride: { ...s.connOverride, [id]: false } })),
    resyncAccount: (id) =>
      set((s) => ({ syncMap: { ...s.syncMap, [id]: "เมื่อสักครู่" } })),
    };
  });
}
