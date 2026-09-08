import type { AppSettings, DirectQuoteGroup, PriceProduct, RouteTemplate, SavedDirectQuote, SavedProposal, } from "../types";
export type SharedCollectionName = "products" | "templates" | "savedProposals" | "savedDirectQuotes";
export interface ServerBootstrap {
    products: PriceProduct[];
    templates: RouteTemplate[];
    savedProposals: SavedProposal[];
    savedDirectQuotes: SavedDirectQuote[];
    settings: AppSettings | null;
    groups: DirectQuoteGroup[];
    version: string;
}
async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const method = init.method ?? "GET";
    const response = await fetch(path, {
        ...init,
        credentials: "same-origin",
        headers: {
            ...(init.body ? { "Content-Type": "application/json" } : {}),
            ...(method !== "GET" && method !== "HEAD" ? { "X-QTP-Request": "1" } : {}),
            ...init.headers,
        },
    });
    const payload = await response.json().catch(() => null) as {
        error?: string;
    } | null;
    if (!response.ok) {
        const error = new Error(payload?.error || `服务器请求失败（${response.status}）`);
        Object.assign(error, { status: response.status });
        throw error;
    }
    return payload as T;
}
export const getAuthStatus = () => api<{
    authenticated: boolean;
    version: string;
}>("/api/auth/status");
export const login = (password: string) => api<{
    ok: true;
    version: string;
}>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ password }),
});
export const logout = () => api<{
    ok: true;
}>("/api/auth/logout", { method: "POST" });
export const loadServerBootstrap = () => api<ServerBootstrap>("/api/v2/bootstrap");
export const upsertSharedItems = (collection: SharedCollectionName, items: Array<{
    id: string;
}>) => api<{
    ok: true;
    count: number;
}>(`/api/${collection === "products" ? "v2/" : ""}collections/${collection}/upsert`, {
    method: "POST",
    body: JSON.stringify({ items }),
});
export const deleteSharedItems = (collection: SharedCollectionName, ids: string[]) => api<{
    ok: true;
    count: number;
}>(`/api/${collection === "products" ? "v2/" : ""}collections/${collection}/delete`, {
    method: "POST",
    body: JSON.stringify({ ids }),
});
export const saveSharedSettings = (settings: AppSettings) => api<{
    ok: true;
}>("/api/settings", {
    method: "PUT",
    body: JSON.stringify({ settings }),
});
export const createDirectQuoteGroup = (name: string) => api<DirectQuoteGroup>("/api/groups", {
    method: "POST",
    body: JSON.stringify({ name }),
});
export const renameDirectQuoteGroup = (id: string, name: string) => api<DirectQuoteGroup>(`/api/groups/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ name }),
});
