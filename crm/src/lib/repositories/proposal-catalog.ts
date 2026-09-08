import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { ProposalPricingUnit } from "@/lib/proposals";
export type QuoteProduct = {
    id: string;
    city: string;
    category: string;
    nameZh: string;
    nameEn: string;
    costPrice: number;
    quotePrice: number;
    pricingUnit: ProposalPricingUnit;
    guideLanguage: string | null;
    seatCount: number | null;
    enabled: boolean;
};
export type ItineraryTemplate = {
    id: string;
    city: string;
    templateType: "arrival" | "departure" | "city_day" | "outskirts_day" | "evening" | "custom";
    titleZh: string;
    titleEn: string;
    routeZh: string;
    routeEn: string;
    requiresVehicle: boolean;
    requiresGuide: boolean;
    linkedProductIds: string[];
    enabled: boolean;
};
export async function getProposalCatalog() {
    const supabase = getSupabaseAdmin();
    const [{ data: products, error: productError }, { data: templates, error: templateError }] = await Promise.all([
        supabase.from("quote_products").select("id,city,category,name_zh,name_en,cost_price,quote_price,pricing_unit,guide_language,seat_count,enabled").order("city").order("category").order("name_zh"),
        supabase.from("itinerary_templates").select("id,city,template_type,title_zh,title_en,route_zh,route_en,requires_vehicle,requires_guide,linked_product_ids,enabled").order("city").order("title_zh"),
    ]);
    if (productError)
        throw new Error(`读取报价库失败：${productError.message}`);
    if (templateError)
        throw new Error(`读取行程模板失败：${templateError.message}`);
    return {
        products: (products ?? []).map((row) => ({ id: String(row.id), city: String(row.city), category: String(row.category), nameZh: String(row.name_zh), nameEn: String(row.name_en), costPrice: Number(row.cost_price), quotePrice: Number(row.quote_price), pricingUnit: row.pricing_unit as ProposalPricingUnit, guideLanguage: row.guide_language ? String(row.guide_language) : null, seatCount: row.seat_count == null ? null : Number(row.seat_count), enabled: Boolean(row.enabled) })),
        templates: (templates ?? []).map((row) => ({ id: String(row.id), city: String(row.city), templateType: row.template_type as ItineraryTemplate["templateType"], titleZh: String(row.title_zh), titleEn: String(row.title_en), routeZh: String(row.route_zh), routeEn: String(row.route_en), requiresVehicle: Boolean(row.requires_vehicle), requiresGuide: Boolean(row.requires_guide), linkedProductIds: Array.isArray(row.linked_product_ids) ? row.linked_product_ids.map(String) : [], enabled: Boolean(row.enabled) })),
    };
}
