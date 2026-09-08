import { createEmptyPlan, defaultSettings, seedProducts, seedTemplates } from "../data/seed";
import type { AppSettings, DirectQuote, PriceProduct, ProposalPlan, RouteTemplate, SavedDirectQuote, SavedProposal } from "../types";
import { createId } from "./id";
import { synchronizeLibraryDescriptions } from "./quoteLibrary";
import { normalizeSavedDirectQuotes, normalizeSavedProposals } from "./versioning";
export const STORAGE_KEYS = {
    products: "qtp-v2-products",
    templates: "qtp-templates-v1",
    plan: "qtp-v2-current-plan",
    direct: "qtp-v2-direct-quote",
    settings: "qtp-settings-v1",
    saved: "qtp-saved-proposals-v1",
    savedDirect: "qtp-saved-direct-quotes-v1",
} as const;
const read = <T>(key: string, fallback: T): T => {
    try {
        const legacyKey = key === STORAGE_KEYS.plan ? "qtp-current-plan-v1" : key === STORAGE_KEYS.direct ? "qtp-direct-quote-v1" : null;
        const raw = localStorage.getItem(key) ?? (legacyKey ? localStorage.getItem(legacyKey) : null);
        return raw ? (JSON.parse(raw) as T) : fallback;
    }
    catch {
        return fallback;
    }
};
const mergeSeedData = <T extends {
    id: string;
}>(stored: T[], seeded: T[]): T[] => {
    const storedIds = new Set(stored.map((item) => item.id));
    return [...stored, ...seeded.filter((item) => !storedIds.has(item.id))];
};
export const normalizeProducts = (products: PriceProduct[]) => {
    return products;
};
export const loadProducts = () => normalizeProducts(read<PriceProduct[]>(STORAGE_KEYS.products, seedProducts));
export const loadTemplates = () => {
    const stored = read<RouteTemplate[]>(STORAGE_KEYS.templates, []).filter((item) => !item.id.startsWith("import-template-"));
    return mergeSeedData(stored, seedTemplates);
};
export const loadPlan = () => {
    const fallback = createEmptyPlan();
    const stored = read<Partial<ProposalPlan> | null>(STORAGE_KEYS.plan, null);
    const plan: ProposalPlan = stored && Array.isArray(stored.days) && Array.isArray(stored.items)
        ? { ...fallback, ...stored, days: stored.days, items: stored.items }
        : fallback;
    return {
        ...plan,
        days: plan.days.map((day) => {
            const replacement = seedTemplates.find((template) => template.id.startsWith("import-template-") &&
                template.city === day.city &&
                template.titleZh === day.titleZh &&
                template.routeZh === day.routeZh);
            return replacement ? { ...day, linkedProductIds: replacement.linkedProductIds } : day;
        }),
        items: plan.items
            .filter((item) => !item.productId?.startsWith("import-quote-"))
            .map((item) => item.dayId || !plan.days[0] ? item : { ...item, dayId: plan.days[0].id }),
    };
};
export const loadSettings = () => read<AppSettings>(STORAGE_KEYS.settings, defaultSettings);
export const loadSavedProposals = () => normalizeSavedProposals(read<SavedProposal[]>(STORAGE_KEYS.saved, []));
export const loadSavedDirectQuotes = () => normalizeSavedDirectQuotes(read<SavedDirectQuote[]>(STORAGE_KEYS.savedDirect, []));
export const normalizeDirectQuote = (stored: Partial<DirectQuote> | null | undefined): DirectQuote => {
    const source = stored && typeof stored === "object" ? stored : {};
    const days = Array.isArray(source.days) ? source.days : [];
    const items = Array.isArray(source.items) ? source.items : [];
    const firstDay = days[0] ?? { id: createId(), date: new Date().toISOString().slice(0, 10), title: "直接报价", city: source.city || "成都" };
    return {
        people: typeof source.people === "number" ? source.people : 3,
        city: source.city || "成都",
        updatedAt: source.updatedAt || new Date().toISOString(),
        days: days.length ? days.map((day) => ({ ...day, city: day.city || source.city || "成都" })) : [firstDay],
        items: synchronizeLibraryDescriptions(items.map((item) => item.dayId ? item : { ...item, dayId: firstDay.id })),
    };
};
export const loadDirectQuote = (): DirectQuote => normalizeDirectQuote(read<Partial<DirectQuote> | null>(STORAGE_KEYS.direct, {
    people: 3,
    city: "成都",
    days: [],
    items: [],
    updatedAt: new Date().toISOString(),
}));
export const saveLocal = (key: string, value: unknown): boolean => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    }
    catch {
        return false;
    }
};
export const readLocalText = (key: string): string | null => {
    try {
        return localStorage.getItem(key);
    }
    catch {
        return null;
    }
};
export const saveLocalText = (key: string, value: string): boolean => {
    try {
        localStorage.setItem(key, value);
        return true;
    }
    catch {
        return false;
    }
};
export interface BackupPayload {
    version: 1;
    exportedAt: string;
    products: PriceProduct[];
    templates: RouteTemplate[];
    plan: ProposalPlan;
    directQuote: DirectQuote;
    settings: AppSettings;
    savedProposals: SavedProposal[];
    savedDirectQuotes: SavedDirectQuote[];
}
export function makeBackup(payload: Omit<BackupPayload, "version" | "exportedAt">): BackupPayload {
    return { version: 1, exportedAt: new Date().toISOString(), ...payload };
}
export function validateBackup(value: unknown): BackupPayload {
    if (!value || typeof value !== "object")
        throw new Error("备份文件内容无效");
    const payload = value as Partial<BackupPayload>;
    if (payload.version !== 1 || !Array.isArray(payload.products) || !Array.isArray(payload.templates)) {
        throw new Error("不是受支持的 Quick Tour Proposal 备份文件");
    }
    if (!payload.plan || !payload.directQuote || !payload.settings || !Array.isArray(payload.savedProposals)) {
        throw new Error("备份文件缺少必要数据");
    }
    return {
        ...payload,
        savedDirectQuotes: Array.isArray(payload.savedDirectQuotes) ? payload.savedDirectQuotes : [],
    } as BackupPayload;
}
