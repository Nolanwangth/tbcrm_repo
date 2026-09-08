import { useCallback, useEffect, useRef } from "react";
import { deleteSharedItems, saveSharedSettings, upsertSharedItems, type SharedCollectionName, } from "./serverApi";
import type { AppSettings } from "../types";
export type SyncStatus = "idle" | "saving" | "saved" | "error";
const serialized = (value: unknown) => JSON.stringify(value);
export function useSharedCollectionSync<T extends {
    id: string;
}>(collection: SharedCollectionName, items: T[], initialItems: T[], onStatus: (status: SyncStatus, message?: string) => void) {
    const known = useRef(new Map(initialItems.map((item) => [item.id, serialized(item)])));
    const queue = useRef<Promise<void>>(Promise.resolve());
    const timerRef = useRef<number | undefined>(undefined);
    const commit = useCallback((next: T[]) => {
        window.clearTimeout(timerRef.current);
        const operation = queue.current.catch(() => undefined).then(async () => {
            const currentIds = new Set(next.map(item => item.id));
            const changed = next.filter(item => known.current.get(item.id) !== serialized(item));
            const removed = [...known.current.keys()].filter(id => !currentIds.has(id));
            if (!changed.length && !removed.length)
                return;
            onStatus("saving");
            try {
                for (let start = 0; start < changed.length; start += 500) {
                    const batch = changed.slice(start, start + 500);
                    await upsertSharedItems(collection, batch);
                    batch.forEach(item => known.current.set(item.id, serialized(item)));
                }
                for (let start = 0; start < removed.length; start += 500) {
                    const batch = removed.slice(start, start + 500);
                    await deleteSharedItems(collection, batch);
                    batch.forEach(id => known.current.delete(id));
                }
                onStatus("saved");
            }
            catch (error) {
                onStatus("error", error instanceof Error ? error.message : "共享数据保存失败");
                throw error;
            }
        });
        queue.current = operation;
        return operation;
    }, [collection, onStatus]);
    useEffect(() => {
        timerRef.current = window.setTimeout(() => { void commit(items).catch(() => undefined); }, 700);
        return () => window.clearTimeout(timerRef.current);
    }, [items, commit]);
    return commit;
}
export function useSharedSettingsSync(settings: AppSettings, initialSettings: AppSettings | null, onStatus: (status: SyncStatus, message?: string) => void) {
    const known = useRef(initialSettings ? serialized(initialSettings) : "");
    useEffect(() => {
        const next = serialized(settings);
        if (known.current === next)
            return;
        const timer = window.setTimeout(async () => {
            onStatus("saving");
            try {
                await saveSharedSettings(settings);
                known.current = next;
                onStatus("saved");
            }
            catch (error) {
                onStatus("error", error instanceof Error ? error.message : "共享设置保存失败");
            }
        }, 900);
        return () => window.clearTimeout(timer);
    }, [onStatus, settings]);
}
