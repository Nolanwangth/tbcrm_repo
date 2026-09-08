import type { ProductCategory, QuoteItem } from "../types";
export type QuickQuoteKind = "car-5" | "car-7" | "car-9" | "car-15" | "car-custom" | "guide" | "ticket" | "insurance" | "service-fee" | "hotel" | "flight" | "rail";
export type QuickQuoteIcon = "car" | "guide" | "ticket" | "insurance" | "service-fee" | "hotel" | "flight" | "rail";
export interface QuickQuotePreset {
    id: QuickQuoteKind;
    label: string;
    category: ProductCategory;
    nameZh: string;
    nameEn: string;
    defaultCost: number;
    defaultQuote: number;
    unit: QuoteItem["unit"];
    hint: string;
    icon: QuickQuoteIcon;
    seats?: string;
}
export const QUICK_QUOTE_PRESETS: QuickQuotePreset[] = [
    { id: "car-5", label: "5座车", category: "市区用车", nameZh: "5座用车", nameEn: "5-seat private vehicle", defaultCost: 0, defaultQuote: 0, unit: "每次", hint: "车辆", icon: "car", seats: "5" },
    { id: "car-7", label: "7座车", category: "市区用车", nameZh: "7座用车", nameEn: "7-seat private vehicle", defaultCost: 0, defaultQuote: 0, unit: "每次", hint: "车辆", icon: "car", seats: "7" },
    { id: "car-9", label: "9座车", category: "市区用车", nameZh: "9座用车", nameEn: "9-seat private vehicle", defaultCost: 0, defaultQuote: 0, unit: "每次", hint: "车辆", icon: "car", seats: "9" },
    { id: "car-15", label: "15座车", category: "市区用车", nameZh: "15座用车", nameEn: "15-seat private vehicle", defaultCost: 0, defaultQuote: 0, unit: "每次", hint: "车辆", icon: "car", seats: "15" },
    { id: "car-custom", label: "自定义车型", category: "市区用车", nameZh: "自定义用车", nameEn: "Private vehicle", defaultCost: 0, defaultQuote: 0, unit: "每次", hint: "座位或车型", icon: "car" },
    { id: "guide", label: "导游", category: "多语言导游", nameZh: "英语导游", nameEn: "English-speaking guide", defaultCost: 0, defaultQuote: 0, unit: "每天", hint: "按天", icon: "guide" },
    { id: "ticket", label: "门票", category: "景点门票", nameZh: "景点门票", nameEn: "Attraction ticket", defaultCost: 0, defaultQuote: 0, unit: "每人", hint: "按人", icon: "ticket" },
    { id: "insurance", label: "保险", category: "保险", nameZh: "旅游保险", nameEn: "Travel insurance", defaultCost: 5, defaultQuote: 10, unit: "每人每天", hint: "成本 5 · 报价 10", icon: "insurance" },
    { id: "service-fee", label: "服务费", category: "服务费", nameZh: "行程服务费", nameEn: "Tour service fee", defaultCost: 0, defaultQuote: 30, unit: "每人每天", hint: "成本 0 · 报价 30", icon: "service-fee" },
    { id: "hotel", label: "酒店", category: "酒店", nameZh: "酒店住宿", nameEn: "Hotel accommodation", defaultCost: 0, defaultQuote: 0, unit: "固定总价", hint: "英文描述", icon: "hotel" },
    { id: "flight", label: "机票", category: "机票", nameZh: "机票", nameEn: "Flight ticket", defaultCost: 0, defaultQuote: 0, unit: "固定总价", hint: "英文描述", icon: "flight" },
    { id: "rail", label: "高铁", category: "高铁", nameZh: "高铁票", nameEn: "High-speed rail ticket", defaultCost: 0, defaultQuote: 0, unit: "固定总价", hint: "英文描述", icon: "rail" },
];
export const isDailyFeePreset = (preset: QuickQuotePreset) => preset.category === "保险" || preset.category === "服务费";
export const isVehiclePreset = (preset: QuickQuotePreset) => preset.icon === "car";
export const isTravelPreset = (preset: QuickQuotePreset) => preset.category === "酒店" || preset.category === "机票" || preset.category === "高铁";
