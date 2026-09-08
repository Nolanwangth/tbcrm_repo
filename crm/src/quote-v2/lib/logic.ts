import type { CustomerProposal, DayPlan, DirectQuote, DirectQuoteDay, GuideLanguage, PriceProduct, ProposalPlan, QuoteItem, RouteTemplate, } from "../types";
import { createId } from "./id";
import { buildGuideInvoiceDescription, buildVehicleInvoiceDescription, categoryInvoiceGroup, cityEnglish } from "./invoiceDescription";
import { calculateMarginSummary } from "./margin";
import { projectLibraryItems } from "./quoteLibrary";
export const clampPeople = (value: number) => Math.max(1, Math.min(99, Math.floor(Number.isFinite(value) ? value : 1)));
export function recommendSeatCount(people: number): number | null {
    if (people <= 1)
        return 5;
    if (people <= 4)
        return 7;
    if (people <= 6)
        return 9;
    return null;
}
export function quantityForUnit(unit: QuoteItem["unit"], people: number, dayCount = 1): number {
    if (unit === "每人")
        return people;
    if (unit === "每人每天")
        return people * Math.max(1, dayCount);
    if (unit === "每天")
        return Math.max(1, dayCount);
    return 1;
}
export function addDaysToDate(date: string, days: number): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
        return "";
    const [year, month, day] = date.split("-").map(Number);
    const value = new Date(Date.UTC(year, month - 1, day));
    value.setUTCDate(value.getUTCDate() + days);
    return value.toISOString().slice(0, 10);
}
export function cascadeDatesFromFirstDay(days: DayPlan[], firstDate: string): DayPlan[] {
    if (!firstDate)
        return days.map((day) => ({ ...day, date: "" }));
    return days.map((day, index) => ({ ...day, date: addDaysToDate(firstDate, index) }));
}
export function createDayFromTemplate(template: RouteTemplate, index: number): DayPlan {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return {
        id: createId(),
        date: date.toISOString().slice(0, 10),
        city: template.city,
        titleZh: template.titleZh,
        titleEn: template.titleEn,
        routeZh: template.routeZh,
        routeEn: template.routeEn,
        driverCategory: template.driverCategory,
        requiresVehicle: template.requiresVehicle,
        requiresGuide: template.requiresGuide,
        linkedProductIds: [...template.linkedProductIds],
        includedEn: [...template.includedEn],
    };
}
export function createDirectQuoteDay(index: number, firstDate?: string): DirectQuoteDay {
    return {
        id: createId(),
        date: firstDate ? addDaysToDate(firstDate, index) : addDaysToDate(new Date().toISOString().slice(0, 10), index),
        title: `Day ${String(index + 1).padStart(2, "0")}`,
        city: "",
    };
}
export type DirectQuoteDayInsertPosition = "before" | "after";
export type DirectQuoteDayMoveDirection = "up" | "down";
export function normalizeDirectQuoteDayOrder(days: DirectQuoteDay[], firstDate = days[0]?.date ?? ""): DirectQuoteDay[] {
    return days.map((day, index) => ({
        ...day,
        title: `Day ${String(index + 1).padStart(2, "0")}`,
        date: firstDate ? addDaysToDate(firstDate, index) : "",
    }));
}
export function insertDirectQuoteDay(quote: DirectQuote, anchorDayId: string, position: DirectQuoteDayInsertPosition): {
    quote: DirectQuote;
    insertedDayId: string;
} {
    const anchorIndex = quote.days.findIndex((day) => day.id === anchorDayId);
    const insertIndex = anchorIndex < 0
        ? quote.days.length
        : anchorIndex + (position === "after" ? 1 : 0);
    const inheritedCity = quote.days[insertIndex - 1]?.city || quote.days[insertIndex]?.city || quote.city;
    const day = { ...createDirectQuoteDay(insertIndex, quote.days[0]?.date), city: inheritedCity };
    const days = [...quote.days];
    days.splice(insertIndex, 0, day);
    return {
        insertedDayId: day.id,
        quote: { ...quote, days: normalizeDirectQuoteDayOrder(days, quote.days[0]?.date), updatedAt: new Date().toISOString() },
    };
}
export function reorderDirectQuoteDays(quote: DirectQuote, sourceDayId: string, targetDayId: string): DirectQuote {
    if (sourceDayId === targetDayId)
        return quote;
    const days = [...quote.days];
    const sourceIndex = days.findIndex((day) => day.id === sourceDayId);
    const targetIndex = days.findIndex((day) => day.id === targetDayId);
    if (sourceIndex < 0 || targetIndex < 0)
        return quote;
    const [moved] = days.splice(sourceIndex, 1);
    days.splice(targetIndex, 0, moved);
    return { ...quote, days: normalizeDirectQuoteDayOrder(days, quote.days[0]?.date), updatedAt: new Date().toISOString() };
}
export function moveDirectQuoteDay(quote: DirectQuote, dayId: string, direction: DirectQuoteDayMoveDirection): DirectQuote {
    const index = quote.days.findIndex((day) => day.id === dayId);
    const targetIndex = index + (direction === "up" ? -1 : 1);
    if (index < 0 || targetIndex < 0 || targetIndex >= quote.days.length)
        return quote;
    return reorderDirectQuoteDays(quote, dayId, quote.days[targetIndex].id);
}
export function removeDirectQuoteDay(quote: DirectQuote, dayId: string): DirectQuote {
    if (quote.days.length <= 1 || !quote.days.some((day) => day.id === dayId))
        return quote;
    return {
        ...quote,
        days: normalizeDirectQuoteDayOrder(quote.days.filter((day) => day.id !== dayId), quote.days[0]?.date),
        items: quote.items.filter((item) => item.dayId !== dayId),
        updatedAt: new Date().toISOString(),
    };
}
export function resetDirectQuote(quote: DirectQuote): DirectQuote {
    const firstDay = quote.days[0] ?? createDirectQuoteDay(0);
    return {
        ...quote,
        city: firstDay.city || quote.city,
        days: [{ ...firstDay, title: "Day 01" }],
        items: [],
        updatedAt: new Date().toISOString(),
    };
}
const quoteFromProduct = (product: PriceProduct, quantity: number, sourceKey: string, dayId?: string): QuoteItem => ({
    id: createId(),
    sourceKey,
    productId: product.id,
    dayId,
    source: "auto",
    category: product.category,
    nameZh: product.nameZh,
    nameEn: product.nameEn,
    note: "",
    quantity,
    costPrice: product.costPrice,
    quotePrice: product.quotePrice,
    unit: product.unit,
    invoiceGroup: categoryInvoiceGroup(product.category),
    invoiceDescriptionEn: product.nameEn,
    invoiceDescriptionAuto: true,
});
function resolveGuideLanguage(day: DayPlan, globalLanguage: GuideLanguage): GuideLanguage {
    return day.guideLanguage ?? globalLanguage;
}
export function autoItemsForDay(day: DayPlan, plan: ProposalPlan, products: PriceProduct[]): QuoteItem[] {
    const items: QuoteItem[] = [];
    const enabledProducts = products.filter((product) => product.enabled);
    if (day.requiresVehicle) {
        const recommendedSeats = recommendSeatCount(plan.people);
        const vehicle = day.vehicleProductId
            ? enabledProducts.find((product) => product.id === day.vehicleProductId)
            : enabledProducts.find((product) => recommendedSeats !== null &&
                product.city === day.city &&
                product.category === day.driverCategory &&
                product.seatCount === recommendedSeats);
        if (vehicle)
            items.push(quoteFromProduct(vehicle, 1, `day:${day.id}:vehicle`, day.id));
    }
    const language = resolveGuideLanguage(day, plan.guideLanguage);
    if (day.requiresGuide && language !== "无导游") {
        const guide = enabledProducts.find((product) => product.city === day.city &&
            product.category === "多语言导游" &&
            product.guideLanguage === language);
        if (guide)
            items.push(quoteFromProduct(guide, 1, `day:${day.id}:guide`, day.id));
    }
    const linked = new Set(day.linkedProductIds);
    enabledProducts
        .filter((product) => linked.has(product.id))
        .forEach((product) => {
        items.push(quoteFromProduct(product, quantityForUnit(product.unit, plan.people, 1), `day:${day.id}:product:${product.id}`, day.id));
    });
    const vehicleServiceType = {
        接机: "airport-pickup",
        送机: "airport-dropoff",
        接站: "station-pickup",
        送站: "station-dropoff",
    } as const;
    return items.map((item) => {
        if (["市区用车", "郊区用车", "接机", "送机", "接站", "送站"].includes(item.category)) {
            const product = products.find((entry) => entry.id === item.productId);
            const serviceType = item.category in vehicleServiceType
                ? vehicleServiceType[item.category as keyof typeof vehicleServiceType]
                : "private-transfer";
            const seats = product?.seatCount ? String(product.seatCount) : "";
            const description = buildVehicleInvoiceDescription({ city: day.city, seats, customVehicle: "", serviceType, serviceHours: "" });
            return { ...item, invoiceDescriptionEn: description, invoiceDescriptionAuto: true, cityEn: cityEnglish(day.city), vehicleSeats: seats, vehicleServiceType: serviceType };
        }
        if (item.category === "多语言导游") {
            const description = buildGuideInvoiceDescription(day.city, language, "");
            return { ...item, invoiceDescriptionEn: description, invoiceDescriptionAuto: true, cityEn: cityEnglish(day.city), serviceHours: "" };
        }
        return item;
    });
}
function preserveEdits(next: QuoteItem, previous?: QuoteItem): QuoteItem {
    if (!previous)
        return next;
    return {
        ...next,
        id: previous.id,
        nameZh: previous.nameEdited ? previous.nameZh : next.nameZh,
        nameEn: previous.nameEdited ? previous.nameEn : next.nameEn,
        note: previous.note,
        costPrice: previous.costEdited ? previous.costPrice : next.costPrice,
        quotePrice: previous.quoteEdited ? previous.quotePrice : next.quotePrice,
        quantity: previous.quantityEdited ? previous.quantity : next.quantity,
        invoiceDescriptionEn: previous.invoiceDescriptionAuto === false ? previous.invoiceDescriptionEn : next.invoiceDescriptionEn,
        invoiceDescriptionAuto: previous.invoiceDescriptionAuto ?? next.invoiceDescriptionAuto,
        cityEn: previous.cityEn ?? next.cityEn,
        vehicleSeats: previous.vehicleSeats ?? next.vehicleSeats,
        customVehicle: previous.customVehicle ?? next.customVehicle,
        vehicleServiceType: previous.vehicleServiceType ?? next.vehicleServiceType,
        serviceHours: previous.serviceHours ?? next.serviceHours,
        baseQuotePrice: previous.baseQuotePrice ?? next.baseQuotePrice,
        travelFeeApplied: previous.travelFeeApplied ?? next.travelFeeApplied,
        nameEdited: previous.nameEdited,
        costEdited: previous.costEdited,
        quoteEdited: previous.quoteEdited,
        quantityEdited: previous.quantityEdited,
    };
}
export function synchronizeAutoQuote(plan: ProposalPlan, products: PriceProduct[]): ProposalPlan {
    if (!plan.autoMatch)
        return { ...plan, updatedAt: new Date().toISOString() };
    const previousByKey = new Map(plan.items.filter((item) => item.source === "auto").map((item) => [item.sourceKey, item]));
    const manualItems = plan.items.filter((item) => item.source === "manual");
    const enabledProducts = products.filter((product) => product.enabled);
    const dailyDefaults = enabledProducts.filter((product) => product.city === "通用" && (product.category === "保险" || product.category === "服务费"));
    const generated = plan.days.flatMap((day) => {
        const items = autoItemsForDay(day, plan, products);
        dailyDefaults.forEach((product) => {
            if (!items.some((item) => item.category === product.category)) {
                items.push(quoteFromProduct(product, quantityForUnit(product.unit, plan.people, 1), `day:${day.id}:daily:${product.id}`, day.id));
            }
        });
        return items;
    });
    return {
        ...plan,
        items: [...generated.map((item) => preserveEdits(item, previousByKey.get(item.sourceKey))), ...manualItems],
        updatedAt: new Date().toISOString(),
    };
}
export function removeDayAndAutoItems(plan: ProposalPlan, dayId: string): ProposalPlan {
    return {
        ...plan,
        days: plan.days.filter((day) => day.id !== dayId),
        items: plan.items
            .filter((item) => !(item.source === "auto" && item.dayId === dayId))
            .map((item) => item.source === "manual" && item.dayId === dayId ? { ...item, dayId: undefined } : item),
        updatedAt: new Date().toISOString(),
    };
}
export function calculateTotals(items: QuoteItem[]) {
    const costTotal = items.reduce((total, item) => total + item.costPrice * item.quantity, 0);
    const quoteTotal = items.reduce((total, item) => total + item.quotePrice * item.quantity, 0);
    const { profit, margin } = calculateMarginSummary(items);
    return {
        costTotal: Math.round(costTotal),
        quoteTotal: Math.round(quoteTotal),
        profit: Math.round(profit),
        margin,
    };
}
export interface DailyFeeBulkPatch {
    quantity?: number;
    costPrice?: number;
    quotePrice?: number;
}
export interface DailyFeeBulkChanges {
    serviceFee?: DailyFeeBulkPatch;
    insurance?: DailyFeeBulkPatch;
}
export interface DailyFeeImpact {
    itemCount: number;
    dayCount: number;
}
const normalizedBulkValue = (value: number) => Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
const TRAVEL_FEE_NOTE = "报价已包含5%服务费";
export function applyManualQuotePriceEdit(item: QuoteItem, value: number): QuoteItem {
    const quotePrice = normalizedBulkValue(value);
    if (categoryInvoiceGroup(item.category) !== "hotel" && categoryInvoiceGroup(item.category) !== "transportation") {
        return { ...item, quotePrice, quoteEdited: true };
    }
    const note = item.note
        .split(" · ")
        .map((part) => part.trim())
        .filter((part) => part && part !== TRAVEL_FEE_NOTE)
        .join(" · ");
    return {
        ...item,
        quotePrice,
        baseQuotePrice: quotePrice,
        travelFeeApplied: false,
        note,
        quoteEdited: true,
    };
}
export function summarizeDailyFeeImpact(items: QuoteItem[], category: "服务费" | "保险"): DailyFeeImpact {
    const matching = items.filter((item) => item.category === category);
    return {
        itemCount: matching.length,
        dayCount: new Set(matching.map((item) => item.dayId).filter(Boolean)).size,
    };
}
export function applyDailyFeeBulkChanges(items: QuoteItem[], changes: DailyFeeBulkChanges): QuoteItem[] {
    return items.map((item) => {
        const patch = item.category === "服务费"
            ? changes.serviceFee
            : item.category === "保险"
                ? changes.insurance
                : undefined;
        if (!patch)
            return item;
        const next = { ...item };
        if (patch.quantity !== undefined) {
            next.quantity = normalizedBulkValue(patch.quantity);
            next.quantityEdited = true;
        }
        if (patch.costPrice !== undefined) {
            next.costPrice = normalizedBulkValue(patch.costPrice);
            next.costEdited = true;
        }
        if (patch.quotePrice !== undefined) {
            next.quotePrice = normalizedBulkValue(patch.quotePrice);
            next.quoteEdited = true;
        }
        return next;
    });
}
export function addProductToDirectQuote(quote: DirectQuote, product: PriceProduct, dayId: string): DirectQuote {
    const existing = quote.items.find((item) => item.productId === product.id && item.dayId === dayId);
    if (existing) {
        return {
            ...quote,
            items: quote.items.map((item) => item.id === existing.id ? { ...item, quantity: item.quantity + quantityForUnit(product.unit, quote.people) } : item),
            updatedAt: new Date().toISOString(),
        };
    }
    return {
        ...quote,
        items: [
            ...quote.items,
            {
                ...quoteFromProduct(product, quantityForUnit(product.unit, quote.people), `direct:${dayId}:${createId()}`, dayId),
                source: "manual",
            },
        ],
        updatedAt: new Date().toISOString(),
    };
}
export function synchronizeDirectQuoteDailyFees(quote: DirectQuote, products: PriceProduct[]): DirectQuote {
    const defaults = products.filter((product) => product.enabled && product.city === "通用" && (product.category === "保险" || product.category === "服务费"));
    const previousByKey = new Map(quote.items.filter((item) => item.source === "auto").map((item) => [item.sourceKey, item]));
    const manualItems = quote.items.filter((item) => item.source !== "auto");
    const dailyItems = quote.days.flatMap((day) => defaults.map((product) => {
        const next = quoteFromProduct(product, quantityForUnit(product.unit, quote.people, 1), `direct:${day.id}:daily:${product.id}`, day.id);
        return preserveEdits(next, previousByKey.get(next.sourceKey));
    }));
    return { ...quote, items: [...manualItems, ...dailyItems], updatedAt: new Date().toISOString() };
}
export function customerEnglishText(value: string, fallback: string): string {
    const cleaned = value
        .replace(/[（(]\s*[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]+\s*[）)]/g, " ")
        .replace(/[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g, " ")
        .replace(/[（）]/g, " ")
        .replace(/\(\s*\)/g, " ")
        .replace(/[，。；：！？、]/g, " ")
        .replace(/\s+/g, " ")
        .replace(/\s+([,.;:!?])/g, "$1")
        .trim();
    return cleaned || fallback;
}
const customerItemName = (nameEn: string, nameZh: string) => customerEnglishText(nameEn || nameZh, "Custom service");
export function buildCustomerProposal(plan: ProposalPlan): CustomerProposal {
    const globalItems = plan.items.filter((item) => !item.dayId);
    const days = plan.days.map((day, index) => {
        const dayItems = plan.items.filter((item) => item.dayId === day.id);
        const priceLines = [
            ...dayItems.map((item) => ({ name: customerItemName(item.nameEn, item.nameZh), amount: Math.round(item.quotePrice * item.quantity) })),
            ...(index === 0 ? globalItems.map((item) => ({ name: customerItemName(item.nameEn, item.nameZh), amount: Math.round(item.quotePrice * item.quantity) })) : []),
        ];
        return {
            date: day.date,
            dayLabel: `Day ${String(index + 1).padStart(2, "0")}`,
            itinerary: customerEnglishText(day.routeEn || day.routeZh, "Itinerary details to be confirmed"),
            priceLines,
            dayTotal: priceLines.reduce((sum, line) => sum + line.amount, 0),
        };
    });
    return {
        title: "Quick Tour Proposal",
        people: plan.people,
        days,
        totalPrice: calculateTotals(plan.items).quoteTotal,
    };
}
export function generateCustomerText(plan: ProposalPlan): string {
    const proposal = buildCustomerProposal(plan);
    const blocks = proposal.days.map((day) => [
        `${day.dayLabel} · ${day.date}`,
        `Itinerary: ${day.itinerary}`,
        "Price:",
        ...day.priceLines.map((line) => `${line.name}: ${line.amount.toLocaleString("en-US")} RMB`),
        `Day Total: ${day.dayTotal.toLocaleString("en-US")} RMB`,
    ].join("\n"));
    return [proposal.title, "", ...blocks.flatMap((block) => [block, ""]), `Total Price: ${proposal.totalPrice.toLocaleString("en-US")} RMB`].join("\n");
}
export function generateDirectQuoteText(quote: DirectQuote): string {
    const total = calculateTotals(quote.items).quoteTotal;
    const blocks = quote.days.map((day, index) => {
        const items = projectLibraryItems(quote.items.filter((item) => item.dayId === day.id));
        return [
            `Day ${String(index + 1).padStart(2, "0")} · ${day.date || "Date TBD"}`,
            ...items.map((item) => `${customerItemName(item.nameEn, item.nameZh)}${item.libraryQuote ? "" : ` × ${item.quantity}`}: ${(item.quotePrice * item.quantity).toLocaleString("en-US")} RMB`),
            `Day Total: ${calculateTotals(items).quoteTotal.toLocaleString("en-US")} RMB`,
        ].join("\n");
    });
    return [
        "Quick Tour Proposal",
        "",
        ...blocks.flatMap((block) => [block, ""]),
        `Total Price: ${total.toLocaleString("en-US")} RMB`,
    ].join("\n");
}
