import { describe, expect, it } from "vitest";
import { aggregateTrend, calculateConversionCycleAnalysis, calculateDashboard, conversionCycleDays, } from "@/lib/analytics";
import { demoCustomers } from "@/lib/demo-data";
function sample(overrides: Partial<(typeof demoCustomers)[number]>) {
    return { ...demoCustomers[0], ...overrides };
}
describe("Dashboard 统计", () => {
    const juneStart = new Date("2026-06-01T00:00:00Z");
    const juneEnd = new Date("2026-06-30T23:59:59Z");
    it("询单批次支持跨月份成交", () => {
        const crossMonthWin = sample({
            id: "cross-month",
            firstInquiryAt: "2026-06-10T08:00:00Z",
            status: "已成交",
            wonAt: "2026-07-05T08:00:00Z",
            wonAmount: 88000,
        });
        const result = calculateDashboard([crossMonthWin], juneStart, juneEnd);
        expect(result.inquiries).toBe(1);
        expect(result.wonCustomers).toBe(0);
        expect(result.cohort.wonCustomers).toBe(1);
        expect(result.cohort.wonAmount).toBe(88000);
    });
    it("撤销成交后不计入当前成交统计", () => {
        const restored = sample({
            firstInquiryAt: "2026-06-10T08:00:00Z",
            status: "跟进中",
            wonAt: null,
            wonAmount: 52000,
        });
        const result = calculateDashboard([restored], juneStart, juneEnd);
        expect(result.wonCustomers).toBe(0);
        expect(result.wonAmount).toBe(0);
        expect(result.cohort.wonCustomers).toBe(0);
    });
    it("平均客单价和成交率在零分母时安全返回 0", () => {
        const result = calculateDashboard([], juneStart, juneEnd);
        expect(result.averageOrderValue).toBe(0);
        expect(result.conversionRate).toBe(0);
        expect(result.cohort.averageOrderValue).toBe(0);
    });
    it("按天聚合并补齐无数据日期", () => {
        const customer = sample({ firstInquiryAt: "2026-06-02T08:00:00+08:00", status: "跟进中" });
        const points = aggregateTrend([customer], new Date("2026-06-01T00:00:00+08:00"), new Date("2026-06-03T23:59:59+08:00"), "day");
        expect(points.map((point) => point.inquiries)).toEqual([0, 1, 0]);
    });
    it("按月聚合成交金额", () => {
        const customer = sample({
            status: "已成交",
            wonAt: "2026-07-10T08:00:00+08:00",
            wonAmount: 120000,
        });
        const points = aggregateTrend([customer], new Date("2026-06-01T00:00:00+08:00"), new Date("2026-08-31T23:59:59+08:00"), "month");
        expect(points.map((point) => point.wonAmount)).toEqual([0, 120000, 0]);
    });
});
describe("成交周期统计", () => {
    const augustStart = new Date("2026-08-01T00:00:00+08:00");
    const augustEnd = new Date("2026-08-31T23:59:59+08:00");
    const julyStart = new Date("2026-07-01T00:00:00+08:00");
    const julyEnd = new Date("2026-07-31T23:59:59+08:00");
    it("按上海自然日计算，同一天成交为 0 天", () => {
        expect(conversionCycleDays("2026-08-03T00:30:00+08:00", "2026-08-03T23:30:00+08:00")).toBe(0);
        expect(conversionCycleDays("2026-08-03T23:30:00+08:00", "2026-08-04T00:30:00+08:00")).toBe(1);
    });
    it("反向日期不进入统计", () => {
        expect(conversionCycleDays("2026-08-04T08:00:00+08:00", "2026-08-03T08:00:00+08:00")).toBeNull();
    });
    it("计算均值、中位数、上期对比、分布和来源", () => {
        const customers = [
            sample({ id: "a", name: "A", source: "官网", status: "已成交", firstInquiryAt: "2026-08-01T10:00:00+08:00", wonAt: "2026-08-01T12:00:00+08:00" }),
            sample({ id: "b", name: "B", source: "官网", status: "已成交", firstInquiryAt: "2026-08-01T10:00:00+08:00", wonAt: "2026-08-11T12:00:00+08:00" }),
            sample({ id: "c", name: "C", source: "公众号", status: "已成交", firstInquiryAt: "2026-08-01T10:00:00+08:00", wonAt: "2026-08-21T12:00:00+08:00" }),
            sample({ id: "previous", name: "上期", source: "官网", status: "已成交", firstInquiryAt: "2026-07-01T10:00:00+08:00", wonAt: "2026-07-06T12:00:00+08:00" }),
        ];
        const result = calculateConversionCycleAnalysis(customers, augustStart, augustEnd, julyStart, julyEnd);
        expect(result).toMatchObject({
            averageDays: 10,
            medianDays: 10,
            samples: 3,
            previousAverageDays: 5,
            previousSamples: 1,
            changeDays: 5,
        });
        expect(result.distribution.map((bucket) => bucket.count)).toEqual([1, 1, 1, 0, 0]);
        expect(result.bySource[0]).toMatchObject({ source: "官网", samples: 2, averageDays: 5, medianDays: 5 });
        expect(result.slowestCustomers.map((customer) => customer.id)).toEqual(["c", "b", "a"]);
    });
    it("无成交样本时安全返回空统计", () => {
        const result = calculateConversionCycleAnalysis([], augustStart, augustEnd, julyStart, julyEnd);
        expect(result.averageDays).toBeNull();
        expect(result.medianDays).toBeNull();
        expect(result.changeDays).toBeNull();
        expect(result.samples).toBe(0);
    });
});
