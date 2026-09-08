export const GUIDE_LANGUAGES = [
    "无导游",
    "English",
    "Spanish",
    "Italian",
    "French",
    "German",
    "Chinese",
    "Other",
] as const;
export type GuideLanguage = (typeof GUIDE_LANGUAGES)[number];
export const PRICING_UNITS = ["每次", "每天", "每人", "每人每天", "固定总价"] as const;
export type PricingUnit = (typeof PRICING_UNITS)[number];
export const PRODUCT_CATEGORIES = [
    "市区用车",
    "郊区用车",
    "接机",
    "送机",
    "接站",
    "送站",
    "多语言导游",
    "景点门票",
    "景区交通",
    "缆车",
    "游船",
    "保险",
    "服务费",
    "酒店",
    "机票",
    "高铁",
    "矿泉水或其他小项",
    "自定义项目",
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
export type InvoiceGroup = "service" | "hotel" | "transportation";
export type VehicleServiceType = "private-transfer" | "airport-pickup" | "airport-dropoff" | "station-pickup" | "station-dropoff";
export const TEMPLATE_TYPES = [
    "抵达日",
    "离开日",
    "市区一日游",
    "郊区一日游",
    "夜游或晚间活动",
    "自定义一日模板",
] as const;
export type TemplateType = (typeof TEMPLATE_TYPES)[number];
export interface PriceProduct {
    id: string;
    city: string;
    category: ProductCategory;
    nameZh: string;
    nameEn: string;
    costPrice: number;
    quotePrice: number;
    unit: PricingUnit;
    guideLanguage?: GuideLanguage;
    seatCount?: number;
    enabled: boolean;
    demo?: boolean;
    userAdded?: boolean;
    library?: LibrarySpec;
}
export interface LibrarySpec {
    kind: "ticket" | "guide" | "standard";
    specZh: string;
    ticketType?: "adult" | "child" | "standard";
    guideHours?: number;
    costPending?: boolean;
    quotePending?: boolean;
    source?: {
        file: string;
        sheet: string;
        row: number;
        originalSpec: string;
    };
    warnings?: string[];
}
export interface LibrarySpecSnapshot {
    category?: ProductCategory;
    unit?: PricingUnit;
    productId: string;
    nameEn: string;
    costPrice: number;
    quotePrice: number;
    spec: LibrarySpec;
}
export interface LibraryQuoteMetadata {
    groupId: string;
    productNameZh: string;
    englishBase: string;
    kind: "ticket" | "guide" | "standard";
    spec: LibrarySpec;
    options: LibrarySpecSnapshot[];
}
export interface RouteTemplate {
    id: string;
    city: string;
    type: TemplateType;
    titleZh: string;
    titleEn: string;
    routeZh: string;
    routeEn: string;
    driverCategory?: ProductCategory;
    requiresVehicle: boolean;
    requiresGuide: boolean;
    linkedProductIds: string[];
    includedEn: string[];
    demo?: boolean;
}
export interface DayPlan {
    id: string;
    date: string;
    city: string;
    titleZh: string;
    titleEn: string;
    routeZh: string;
    routeEn: string;
    driverCategory?: ProductCategory;
    requiresVehicle: boolean;
    requiresGuide: boolean;
    guideLanguage?: GuideLanguage;
    linkedProductIds: string[];
    includedEn: string[];
    vehicleProductId?: string;
}
export interface QuoteItem {
    id: string;
    sourceKey: string;
    productId?: string;
    dayId?: string;
    source: "auto" | "manual";
    category: ProductCategory;
    nameZh: string;
    nameEn: string;
    note: string;
    quantity: number;
    costPrice: number;
    quotePrice: number;
    unit: PricingUnit;
    invoiceGroup?: InvoiceGroup;
    invoiceDescriptionEn?: string;
    invoiceDescriptionAuto?: boolean;
    cityEn?: string;
    vehicleSeats?: string;
    customVehicle?: string;
    vehicleServiceType?: VehicleServiceType;
    serviceHours?: string;
    baseQuotePrice?: number;
    travelFeeApplied?: boolean;
    nameEdited?: boolean;
    costEdited?: boolean;
    quoteEdited?: boolean;
    quantityEdited?: boolean;
    libraryQuote?: LibraryQuoteMetadata;
}
export interface ProposalPlan {
    id: string;
    title: string;
    people: number;
    guideLanguage: GuideLanguage;
    autoMatch: boolean;
    days: DayPlan[];
    items: QuoteItem[];
    updatedAt: string;
}
export interface DirectQuote {
    people: number;
    city: string;
    days: DirectQuoteDay[];
    items: QuoteItem[];
    updatedAt: string;
}
export interface DirectQuoteDay {
    id: string;
    date: string;
    title: string;
    city?: string;
}
export interface AppSettings {
    companyName: string;
    currency: "RMB";
    priceIncludes: string;
    priceExcludes: string;
    proposalNotice: string;
}
export interface SavedProposal {
    id: string;
    title: string;
    savedAt: string;
    plan: ProposalPlan;
    customerName: string;
    proposalName: string;
    version: number;
    versionNote?: string;
}
export interface SavedDirectQuote {
    id: string;
    title: string;
    savedAt: string;
    quote: DirectQuote;
    customerName: string;
    proposalName: string;
    version: number;
    versionNote?: string;
    costsHidden: boolean;
    groupId?: string;
}
export interface DirectQuoteGroup {
    id: string;
    name: string;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
}
export interface CustomerPriceLine {
    name: string;
    amount: number;
}
export interface CustomerDay {
    date: string;
    dayLabel: string;
    itinerary: string;
    priceLines: CustomerPriceLine[];
    dayTotal: number;
}
export interface CustomerProposal {
    title: string;
    people: number;
    days: CustomerDay[];
    totalPrice: number;
}
