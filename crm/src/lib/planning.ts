import { ITINERARY_PENDING_STATUSES, QUOTATION_PENDING_STATUSES, } from "@/lib/constants";
import type { Customer, ItineraryStatus, PlanningRequestType, QuotationStatus } from "@/lib/types";
export type PlannerTab = "pending" | "completed" | "all";
export function planningRequestRequired(requestType: PlanningRequestType, status: ItineraryStatus | QuotationStatus) {
    return requestType === "itinerary"
        ? ITINERARY_PENDING_STATUSES.includes(status as (typeof ITINERARY_PENDING_STATUSES)[number])
        : QUOTATION_PENDING_STATUSES.includes(status as (typeof QUOTATION_PENDING_STATUSES)[number]);
}
export function validatePlanningRequest(requestType: PlanningRequestType, status: ItineraryStatus | QuotationStatus, content?: string | null) {
    if (planningRequestRequired(requestType, status) && !content?.trim()) {
        return requestType === "itinerary" ? "请填写行程规划或修改要求" : "请填写报价规划或修改要求";
    }
    return null;
}
export function isPlannerCustomer(customer: Customer) {
    return (customer.status === "跟进中" &&
        (customer.itineraryStatus !== "暂不需要" || customer.quotationStatus !== "暂不需要"));
}
export function isPendingPlannerCustomer(customer: Customer) {
    return (isPlannerCustomer(customer) &&
        (ITINERARY_PENDING_STATUSES.includes(customer.itineraryStatus as (typeof ITINERARY_PENDING_STATUSES)[number]) ||
            QUOTATION_PENDING_STATUSES.includes(customer.quotationStatus as (typeof QUOTATION_PENDING_STATUSES)[number])));
}
export function isCompletedPlannerCustomer(customer: Customer) {
    return (isPlannerCustomer(customer) &&
        (customer.itineraryStatus === "已出行程" || customer.quotationStatus === "已出报价"));
}
export function filterPlannerCustomers(customers: Customer[], tab: PlannerTab) {
    const filtered = customers.filter((customer) => {
        if (tab === "pending")
            return isPendingPlannerCustomer(customer);
        if (tab === "completed")
            return isCompletedPlannerCustomer(customer);
        return isPlannerCustomer(customer);
    });
    return [...filtered].sort(comparePlannerCustomers);
}
export function plannerWaitingSince(customer: Customer) {
    const waitingTimes: number[] = [];
    if (ITINERARY_PENDING_STATUSES.includes(customer.itineraryStatus as (typeof ITINERARY_PENDING_STATUSES)[number])) {
        waitingTimes.push(new Date(customer.itineraryStatusUpdatedAt).getTime());
    }
    if (QUOTATION_PENDING_STATUSES.includes(customer.quotationStatus as (typeof QUOTATION_PENDING_STATUSES)[number])) {
        waitingTimes.push(new Date(customer.quotationStatusUpdatedAt).getTime());
    }
    return waitingTimes.length ? Math.min(...waitingTimes) : Number.POSITIVE_INFINITY;
}
export function comparePlannerCustomers(a: Customer, b: Customer) {
    const priority = { "需立即处理": 0, 紧急: 1, 高: 2, 中: 3, 低: 4 };
    const priorityDiff = priority[a.priority] - priority[b.priority];
    if (priorityDiff)
        return priorityDiff;
    return plannerWaitingSince(a) - plannerWaitingSince(b);
}
export function latestPlanningRequest(customer: Customer, requestType: PlanningRequestType) {
    return customer.planningRequests
        .filter((request) => request.requestType === requestType)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}
