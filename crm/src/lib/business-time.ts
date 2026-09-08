export const BUSINESS_TIME_ZONE = "Asia/Shanghai";
const businessDateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});
function dateParts(value: Date | string) {
    const parts = businessDateFormatter.formatToParts(new Date(value));
    const result = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return { year: Number(result.year), month: Number(result.month), day: Number(result.day) };
}
function utcDateKey(date: Date) {
    return date.toISOString().slice(0, 10);
}
function dateKeyParts(key: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
    if (!match)
        return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day)
        return null;
    return { year, month, day, date };
}
function shiftDateKey(key: string, days: number) {
    const parsed = dateKeyParts(key);
    if (!parsed)
        throw new Error(`无效日期：${key}`);
    parsed.date.setUTCDate(parsed.date.getUTCDate() + days);
    return utcDateKey(parsed.date);
}
function rangeFromKeys(startKey: string, endKey: string, granularity: "day" | "month") {
    return {
        start: new Date(`${startKey}T00:00:00+08:00`),
        end: new Date(new Date(`${shiftDateKey(endKey, 1)}T00:00:00+08:00`).getTime() - 1),
        granularity,
    };
}
export function businessDateKey(value: Date | string) {
    const { year, month, day } = dateParts(value);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
export function businessDateLabel(value: Date | string) {
    return businessDateKey(value).replaceAll("-", ".");
}
export function businessDateTimeInputValue(value: Date | string = new Date()) {
    const date = new Date(value);
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: BUSINESS_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(date);
    const result = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${result.year}-${result.month}-${result.day}T${result.hour}:${result.minute}`;
}
export function normalizeBusinessDateTime(value: string) {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) {
        const normalized = value.length === 16 ? `${value}:00` : value;
        const date = new Date(`${normalized}+08:00`);
        if (!Number.isNaN(date.getTime()))
            return date.toISOString();
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
export function resolveBusinessRange(preset: string, customStart?: string, customEnd?: string, now: Date = new Date()) {
    const todayKey = businessDateKey(now);
    const today = dateKeyParts(todayKey)!;
    if (preset === "today")
        return rangeFromKeys(todayKey, todayKey, "day");
    if (preset === "week") {
        const weekday = today.date.getUTCDay() || 7;
        return rangeFromKeys(shiftDateKey(todayKey, 1 - weekday), shiftDateKey(todayKey, 7 - weekday), "day");
    }
    if (preset === "year") {
        return rangeFromKeys(`${today.year}-01-01`, `${today.year}-12-31`, "month");
    }
    if (preset === "30days")
        return rangeFromKeys(shiftDateKey(todayKey, -29), todayKey, "day");
    if (preset === "custom" && customStart && customEnd) {
        const start = dateKeyParts(customStart);
        const end = dateKeyParts(customEnd);
        if (start && end && customStart <= customEnd) {
            const durationDays = Math.round((end.date.getTime() - start.date.getTime()) / 86400000);
            return rangeFromKeys(customStart, customEnd, durationDays > 90 ? "month" : "day");
        }
    }
    const monthEnd = new Date(Date.UTC(today.year, today.month, 0));
    return rangeFromKeys(`${today.year}-${String(today.month).padStart(2, "0")}-01`, utcDateKey(monthEnd), "day");
}
