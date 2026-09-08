export type ProposalToolType = "itinerary" | "quotation";
export const PROPOSAL_PRICING_UNITS = ["per_occurrence", "per_day", "per_person", "per_person_day", "fixed_total"] as const;
export type ProposalPricingUnit = (typeof PROPOSAL_PRICING_UNITS)[number];
export type ProposalDayInput = {
    clientKey: string;
    dayNumber: number;
    serviceDate?: string | null;
    city: string;
    titleZh: string;
    titleEn: string;
    routeZh: string;
    routeEn: string;
    requiresVehicle: boolean;
    requiresGuide: boolean;
    notes?: string | null;
};
export type ProposalItemInput = {
    id?: string;
    dayClientKey?: string | null;
    quoteProductId?: string | null;
    source?: "manual" | "template" | "auto";
    category: string;
    nameZh: string;
    nameEn: string;
    details?: string | null;
    quantity: number;
    costPrice: number;
    quotePrice: number;
    pricingUnit?: ProposalPricingUnit;
    sortOrder: number;
};
export type ProposalDraftInput = {
    proposalId?: string;
    customerId: string;
    toolType: ProposalToolType;
    title: string;
    travelerCount: number;
    days: ProposalDayInput[];
    items: ProposalItemInput[];
};
export function buildProposalSnapshot(input: ProposalDraftInput) {
    const totals = input.items.reduce((sum, item) => ({
        cost: sum.cost + item.quantity * item.costPrice,
        quote: sum.quote + item.quantity * item.quotePrice,
    }), { cost: 0, quote: 0 });
    return { ...input, days: [...input.days].sort((a, b) => a.dayNumber - b.dayNumber), items: [...input.items].sort((a, b) => a.sortOrder - b.sortOrder), totals: { ...totals, grossProfit: totals.quote - totals.cost } };
}
export function validateProposalDraft(input: ProposalDraftInput) {
    if (!input.customerId)
        return "必须先选择 CRM 客户";
    if (!input.title.trim())
        return "请填写版本名称";
    if (!Number.isInteger(input.travelerCount) || input.travelerCount < 1 || input.travelerCount > 99)
        return "人数必须为 1 至 99";
    if (input.toolType === "itinerary" && input.days.length === 0)
        return "出路线工具至少需要一个 Day";
    if (input.toolType === "quotation" && input.items.length === 0)
        return "出报价工具至少需要一个报价项目";
    for (const item of input.items) {
        if (!item.category.trim() || !item.nameZh.trim() || !item.nameEn.trim())
            return "报价项目必须填写分类、中英文名称";
        if (!Number.isFinite(item.quantity) || item.quantity <= 0 || item.costPrice < 0 || item.quotePrice < 0)
            return "报价项目的数量和金额无效";
        if (item.pricingUnit && !PROPOSAL_PRICING_UNITS.includes(item.pricingUnit))
            return "报价单位无效";
    }
    return null;
}
