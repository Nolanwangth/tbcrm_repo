import type { QuoteItem } from "../types";
export type MarginCategory = "transportation" | "hotel" | "service";
const TRANSPORTATION_CATEGORIES = new Set<QuoteItem["category"]>([
    "机票", "高铁",
]);
export function marginCategoryForItem(item: QuoteItem): MarginCategory {
    if (item.category === "酒店")
        return "hotel";
    if (TRANSPORTATION_CATEGORIES.has(item.category))
        return "transportation";
    return "service";
}
export function isMarginEligibleCategory(_category: QuoteItem["category"]): boolean {
    return true;
}
export function calculateMarginSummary(items: QuoteItem[]) {
    const costBasis = items.reduce((total, item) => total + item.costPrice * item.quantity, 0);
    const quoteBasis = items.reduce((total, item) => total + item.quotePrice * item.quantity, 0);
    const profit = quoteBasis - costBasis;
    return {
        costBasis,
        quoteBasis,
        profit,
        margin: quoteBasis === 0 ? 0 : profit / quoteBasis,
    };
}
export function calculateMarginBreakdown(items: QuoteItem[]) {
    const categories: MarginCategory[] = ["transportation", "hotel", "service"];
    const breakdown = Object.fromEntries(categories.map((category) => [category, calculateMarginSummary(items.filter((item) => marginCategoryForItem(item) === category))])) as Record<MarginCategory, ReturnType<typeof calculateMarginSummary>>;
    return { ...breakdown, overall: calculateMarginSummary(items) };
}
