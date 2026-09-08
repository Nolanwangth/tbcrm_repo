import { z } from "zod";
import type { AppSettings, DirectQuote, DirectQuoteGroup, PriceProduct, ProposalPlan, RouteTemplate } from "@/quote-v2/types";
import type { ItineraryDocumentDraft } from "@/quote-v2/lib/itineraryDocument";
import { calculateTotals } from "@/quote-v2/lib/logic";
import { PRODUCT_CATEGORIES, PRICING_UNITS, TEMPLATE_TYPES } from "@/quote-v2/types";
export type QuoteV2Snapshot = {
    schemaVersion: 2;
    sourceVersion: "2.0.0";
    customerId: string;
    toolType: "quotation" | "itinerary";
    title: string;
    travelerCount: number;
    partyConfirmed: boolean;
    groupId: string | null;
    mode: "direct" | "quick";
    costsHidden: boolean;
    directQuote: DirectQuote;
    plan: ProposalPlan;
    itinerary: ItineraryDocumentDraft;
    settings: AppSettings;
    products: PriceProduct[];
    templates: RouteTemplate[];
    totals?: ReturnType<typeof calculateTotals>;
};
export type QuoteV2Customer = {
    id: string;
    name: string;
    status: string;
    travelerCount: string | null;
    startDate: string | null;
    endDate: string | null;
    party: {
        adults: number;
        children: number;
        seniors: number;
    } | null;
};
export type QuoteV2Record = {
    id: string;
    proposalId: string;
    title: string;
    revision: number;
    versionNumber?: number;
    note?: string | null;
    schemaVersion: number;
    groupId: string | null;
    snapshot?: QuoteV2Snapshot;
    originalPdf?: boolean;
    createdAt: string;
};
export type QuoteV2Bootstrap = {
    customer: QuoteV2Customer;
    drafts: QuoteV2Record[];
    versions: QuoteV2Record[];
    groups: DirectQuoteGroup[];
    catalog: {
        products: PriceProduct[];
        templates: RouteTemplate[];
        settings: AppSettings;
    };
    catalogRevisions: Record<string, number>;
};
const price = z.number().finite().min(0).max(1e9);
const product = z.object({ id: z.string().min(1), city: z.string(), category: z.enum(PRODUCT_CATEGORIES), nameZh: z.string(), nameEn: z.string(), costPrice: price, quotePrice: price, unit: z.enum(PRICING_UNITS), enabled: z.boolean(), library: z.object({ kind: z.enum(["ticket", "guide", "standard"]), specZh: z.string(), ticketType: z.enum(["adult", "child", "standard"]).optional(), guideHours: z.number().finite().positive().optional() }).passthrough().optional() }).passthrough();
const template = z.object({ id: z.string().min(1), city: z.string(), type: z.enum(TEMPLATE_TYPES), titleZh: z.string(), titleEn: z.string(), routeZh: z.string(), routeEn: z.string(), requiresVehicle: z.boolean(), requiresGuide: z.boolean(), linkedProductIds: z.array(z.string()), includedEn: z.array(z.string()) }).passthrough();
export const quoteV2CatalogSchemas = {
    products: z.array(product).max(20000),
    templates: z.array(template).max(10000),
    settings: z.object({ companyName: z.string(), currency: z.string(), priceIncludes: z.string(), priceExcludes: z.string(), proposalNotice: z.string() }).passthrough(),
};
const item = z.object({ id: z.string(), quantity: z.number().finite().min(0).max(1e6), costPrice: price, quotePrice: price, nameZh: z.string(), nameEn: z.string(), dayId: z.string().optional() }).passthrough();
const quotation = z.object({ people: z.number().int().min(1).max(99), days: z.array(z.object({ id: z.string(), date: z.string() }).passthrough()).max(365), items: z.array(item).max(5000) }).passthrough();
export const quoteV2Schema = z.object({
    schemaVersion: z.literal(2), sourceVersion: z.literal("2.0.0"), customerId: z.string().uuid(), toolType: z.enum(["quotation", "itinerary"]),
    title: z.string().trim().min(1).max(200), travelerCount: z.number().int().min(1).max(99), partyConfirmed: z.boolean(), groupId: z.string().uuid().nullable(),
    mode: z.enum(["direct", "quick"]), costsHidden: z.boolean(), directQuote: quotation, plan: quotation,
    itinerary: z.object({ clientName: z.string(), adults: z.number().int().min(0).max(99), children: z.number().int().min(0).max(99), seniors: z.number().int().min(0).max(99), itineraryText: z.string().max(500000) }),
    settings: z.object({ companyName: z.string(), currency: z.string(), priceIncludes: z.string(), priceExcludes: z.string(), proposalNotice: z.string() }).passthrough(),
    products: quoteV2CatalogSchemas.products, templates: quoteV2CatalogSchemas.templates,
}).passthrough();
export function validateQuoteV2(snapshot: unknown) {
    const result = quoteV2Schema.safeParse(snapshot);
    if (!result.success)
        return { error: `方案数据无效：${result.error.issues[0]?.path.join(".")}` };
    const s = result.data;
    if (s.partyConfirmed && (s.itinerary.adults + s.itinerary.children + s.itinerary.seniors !== s.travelerCount || s.plan.people !== s.travelerCount || s.directQuote.people !== s.travelerCount))
        return { error: "三类人数与方案总人数不一致，请重新核对" };
    return { snapshot: result.data as unknown as QuoteV2Snapshot };
}
