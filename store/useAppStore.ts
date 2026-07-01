/**
 * Central app state (Zustand). Mirrors the prototype's `state`.
 * Pattern: seed/API value + override maps; pure resolvers (lib/resolvers.ts) merge them.
 * Nothing derived (verdicts, on/off, status) is stored — it is computed on read.
 *
 * Created per-provider-mount (see AppProvider) to stay SSR-safe.
 */
import { createStore } from "zustand/vanilla";
import type {
  AccountKey,
  Category,
  CloseMode,
  MetricKey,
  Product,
  Thresholds,
} from "@/data/types";

export type GroupBy = "product" | "account" | "none";
export type GroupSort = "perf" | "name";
export type SortDir = "asc" | "desc";
export type CampSortKey = MetricKey | "name" | "status" | "open" | "budget";
export type RangeId = "7d" | "30d" | "90d";
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

export interface AppState {
  // theme (DESIGN §2 tweaks)
  accent: AccentKeyTheme;
  colorByPerformance: boolean;

  // top bar
  range: RangeId;
  accountFilter: AccountKey | "all"; // global ad-account scope (metaAccountId | all)

  // notifications
  notifOpen: boolean;
  notifRead: boolean;

  // campaigns: grouping + sorting
  groupBy: GroupBy;
  groupSort: GroupSort;
  groupDir: SortDir;
  campSort: CampSortKey;
  campDir: SortDir;

  // overrides
  campOverride: Record<string, boolean>;
  budgetOverride: Record<string, number>;
  prodThr: Record<string, Partial<Thresholds>>;
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
  setAccountFilter: (account: AccountKey | "all") => void;

  toggleNotif: () => void;
  closeNotif: () => void;

  setGroupBy: (g: GroupBy) => void;
  setGroupSort: (g: GroupSort) => void;
  toggleGroupDir: () => void;
  setCampSort: (key: CampSortKey, firstDir: SortDir) => void;

  toggleCamp: (id: string, defaultOn: boolean) => void;
  setBudgetOverride: (id: string, value: number) => void;
  setThreshold: (sku: string, key: MetricKey, value: number) => void;
  setCloseMode: (sku: string, mode: CloseMode) => void;
  setSkipMetrics: (sku: string, keys: MetricKey[]) => void;
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
  range: "30d",
  accountFilter: "all",
  notifOpen: false,
  notifRead: false,
  groupBy: "product",
  groupSort: "perf",
  groupDir: "desc",
  campSort: "status",
  campDir: "desc",
  campOverride: {},
  budgetOverride: {},
  prodThr: {},
  closeOverride: {},
  skipOverride: {},
  creativeOpen: {},
  ruleOverride: {},
  budgetModal: null,
  assignModal: null,
  historyModal: null,
  campDetail: null,
  editModal: null,
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

export function createAppStore(init: Partial<AppState> = {}) {
  return createStore<AppStore>()((set) => ({
    ...initialAppState,
    ...init,

    setAccent: (accent) => set({ accent }),
    toggleColorByPerformance: () =>
      set((s) => ({ colorByPerformance: !s.colorByPerformance })),
    setRange: (range) => set({ range }),
    setAccountFilter: (accountFilter) => set({ accountFilter }),

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

    toggleCamp: (id, defaultOn) =>
      set((s) => {
        const cur = s.campOverride[id] ?? defaultOn;
        return { campOverride: { ...s.campOverride, [id]: !cur } };
      }),
    setBudgetOverride: (id, value) =>
      set((s) => ({ budgetOverride: { ...s.budgetOverride, [id]: value } })),
    setThreshold: (sku, key, value) =>
      set((s) => ({
        prodThr: {
          ...s.prodThr,
          [sku]: { ...(s.prodThr[sku] ?? {}), [key]: value },
        },
      })),
    setCloseMode: (sku, mode) =>
      set((s) => ({ closeOverride: { ...s.closeOverride, [sku]: mode } })),
    setSkipMetrics: (sku, keys) =>
      set((s) => ({ skipOverride: { ...s.skipOverride, [sku]: keys } })),
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
  }));
}
