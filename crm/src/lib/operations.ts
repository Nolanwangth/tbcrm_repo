import type { CustomerFile, Priority } from "@/lib/types";
export const OPERATION_PHASES = [
    "processing",
    "waiting",
    "in_service",
    "completed",
    "date_incomplete",
] as const;
export const BOOKING_STATUSES = [
    "pending",
    "booking",
    "confirmed",
    "not_required",
    "cancelled",
] as const;
export const SERVICE_LIST_STATUSES = ["not_uploaded", "uploaded"] as const;
export const OPERATION_SECTIONS = ["daily", "hotel", "transport"] as const;
export const OPERATION_CATEGORIES = [
    "guide",
    "driver",
    "ticket",
    "meal",
    "insurance",
    "other",
    "hotel",
    "flight",
    "rail",
    "other_transport",
] as const;
export const REMINDER_STATUSES = ["pending", "completed", "ignored"] as const;
export const OPERATION_RECORD_STATUSES = ["draft", "active", "cancelled", "archived"] as const;
export type OperationPhase = (typeof OPERATION_PHASES)[number];
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export type ServiceListStatus = (typeof SERVICE_LIST_STATUSES)[number];
export type OperationSection = (typeof OPERATION_SECTIONS)[number];
export type OperationCategory = (typeof OPERATION_CATEGORIES)[number];
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];
export type OperationRecordStatus = (typeof OPERATION_RECORD_STATUSES)[number];
export type ReminderTimingFilter = "all" | "pending" | "overdue" | "today" | "next7" | "upcoming" | "date_pending" | "completed";
export const OPERATION_PHASE_LABELS: Record<OperationPhase, string> = {
    processing: "处理中",
    waiting: "待接待",
    in_service: "服务中",
    completed: "已结束",
    date_incomplete: "日期不完整",
};
export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
    pending: "待预订",
    booking: "预订中",
    confirmed: "已确认",
    not_required: "无需预订",
    cancelled: "已取消",
};
export const SERVICE_LIST_STATUS_LABELS: Record<ServiceListStatus, string> = {
    not_uploaded: "未上传",
    uploaded: "已上传",
};
export const CATEGORY_LABELS: Record<OperationCategory, string> = {
    guide: "导游",
    driver: "司机 / 车辆",
    ticket: "门票",
    meal: "餐饮",
    insurance: "保险",
    other: "其他服务",
    hotel: "酒店",
    flight: "国内航班",
    rail: "高铁 / 火车",
    other_transport: "其他大交通",
};
export interface OperationDay {
    id: string;
    revision?: number;
    dayNumber: number;
    serviceDate: string | null;
    city: string | null;
    summary: string | null;
    notes: string | null;
    sortOrder: number;
}
export interface OperationServiceItem {
    id: string;
    revision?: number;
    routeText?: string | null;
    caseId: string;
    dayId: string | null;
    section: OperationSection;
    category: OperationCategory;
    title: string;
    details: string | null;
    city: string | null;
    serviceDate: string | null;
    bookingStatus: BookingStatus;
    supplierName: string | null;
    quantity: number;
    unit: string;
    invoiceUnitCost: number | null;
    customerUnitQuote: number | null;
    finalSupplierSettlement: number | null;
    finalCustomerSettlement: number | null;
    confirmationFileId: string | null;
    invoiceFileId: string | null;
    checkInDate: string | null;
    checkOutDate: string | null;
    roomType: string | null;
    roomCount: number | null;
    nightCount: number | null;
    transportType: string | null;
    origin: string | null;
    destination: string | null;
    referenceNumber: string | null;
    departureTime: string | null;
    notes: string | null;
    sortOrder: number;
}
export interface OperationReminder {
    id: string;
    caseId: string;
    dayId: string | null;
    serviceItemId: string | null;
    title: string;
    dueDate: string | null;
    anchorType: "arrival" | "service" | "fixed";
    offsetDays: number | null;
    autoKey: string | null;
    isAuto: boolean;
    status: ReminderStatus;
    completedAt: string | null;
    taskKind: "reminder" | "checklist";
    templateKey: string | null;
    templateVersion: string | null;
    assigneeUserId: string | null;
    assigneeName: string | null;
    isCustomized: boolean;
}
export type OperationContactRole = "project_manager" | "guide" | "driver" | "emergency" | "other";
export interface OperationContact {
    id: string;
    revision?: number;
    caseId: string;
    serviceItemId: string | null;
    role: OperationContactRole;
    name: string;
    phone: string | null;
    notes: string | null;
}
export interface OperationCase {
    id: string;
    revision?: number;
    tourCode: string;
    tourName: string;
    customerId: string;
    customerName: string;
    customerStatus: string;
    priority: Priority;
    wonAmount: number | null;
    wonAt: string | null;
    arrivalDate: string | null;
    departureDate: string | null;
    travelerCount: string | null;
    routeInfo: string | null;
    orderTotal: number | null;
    budgetCost: number | null;
    specialRequirements: string | null;
    hotelInformation: string | null;
    customerNotes: string | null;
    recordStatus: OperationRecordStatus;
    creationSource: "won_auto" | "manual";
    archivedAt: string | null;
    ownerName: string | null;
    serviceListStatus: ServiceListStatus;
    serviceListManual: boolean;
    serviceListFileId: string | null;
    notes: string | null;
    days: OperationDay[];
    items: OperationServiceItem[];
    reminders: OperationReminder[];
    contacts?: OperationContact[];
    files: CustomerFile[];
    updatedAt: string;
    createdAt: string;
}
const BOOKING_CATEGORIES = new Set<OperationCategory>([
    "hotel",
    "ticket",
    "flight",
    "rail",
    "other_transport",
]);
export function chinaToday(now = new Date()) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(now);
}
export function operationPhase(operation: Pick<OperationCase, "arrivalDate" | "departureDate"> & {
    items: Pick<OperationServiceItem, 'category' | 'bookingStatus'>[];
}, today = chinaToday()): OperationPhase {
    if (!operation.arrivalDate || !operation.departureDate)
        return "date_incomplete";
    if (today > operation.departureDate)
        return "completed";
    if (today >= operation.arrivalDate)
        return "in_service";
    const bookingItems = operation.items.filter((item) => BOOKING_CATEGORIES.has(item.category) && item.bookingStatus !== "cancelled");
    const hasPendingBooking = bookingItems.length === 0 ||
        bookingItems.some((item) => item.bookingStatus === "pending" || item.bookingStatus === "booking");
    return hasPendingBooking ? "processing" : "waiting";
}
export function bookingProgress(items: Pick<OperationServiceItem, 'category' | 'bookingStatus'>[]) {
    const tracked = items.filter((item) => BOOKING_CATEGORIES.has(item.category) && item.bookingStatus !== "cancelled");
    const finished = tracked.filter((item) => item.bookingStatus === "confirmed" || item.bookingStatus === "not_required");
    return {
        finished: finished.length,
        total: tracked.length,
        percent: tracked.length ? Math.round((finished.length / tracked.length) * 100) : 100,
    };
}
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export function itemFinancials(item: Pick<OperationServiceItem, 'invoiceUnitCost' | 'customerUnitQuote' | 'quantity'>) {
    const cost = item.invoiceUnitCost == null ? 0 : item.invoiceUnitCost * item.quantity;
    const quote = item.customerUnitQuote == null ? 0 : item.customerUnitQuote * item.quantity;
    return {
        cost: roundMoney(cost),
        quote: roundMoney(quote),
        grossProfit: roundMoney(quote - cost),
    };
}
export function operationFinancials(items: Pick<OperationServiceItem, 'invoiceUnitCost' | 'customerUnitQuote' | 'quantity' | 'bookingStatus' | 'finalSupplierSettlement' | 'finalCustomerSettlement'>[]) {
    const active = items.filter((item) => item.bookingStatus !== "cancelled");
    const expected = active.reduce((total, item) => {
        const line = itemFinancials(item);
        total.cost += line.cost;
        total.revenue += line.quote;
        return total;
    }, { cost: 0, revenue: 0 });
    const finalComplete = active.length > 0 &&
        active.every((item) => item.finalSupplierSettlement != null && item.finalCustomerSettlement != null);
    const final = active.reduce((total, item) => {
        total.cost += item.finalSupplierSettlement ?? 0;
        total.revenue += item.finalCustomerSettlement ?? 0;
        return total;
    }, { cost: 0, revenue: 0 });
    const expectedGrossProfit = roundMoney(expected.revenue - expected.cost);
    const finalGrossProfit = roundMoney(final.revenue - final.cost);
    return {
        expectedCost: roundMoney(expected.cost),
        expectedRevenue: roundMoney(expected.revenue),
        expectedGrossProfit,
        expectedMarginRate: expected.revenue ? expectedGrossProfit / expected.revenue : null,
        finalCost: roundMoney(final.cost),
        finalRevenue: roundMoney(final.revenue),
        finalGrossProfit: finalComplete ? finalGrossProfit : null,
        finalMarginRate: finalComplete && final.revenue ? finalGrossProfit / final.revenue : null,
        finalComplete,
    };
}
export function reminderTiming(reminder: Pick<OperationReminder, "status" | "dueDate">, today = chinaToday()) {
    if (reminder.status !== "pending")
        return reminder.status;
    if (!reminder.dueDate)
        return "date_pending";
    if (reminder.dueDate < today)
        return "overdue";
    if (reminder.dueDate === today)
        return "today";
    return "upcoming";
}
export function reminderMatchesTimingFilter(reminder: Pick<OperationReminder, "status" | "dueDate">, filter: ReminderTimingFilter, today = chinaToday(), nextWeekEnd = dateMinusDays(today, -7)) {
    if (filter === "all")
        return true;
    if (filter === "pending")
        return reminder.status === "pending";
    const timing = reminderTiming(reminder, today);
    if (filter === "next7") {
        return timing === "upcoming" && Boolean(reminder.dueDate && reminder.dueDate <= nextWeekEnd);
    }
    return timing === filter;
}
export function dateMinusDays(date: string, days: number) {
    const parsed = new Date(`${date}T12:00:00+08:00`);
    parsed.setUTCDate(parsed.getUTCDate() - days);
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(parsed);
}
export function operationAttachmentFolderName(serviceDate: unknown, title: unknown) {
    const date = String(serviceDate ?? "").trim() || "日期待补充";
    const safeTitle = String(title ?? "")
        .replace(/[\\/]+/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80) || "未命名服务";
    return `${date}-${safeTitle}`;
}
export function validateOperationReminder(input: {
    title: string;
    anchorType: "arrival" | "service" | "fixed";
    dueDate?: string | null;
    arrivalDate?: string | null;
    serviceItemId?: string | null;
    serviceDate?: string | null;
    offsetDays?: number | null;
}) {
    if (!input.title.trim())
        return "请输入提醒内容";
    if (input.anchorType === "fixed") {
        return input.dueDate ? null : "请选择提醒日期";
    }
    if (input.anchorType === "arrival" && !input.arrivalDate) {
        return "请先保存来华日期";
    }
    if (input.anchorType === "service" && !input.serviceItemId) {
        return "请选择关联服务";
    }
    if (input.anchorType === "service" && !input.serviceDate) {
        return "关联服务缺少服务日期";
    }
    return Number.isInteger(input.offsetDays) && Number(input.offsetDays) >= 0
        ? null
        : "请输入有效的提前天数";
}
