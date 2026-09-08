import { createId } from "./id";
import { categoryInvoiceGroup } from "./invoiceDescription";
import type { LibrarySpec, LibrarySpecSnapshot, PriceProduct, QuoteItem } from "../types";
export const libraryProductKey = (p: Pick<PriceProduct, "city" | "category" | "nameZh">) => JSON.stringify([p.city.trim(), p.category, p.nameZh.trim()]);
export const librarySpecKey = (p: PriceProduct) => JSON.stringify([libraryProductKey(p), p.library?.specZh.trim() || ""]);
export const guideBody = (text: string) => text.replace(/\s*\(Service hours:\s*[^)]*\)/ig, "").trim();
export const priceInput = (value: number, pending?: boolean) => pending ? "" : String(value);
export const validPrice = (value: string) => value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;
export const quantityLabel = (spec: LibrarySpec, quantity: number) => spec.kind === "guide"
    ? `${quantity} guide${quantity === 1 ? "" : "s"}`
    : `${quantity} ${spec.ticketType === "adult" ? "adult " : spec.ticketType === "child" ? "child " : ""}ticket${quantity === 1 ? "" : "s"}`;
export interface BookingLine {
    key: string;
    productId: string;
    quantity: number;
    cost: string;
    quote: string;
}
export interface BookingDraft {
    nameZh: string;
    englishBase: string;
    options: LibrarySpecSnapshot[];
    lines: BookingLine[];
    kind: LibrarySpec["kind"];
}
export function bookingLine(option: LibrarySpecSnapshot, quantity = 1): BookingLine {
    return { key: createId(), productId: option.productId, quantity, cost: priceInput(option.costPrice, option.spec.costPending), quote: priceInput(option.quotePrice, option.spec.quotePending) };
}
export function draftFromProducts(products: PriceProduct[], selected: PriceProduct, people: number): BookingDraft {
    const options = products.filter(p => p.enabled && libraryProductKey(p) === libraryProductKey(selected)).map(p => ({ productId: p.id, nameEn: p.nameEn, category: p.category, unit: p.unit, costPrice: p.costPrice, quotePrice: p.quotePrice, spec: structuredClone(p.library || { kind: "standard" as const, specZh: "" }) }));
    const first = options.find(o => o.productId === selected.id)!;
    return { nameZh: selected.nameZh, englishBase: selected.library?.kind === "guide" ? guideBody(selected.nameEn) : selected.nameEn, options, lines: [bookingLine(first, selected.library?.kind === "guide" ? 1 : ["每人", "每人每天"].includes(selected.unit) ? Math.max(1, people) : 1)], kind: first.spec.kind };
}
export function draftFromItems(items: QuoteItem[]): BookingDraft {
    const first = items[0].libraryQuote!;
    return { nameZh: first.productNameZh, englishBase: first.englishBase, kind: first.kind, options: structuredClone(first.options), lines: items.map(i => ({ key: i.id, productId: i.productId!, quantity: i.quantity, cost: String(i.costPrice), quote: String(i.quotePrice) })) };
}
export function bookingValid(draft: BookingDraft) {
    const active = draft.lines.filter(l => l.quantity > 0);
    return !!draft.nameZh.trim() && !!draft.englishBase.trim() && active.length > 0 && draft.lines.every(l => Number.isInteger(l.quantity) && l.quantity >= 0) && active.every(l => validPrice(l.cost) && validPrice(l.quote) && draft.options.some(o => o.productId === l.productId)) && new Set(draft.lines.map(l => l.productId)).size === draft.lines.length;
}
export function bookingDescription(draft: BookingDraft) {
    if (draft.kind === "standard")
        return draft.englishBase.trim();
    const active = draft.lines.filter(l => l.quantity > 0);
    const suffix = active.map(l => { const spec = draft.options.find(o => o.productId === l.productId)!.spec; return spec.kind === "guide" ? `(Service hours: ${spec.guideHours} hrs/day) — ${quantityLabel(spec, l.quantity)}` : quantityLabel(spec, l.quantity); }).join(", ");
    return `${draft.englishBase.trim()}${suffix ? ` — ${suffix}` : ""}`.replace(/ — \(Service hours:/, " (Service hours:");
}
export function bookingToItems(draft: BookingDraft, dayId: string, existing: QuoteItem[] = []): QuoteItem[] {
    if (!bookingValid(draft))
        throw new Error("请填写有效数量、成本及报价，并补齐英文正文");
    const groupId = existing[0]?.libraryQuote?.groupId || createId();
    return draft.lines.filter(l => l.quantity > 0).map(line => {
        const option = draft.options.find(o => o.productId === line.productId)!;
        const old = existing.find(i => i.id === line.key);
        const item: QuoteItem = {
            ...old, id: old?.id || createId(), sourceKey: old?.sourceKey || `manual:${dayId}:${createId()}`, source: "manual", dayId,
            productId: option.productId, category: option.category || (draft.kind === "ticket" ? "景点门票" : "多语言导游"),
            nameZh: `${draft.nameZh}${option.spec.specZh ? ` · ${option.spec.specZh}` : ""}`, nameEn: "", invoiceDescriptionEn: "", invoiceDescriptionAuto: false,
            note: old?.note || "", quantity: line.quantity, costPrice: Number(line.cost), quotePrice: Number(line.quote), unit: option.unit || (draft.kind === "ticket" ? "每人" : "每天"), invoiceGroup: old?.invoiceGroup || categoryInvoiceGroup(option.category || "景点门票"),
            serviceHours: option.spec.guideHours ? `${option.spec.guideHours} hrs/day` : undefined,
            nameEdited: true, costEdited: true, quoteEdited: true, quantityEdited: true,
            libraryQuote: { groupId, productNameZh: draft.nameZh.trim(), englishBase: draft.englishBase.trim(), kind: draft.kind, spec: structuredClone(option.spec), options: structuredClone(draft.options) },
        };
        return synchronizeLibraryDescriptions([item])[0];
    });
}
export function synchronizeLibraryDescriptions(items: QuoteItem[]): QuoteItem[] {
    return items.map(item => {
        if (!item.libraryQuote)
            return item;
        const meta = item.libraryQuote;
        const suffix = meta.kind === "standard" ? "" : meta.kind === "guide" ? ` (Service hours: ${meta.spec.guideHours} hrs/day) — ${quantityLabel(meta.spec, item.quantity)}` : ` — ${quantityLabel(meta.spec, item.quantity)}`;
        const description = meta.englishBase + suffix;
        return item.nameEn === description && item.invoiceDescriptionEn === description ? item : { ...item, nameEn: description, invoiceDescriptionEn: description };
    });
}
export function groupQuoteItems(items: QuoteItem[]): QuoteItem[][] {
    const groups: QuoteItem[][] = [];
    const index = new Map<string, QuoteItem[]>();
    items.forEach(item => {
        if (!item.libraryQuote) {
            groups.push([item]);
            return;
        }
        const key = JSON.stringify([item.dayId, item.libraryQuote.groupId, item.invoiceGroup, item.libraryQuote.englishBase]);
        const group = index.get(key);
        if (group)
            group.push(item);
        else {
            const next = [item];
            index.set(key, next);
            groups.push(next);
        }
    });
    return groups;
}
export function projectLibraryItems(items: QuoteItem[]): QuoteItem[] {
    return groupQuoteItems(synchronizeLibraryDescriptions(items).filter(i => !i.libraryQuote || i.quantity > 0)).map(group => {
        const first = group[0];
        if (!first.libraryQuote)
            return first;
        const description = bookingDescription(draftFromItems(group));
        if (group.length === 1)
            return { ...first, nameZh: first.libraryQuote.productNameZh, nameEn: description, invoiceDescriptionEn: description };
        return { ...first, nameZh: first.libraryQuote.productNameZh, nameEn: description, invoiceDescriptionEn: description, quantity: 1, unit: "固定总价", costPrice: group.reduce((sum, i) => sum + i.quantity * i.costPrice, 0), quotePrice: group.reduce((sum, i) => sum + i.quantity * i.quotePrice, 0) };
    });
}
