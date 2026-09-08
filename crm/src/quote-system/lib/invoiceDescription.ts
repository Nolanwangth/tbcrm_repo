import type { GuideLanguage, VehicleServiceType } from "../types";
import { pinyin } from "pinyin-pro";
const CITY_ENGLISH: Record<string, string> = {
    北京: "Beijing",
    上海: "Shanghai",
    重庆: "Chongqing",
    成都: "Chengdu",
    西安: "Xi'an",
    张家界: "Zhangjiajie",
    广州: "Guangzhou",
    深圳: "Shenzhen",
    香港: "Hong Kong",
    杭州: "Hangzhou",
    苏州: "Suzhou",
    桂林: "Guilin",
    阳朔: "Yangshuo",
    昆明: "Kunming",
    丽江: "Lijiang",
    大理: "Dali",
    厦门: "Xiamen",
    武汉: "Wuhan",
    南京: "Nanjing",
    青岛: "Qingdao",
    芙蓉镇: "Furong Town",
};
const PLACE_SUFFIXES: Array<[
    string,
    string
]> = [
    ["特别行政区", "Special Administrative Region"],
    ["自治州", "Autonomous Prefecture"],
    ["自治县", "Autonomous County"],
    ["古城", "Ancient Town"],
    ["古镇", "Ancient Town"],
    ["市", "City"],
    ["县", "County"],
    ["区", "District"],
    ["镇", "Town"],
    ["山", "Mountain"],
    ["湖", "Lake"],
];
const placePinyin = (value: string) => pinyin(value, { toneType: "none", type: "array" })
    .map((syllable) => syllable.toLowerCase())
    .join("")
    .replace(/^./, (letter) => letter.toUpperCase());
const LANGUAGE_ENGLISH: Record<GuideLanguage, string> = {
    无导游: "",
    English: "English",
    Spanish: "Spanish",
    Italian: "Italian",
    French: "French",
    German: "German",
    Chinese: "Chinese",
    Other: "Other-language",
};
export function cityEnglish(city: string): string {
    const trimmed = city.trim();
    const stored = CITY_ENGLISH[trimmed];
    if (stored)
        return stored;
    if (!/[\u3400-\u9fff]/.test(trimmed))
        return trimmed;
    const suffix = PLACE_SUFFIXES.find(([chinese]) => trimmed.endsWith(chinese) && trimmed.length > chinese.length);
    if (!suffix)
        return placePinyin(trimmed);
    const [chinese, english] = suffix;
    return `${placePinyin(trimmed.slice(0, -chinese.length))} ${english}`;
}
export function serviceHoursSuffix(customValue: string): string {
    const trimmed = customValue.trim();
    if (!trimmed)
        return "(Service hours: 8 hrs/day)";
    const withoutParens = trimmed.replace(/^\(([\s\S]*)\)$/, "$1").trim();
    if (/^service hours\s*:/i.test(withoutParens))
        return `(${withoutParens})`;
    return `(Service hours: ${withoutParens})`;
}
export function vehicleLabel(seats: string, customVehicle: string): string {
    const custom = customVehicle.trim();
    if (custom)
        return custom;
    const numericSeats = seats.trim();
    return numericSeats ? `${numericSeats}-seat vehicle` : "private vehicle";
}
export interface VehicleDescriptionInput {
    city: string;
    seats: string;
    customVehicle: string;
    serviceType: VehicleServiceType;
    serviceHours: string;
}
export function buildVehicleInvoiceDescription(input: VehicleDescriptionInput): string {
    const city = cityEnglish(input.city) || "China";
    const vehicle = vehicleLabel(input.seats, input.customVehicle);
    if (input.serviceType === "airport-pickup")
        return `${city} airport pick-up service with ${vehicle}`;
    if (input.serviceType === "airport-dropoff")
        return `${city} airport drop-off service with ${vehicle}`;
    if (input.serviceType === "station-pickup")
        return `${city} station pick-up service with ${vehicle}`;
    if (input.serviceType === "station-dropoff")
        return `${city} station drop-off service with ${vehicle}`;
    return `${city} private transfer service with ${vehicle} ${serviceHoursSuffix(input.serviceHours)}`;
}
export function buildGuideInvoiceDescription(city: string, language: GuideLanguage, serviceHours: string): string {
    const cityName = cityEnglish(city) || "China";
    const languageName = LANGUAGE_ENGLISH[language] || "English";
    return `One-day ${languageName} tour guide service in ${cityName} ${serviceHoursSuffix(serviceHours)}`;
}
export function categoryInvoiceGroup(category: string): "service" | "hotel" | "transportation" {
    if (category === "酒店")
        return "hotel";
    if (category === "机票" || category === "高铁")
        return "transportation";
    return "service";
}
export function applyTravelServiceFee(baseQuotePrice: number, enabled: boolean): number {
    const base = Math.max(0, Number(baseQuotePrice) || 0);
    return enabled ? Math.ceil(base * 1.05) : Math.ceil(base);
}
