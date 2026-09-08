import type { Customer } from "@/lib/types";
export type TrendMetric = "inquiries" | "wonCustomers" | "wonAmount";
export type TrendGranularity = "day" | "month";
const CONVERSION_CYCLE_BUCKETS = [
    { label: "0–7 天", min: 0, max: 7 },
    { label: "8–14 天", min: 8, max: 14 },
    { label: "15–30 天", min: 15, max: 30 },
    { label: "31–60 天", min: 31, max: 60 },
    { label: "60 天以上", min: 61, max: Number.POSITIVE_INFINITY },
] as const;
const BUSINESS_TIME_ZONE = "Asia/Shanghai";
function businessDateKey(value: Date | string, granularity: TrendGranularity) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: BUSINESS_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date(value));
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return granularity === "day"
        ? `${values.year}-${values.month}-${values.day}`
        : `${values.year}-${values.month}`;
}
function nextDateKey(key: string, granularity: TrendGranularity) {
    const [year, month, day = 1] = key.split("-").map(Number);
    const cursor = new Date(Date.UTC(year, month - 1, day));
    if (granularity === "day") {
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        return cursor.toISOString().slice(0, 10);
    }
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    return cursor.toISOString().slice(0, 7);
}
function businessCalendarDay(value: Date | string) {
    const [year, month, day] = businessDateKey(value, "day").split("-").map(Number);
    return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}
function average(values: number[]) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}
function median(values: number[]) {
    if (!values.length)
        return null;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
export function conversionCycleDays(firstInquiryAt: string, wonAt: string) {
    const firstTime = new Date(firstInquiryAt).getTime();
    const wonTime = new Date(wonAt).getTime();
    if (!Number.isFinite(firstTime) || !Number.isFinite(wonTime))
        return null;
    const days = businessCalendarDay(wonAt) - businessCalendarDay(firstInquiryAt);
    return days >= 0 ? days : null;
}
function conversionCycleRecords(customers: Customer[], start: Date, end: Date) {
    const wins = customers.filter((customer) => customer.status === "已成交" && inRange(customer.wonAt, start, end));
    const records = wins.flatMap((customer) => {
        if (!customer.wonAt)
            return [];
        const days = conversionCycleDays(customer.firstInquiryAt, customer.wonAt);
        return days == null ? [] : [{ customer, days }];
    });
    return { records, excludedSamples: wins.length - records.length };
}
export function calculateConversionCycleAnalysis(customers: Customer[], start: Date, end: Date, previousStart: Date, previousEnd: Date) {
    const current = conversionCycleRecords(customers, start, end);
    const previous = conversionCycleRecords(customers, previousStart, previousEnd);
    const days = current.records.map((record) => record.days);
    const previousDays = previous.records.map((record) => record.days);
    const averageDays = average(days);
    const previousAverageDays = average(previousDays);
    const distribution = CONVERSION_CYCLE_BUCKETS.map((bucket) => {
        const count = days.filter((value) => value >= bucket.min && value <= bucket.max).length;
        return {
            label: bucket.label,
            count,
            share: days.length ? count / days.length : 0,
        };
    });
    const sourceGroups = new Map<string, number[]>();
    for (const record of current.records) {
        const sourceDays = sourceGroups.get(record.customer.source) ?? [];
        sourceDays.push(record.days);
        sourceGroups.set(record.customer.source, sourceDays);
    }
    const bySource = [...sourceGroups.entries()]
        .map(([source, sourceDays]) => ({
        source,
        samples: sourceDays.length,
        averageDays: average(sourceDays) ?? 0,
        medianDays: median(sourceDays) ?? 0,
    }))
        .sort((a, b) => b.samples - a.samples || a.averageDays - b.averageDays || a.source.localeCompare(b.source, "zh-CN"));
    const slowestCustomers = [...current.records]
        .sort((a, b) => b.days - a.days || String(b.customer.wonAt).localeCompare(String(a.customer.wonAt)))
        .slice(0, 10)
        .map(({ customer, days: cycleDays }) => ({
        id: customer.id,
        name: customer.name,
        source: customer.source,
        firstInquiryAt: customer.firstInquiryAt,
        wonAt: customer.wonAt!,
        cycleDays,
    }));
    return {
        averageDays,
        medianDays: median(days),
        samples: days.length,
        excludedSamples: current.excludedSamples,
        previousAverageDays,
        previousSamples: previousDays.length,
        changeDays: averageDays == null || previousAverageDays == null
            ? null
            : averageDays - previousAverageDays,
        distribution,
        bySource,
        slowestCustomers,
    };
}
export function inRange(value: string | null | undefined, start: Date, end: Date) {
    if (!value)
        return false;
    const time = new Date(value).getTime();
    return time >= start.getTime() && time <= end.getTime();
}
export function calculateDashboard(customers: Customer[], start: Date, end: Date) {
    const inquiryCohort = customers.filter((customer) => inRange(customer.firstInquiryAt, start, end));
    const allActiveCustomers = customers.filter((customer) => customer.status === "跟进中");
    const periodActiveCustomers = inquiryCohort.filter((customer) => customer.status === "跟进中");
    const activeCustomersWithExpectedAmount = periodActiveCustomers.filter((customer) => (customer.expectedAmount ?? 0) > 0);
    const currentWins = customers.filter((customer) => customer.status === "已成交" && inRange(customer.wonAt, start, end));
    const wonAmount = currentWins.reduce((sum, customer) => sum + (customer.wonAmount ?? 0), 0);
    const cohortWins = inquiryCohort.filter((customer) => customer.status === "已成交");
    const cohortWonAmount = cohortWins.reduce((sum, customer) => sum + (customer.wonAmount ?? 0), 0);
    const cohortClosed = inquiryCohort.filter((customer) => customer.status === "已关闭");
    return {
        inquiries: inquiryCohort.length,
        wonCustomers: currentWins.length,
        wonAmount,
        conversionRate: inquiryCohort.length ? currentWins.length / inquiryCohort.length : 0,
        averageOrderValue: currentWins.length ? wonAmount / currentWins.length : 0,
        activeCustomers: allActiveCustomers.length,
        expectedAmountTotal: activeCustomersWithExpectedAmount.reduce((sum, customer) => sum + customer.expectedAmount!, 0),
        expectedAmountFilledCustomers: activeCustomersWithExpectedAmount.length,
        expectedAmountMissingCustomers: periodActiveCustomers.length - activeCustomersWithExpectedAmount.length,
        closedCustomers: cohortClosed.length,
        invalidRate: inquiryCohort.length ? cohortClosed.length / inquiryCohort.length : 0,
        levels: Object.fromEntries(["S", "A", "B", "C"].map((level) => [
            level,
            customers.filter((customer) => customer.status === "跟进中" && customer.level === level).length,
        ])) as Record<Customer["level"], number>,
        planning: {
            unissuedItineraries: customers.filter((customer) => customer.status === "跟进中" && customer.itineraryStatus === "未出行程").length,
            unissuedQuotations: customers.filter((customer) => customer.status === "跟进中" && customer.quotationStatus === "未出报价").length,
            itineraryRevisions: customers.filter((customer) => customer.status === "跟进中" && customer.itineraryStatus === "行程待修改").length,
            quotationRevisions: customers.filter((customer) => customer.status === "跟进中" && customer.quotationStatus === "报价待修改").length,
        },
        cohort: {
            inquiries: inquiryCohort.length,
            wonCustomers: cohortWins.length,
            wonAmount: cohortWonAmount,
            conversionRate: inquiryCohort.length ? cohortWins.length / inquiryCohort.length : 0,
            averageOrderValue: cohortWins.length ? cohortWonAmount / cohortWins.length : 0,
            activeCustomers: inquiryCohort.filter((customer) => customer.status === "跟进中").length,
            closedCustomers: cohortClosed.length,
        },
    };
}
export function aggregateTrend(customers: Customer[], start: Date, end: Date, granularity: TrendGranularity) {
    const points: {
        key: string;
        label: string;
        inquiries: number;
        wonCustomers: number;
        wonAmount: number;
    }[] = [];
    let key = businessDateKey(start, granularity);
    const lastKey = businessDateKey(end, granularity);
    while (key <= lastKey) {
        points.push({ key, label: key, inquiries: 0, wonCustomers: 0, wonAmount: 0 });
        key = nextDateKey(key, granularity);
    }
    const byKey = new Map(points.map((point) => [point.key, point]));
    for (const customer of customers) {
        if (inRange(customer.firstInquiryAt, start, end)) {
            const key = businessDateKey(customer.firstInquiryAt, granularity);
            const point = byKey.get(key);
            if (point)
                point.inquiries += 1;
        }
        if (customer.status === "已成交" && inRange(customer.wonAt, start, end)) {
            const key = businessDateKey(customer.wonAt!, granularity);
            const point = byKey.get(key);
            if (point) {
                point.wonCustomers += 1;
                point.wonAmount += customer.wonAmount ?? 0;
            }
        }
    }
    return points;
}
export function calculateSourceAnalysis(customers: Customer[], start: Date, end: Date) {
    const sources = [...new Set(customers.map((customer) => customer.source))];
    return sources
        .map((source) => {
        const inquiries = customers.filter((customer) => customer.source === source && inRange(customer.firstInquiryAt, start, end)).length;
        const wins = customers.filter((customer) => customer.source === source && customer.status === "已成交" && inRange(customer.wonAt, start, end));
        const wonAmount = wins.reduce((sum, customer) => sum + (customer.wonAmount ?? 0), 0);
        return {
            source,
            inquiries,
            wonCustomers: wins.length,
            wonAmount,
            conversionRate: inquiries ? wins.length / inquiries : 0,
            averageOrderValue: wins.length ? wonAmount / wins.length : 0,
        };
    })
        .filter((row) => row.inquiries || row.wonCustomers)
        .sort((a, b) => b.inquiries - a.inquiries || b.wonAmount - a.wonAmount);
}
