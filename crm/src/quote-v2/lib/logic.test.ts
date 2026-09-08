import { describe, expect, it } from "vitest";
import { seedProducts, seedTemplates } from "../data/seed";
import type { ProposalPlan } from "../types";
import { autoItemsForDay, addDaysToDate, applyDailyFeeBulkChanges, applyManualQuotePriceEdit, buildCustomerProposal, calculateTotals, cascadeDatesFromFirstDay, createDirectQuoteDay, createDayFromTemplate, customerEnglishText, generateCustomerText, generateDirectQuoteText, insertDirectQuoteDay, moveDirectQuoteDay, recommendSeatCount, removeDirectQuoteDay, reorderDirectQuoteDays, resetDirectQuote, removeDayAndAutoItems, synchronizeAutoQuote, synchronizeDirectQuoteDailyFees, summarizeDailyFeeImpact, } from "./logic";
const basePlan = (people = 3): ProposalPlan => ({
    id: "plan",
    title: "Test",
    people,
    guideLanguage: "English",
    autoMatch: true,
    days: [],
    items: [],
    updatedAt: "2026-01-01",
});
describe("车型推荐", () => {
    it("1人匹配5座车", () => expect(recommendSeatCount(1)).toBe(5));
    it("2至4人匹配7座车", () => {
        expect(recommendSeatCount(2)).toBe(7);
        expect(recommendSeatCount(4)).toBe(7);
    });
    it("5至6人匹配9座车", () => {
        expect(recommendSeatCount(5)).toBe(9);
        expect(recommendSeatCount(6)).toBe(9);
    });
    it("7人以上要求手动车型", () => expect(recommendSeatCount(7)).toBeNull());
});
describe("行程日期联动", () => {
    it("修改第一天后按自然日连续顺延", () => {
        const template = seedTemplates.find((item) => item.id === "tpl-cd-city")!;
        const days = [0, 1, 2].map((index) => createDayFromTemplate(template, index));
        const updated = cascadeDatesFromFirstDay(days, "2026-12-30");
        expect(updated.map((day) => day.date)).toEqual(["2026-12-30", "2026-12-31", "2027-01-01"]);
    });
    it("跨闰年日期计算正确", () => expect(addDaysToDate("2028-02-28", 1)).toBe("2028-02-29"));
});
describe("自动匹配", () => {
    const day = createDayFromTemplate(seedTemplates.find((template) => template.id === "tpl-cd-city")!, 0);
    it("一天只生成一个导游项目", () => {
        const items = autoItemsForDay(day, { ...basePlan(), days: [day] }, seedProducts);
        expect(items.filter((item) => item.category === "多语言导游")).toHaveLength(1);
    });
    it("一天只生成一个车辆项目", () => {
        const items = autoItemsForDay(day, { ...basePlan(), days: [day] }, seedProducts);
        expect(items.filter((item) => item.category === "市区用车")).toHaveLength(1);
    });
    it("门票数量等于人数", () => {
        const items = autoItemsForDay(day, { ...basePlan(4), days: [day] }, seedProducts);
        expect(items.find((item) => item.category === "景点门票")?.quantity).toBe(4);
    });
    it("手动修改报价价后不修改价格库", () => {
        let plan = synchronizeAutoQuote({ ...basePlan(), days: [day] }, seedProducts);
        const guide = plan.items.find((item) => item.category === "多语言导游")!;
        plan = {
            ...plan,
            items: plan.items.map((item) => item.id === guide.id ? { ...item, quotePrice: 1234, quoteEdited: true } : item),
        };
        plan = synchronizeAutoQuote({ ...plan, people: 4 }, seedProducts);
        expect(plan.items.find((item) => item.id === guide.id)?.quotePrice).toBe(1234);
        expect(seedProducts.find((item) => item.id === guide.productId)?.quotePrice).toBe(900);
    });
    it("删除Day只删除关联自动项目", () => {
        const plan = synchronizeAutoQuote({ ...basePlan(), days: [day] }, seedProducts);
        const manual = { ...plan.items[0], id: "manual", source: "manual" as const, sourceKey: "manual", dayId: day.id };
        const removed = removeDayAndAutoItems({ ...plan, items: [...plan.items, manual] }, day.id);
        expect(removed.items.some((item) => item.source === "auto" && item.dayId === day.id)).toBe(false);
        expect(removed.items.some((item) => item.id === "manual")).toBe(true);
        expect(removed.items.find((item) => item.id === "manual")?.dayId).toBeUndefined();
    });
    it("保险和服务费会分别出现在每一天", () => {
        const secondDay = { ...day, id: "day-2" };
        const plan = synchronizeAutoQuote({ ...basePlan(2), days: [day, secondDay] }, seedProducts);
        expect(plan.items.filter((item) => item.category === "保险")).toHaveLength(2);
        expect(plan.items.filter((item) => item.category === "服务费")).toHaveLength(2);
        expect(plan.items.find((item) => item.category === "保险")).toMatchObject({ costPrice: 5, quotePrice: 10, quantity: 2 });
        expect(plan.items.find((item) => item.category === "服务费")).toMatchObject({ costPrice: 0, quotePrice: 30, quantity: 2 });
    });
});
describe("直接报价按天分组", () => {
    const directQuoteWithThreeDays = () => {
        const days = [0, 1, 2].map((index) => ({
            ...createDirectQuoteDay(index, "2026-08-01"),
            id: `day-${index + 1}`,
            city: index === 0 ? "成都" : "西安",
        }));
        return {
            people: 3,
            city: "成都",
            days,
            items: [{
                    id: "manual-day-3",
                    sourceKey: "manual-day-3",
                    source: "manual" as const,
                    category: "景点门票" as const,
                    nameZh: "兵马俑",
                    nameEn: "Terracotta Warriors",
                    note: "",
                    quantity: 3,
                    costPrice: 100,
                    quotePrice: 150,
                    unit: "每人" as const,
                    dayId: "day-3",
                }],
            updatedAt: "2026-08-01",
        };
    };
    it("可在指定 Day 前插入空白天并连续重排日期和标题", () => {
        const result = insertDirectQuoteDay(directQuoteWithThreeDays(), "day-3", "before");
        expect(result.quote.days.map((day) => day.id)).toEqual(["day-1", "day-2", result.insertedDayId, "day-3"]);
        expect(result.quote.days.map((day) => day.title)).toEqual(["Day 01", "Day 02", "Day 03", "Day 04"]);
        expect(result.quote.days.map((day) => day.date)).toEqual(["2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04"]);
        expect(result.quote.days[2].city).toBe("西安");
        expect(result.quote.items[0].dayId).toBe("day-3");
    });
    it("插入第一天时继承原第一天城市并以原首日日期连续重算", () => {
        const result = insertDirectQuoteDay(directQuoteWithThreeDays(), "day-1", "before");
        expect(result.quote.days[0]).toMatchObject({ id: result.insertedDayId, city: "成都", date: "2026-08-01", title: "Day 01" });
        expect(result.quote.days[1]).toMatchObject({ id: "day-1", date: "2026-08-02", title: "Day 02" });
    });
    it("拖拽重排和上下移动时项目继续跟随原 dayId", () => {
        const reordered = reorderDirectQuoteDays(directQuoteWithThreeDays(), "day-3", "day-1");
        expect(reordered.days.map((day) => day.id)).toEqual(["day-3", "day-1", "day-2"]);
        expect(reordered.days.map((day) => day.date)).toEqual(["2026-08-01", "2026-08-02", "2026-08-03"]);
        expect(reordered.items[0].dayId).toBe("day-3");
        const moved = moveDirectQuoteDay(reordered, "day-3", "down");
        expect(moved.days.map((day) => day.id)).toEqual(["day-1", "day-3", "day-2"]);
        expect(moveDirectQuoteDay(moved, "day-1", "up")).toBe(moved);
    });
    it("删除一天后移除其项目并连续收拢日期", () => {
        const removed = removeDirectQuoteDay(directQuoteWithThreeDays(), "day-2");
        expect(removed.days.map((day) => day.id)).toEqual(["day-1", "day-3"]);
        expect(removed.days.map((day) => day.date)).toEqual(["2026-08-01", "2026-08-02"]);
        expect(removeDirectQuoteDay({ ...removed, days: [removed.days[0]] }, "day-1").days).toHaveLength(1);
    });
    it("手工修改酒店报价会清除旧加价状态并保存为新的基础报价", () => {
        const source = {
            id: "hotel",
            sourceKey: "hotel",
            source: "manual" as const,
            category: "酒店" as const,
            nameZh: "成都智选假日",
            nameEn: "Hotel",
            note: "报价已包含5%服务费",
            quantity: 1,
            costPrice: 500,
            quotePrice: 525,
            baseQuotePrice: 500,
            travelFeeApplied: true,
            unit: "固定总价" as const,
        };
        expect(applyManualQuotePriceEdit(source, 600)).toMatchObject({
            quotePrice: 600,
            baseQuotePrice: 600,
            travelFeeApplied: false,
            quoteEdited: true,
            note: "",
        });
    });
    it("每一天自动生成保险和服务费", () => {
        const days = [createDirectQuoteDay(0, "2026-08-01"), createDirectQuoteDay(1, "2026-08-01")];
        const quote = synchronizeDirectQuoteDailyFees({ people: 3, city: "成都", days, items: [], updatedAt: "2026-01-01" }, seedProducts);
        expect(quote.items.filter((item) => item.category === "保险")).toHaveLength(2);
        expect(quote.items.filter((item) => item.category === "服务费")).toHaveLength(2);
        expect(new Set(quote.items.map((item) => item.dayId))).toEqual(new Set(days.map((day) => day.id)));
    });
    it("批量修改全部日期的服务费和保险，但不修改其他项目", () => {
        const days = [createDirectQuoteDay(0, "2026-08-01"), createDirectQuoteDay(1, "2026-08-01")];
        const quote = synchronizeDirectQuoteDailyFees({ people: 9, city: "成都", days, items: [], updatedAt: "2026-01-01" }, seedProducts);
        const other = { ...quote.items[0], id: "other", category: "景点门票" as const, quantity: 9, costPrice: 100, quotePrice: 150 };
        const items = applyDailyFeeBulkChanges([...quote.items, other], {
            serviceFee: { quantity: 5, costPrice: 2, quotePrice: 40 },
            insurance: { quantity: 9, costPrice: 6, quotePrice: 12 },
        });
        expect(items.filter((item) => item.category === "服务费")).toHaveLength(2);
        expect(items.filter((item) => item.category === "服务费").every((item) => item.quantity === 5 && item.costPrice === 2 && item.quotePrice === 40 &&
            item.quantityEdited === true && item.costEdited === true && item.quoteEdited === true)).toBe(true);
        expect(items.filter((item) => item.category === "保险").every((item) => item.quantity === 9 && item.costPrice === 6 && item.quotePrice === 12)).toBe(true);
        expect(items.find((item) => item.id === "other")).toEqual(other);
    });
    it("留空字段保持原值，且影响范围按项目和日期统计", () => {
        const days = [createDirectQuoteDay(0, "2026-08-01"), createDirectQuoteDay(1, "2026-08-01")];
        const quote = synchronizeDirectQuoteDailyFees({ people: 3, city: "成都", days, items: [], updatedAt: "2026-01-01" }, seedProducts);
        const duplicate = { ...quote.items.find((item) => item.category === "服务费")!, id: "duplicate" };
        const items = applyDailyFeeBulkChanges([...quote.items, duplicate], {
            serviceFee: { quantity: 2 },
        });
        expect(items.filter((item) => item.category === "服务费").every((item) => item.quantity === 2 && item.costPrice === 0 && item.quotePrice === 30)).toBe(true);
        expect(summarizeDailyFeeImpact([...quote.items, duplicate], "服务费")).toEqual({ itemCount: 3, dayCount: 2 });
        expect(summarizeDailyFeeImpact(quote.items, "保险")).toEqual({ itemCount: 2, dayCount: 2 });
    });
});
describe("报价与客户导出", () => {
    it("清空直接报价时只保留 Day 01，并移除所有项目", () => {
        const days = [createDirectQuoteDay(0, "2026-08-01"), createDirectQuoteDay(1, "2026-08-01")];
        const reset = resetDirectQuote({ people: 3, city: "成都", days, items: [{ id: "x", sourceKey: "x", source: "manual", category: "服务费", nameZh: "服务", nameEn: "Service", note: "", quantity: 1, costPrice: 0, quotePrice: 30, unit: "每次", dayId: days[1].id }], updatedAt: "2026-08-01" });
        expect(reset.items).toEqual([]);
        expect(reset.days).toHaveLength(1);
        expect(reset.days[0]).toMatchObject({ id: days[0].id, title: "Day 01" });
    });
    it("毛利和毛利率计算正确", () => {
        const totals = calculateTotals([{ id: "1", sourceKey: "1", source: "manual", category: "自定义项目", nameZh: "x", nameEn: "x", note: "", quantity: 2, costPrice: 100, quotePrice: 150, unit: "每次" }]);
        expect(totals).toEqual({ costTotal: 200, quoteTotal: 300, profit: 100, margin: 1 / 3 });
    });
    it("酒店、机票和高铁也计入综合毛利和毛利率", () => {
        const base = { source: "manual" as const, nameEn: "x", note: "", quantity: 1, unit: "每次" as const };
        const totals = calculateTotals([
            { ...base, id: "service", sourceKey: "service", category: "自定义项目", nameZh: "服务", quantity: 2, costPrice: 100, quotePrice: 150 },
            { ...base, id: "hotel", sourceKey: "hotel", category: "酒店", nameZh: "酒店", costPrice: 500, quotePrice: 550 },
            { ...base, id: "flight", sourceKey: "flight", category: "机票", nameZh: "机票", costPrice: 200, quotePrice: 250 },
            { ...base, id: "rail", sourceKey: "rail", category: "高铁", nameZh: "高铁", costPrice: 100, quotePrice: 120 },
        ]);
        expect(totals).toEqual({ costTotal: 1000, quoteTotal: 1220, profit: 220, margin: 220 / 1220 });
    });
    it("只有酒店和大交通时，也计算综合毛利与毛利率", () => {
        const totals = calculateTotals([
            { id: "hotel", sourceKey: "hotel", source: "manual", category: "酒店", nameZh: "酒店", nameEn: "Hotel", note: "", quantity: 1, costPrice: 500, quotePrice: 550, unit: "每次" },
            { id: "flight", sourceKey: "flight", source: "manual", category: "机票", nameZh: "机票", nameEn: "Flight", note: "", quantity: 1, costPrice: 200, quotePrice: 250, unit: "每次" },
        ]);
        expect(totals).toEqual({ costTotal: 700, quoteTotal: 800, profit: 100, margin: 0.125 });
    });
    it("报价为0时不会除零", () => expect(calculateTotals([]).margin).toBe(0));
    it("客户导出不包含成本与毛利", () => {
        const day = createDayFromTemplate(seedTemplates[1], 0);
        const plan = synchronizeAutoQuote({ ...basePlan(), days: [day] }, seedProducts);
        const result = JSON.stringify(buildCustomerProposal(plan));
        expect(result).not.toContain("costPrice");
        expect(result).not.toContain("margin");
        expect(result).not.toContain("profit");
    });
    it("客户导出不包含中文字符", () => {
        const day = createDayFromTemplate(seedTemplates[1], 0);
        const plan = synchronizeAutoQuote({ ...basePlan(), days: [day] }, seedProducts);
        const persistedPlan = {
            ...plan,
            items: plan.items.map((item) => item.category === "市区用车" ? { ...item, nameEn: "7-seat City car service (成都)" } : item),
        };
        const result = JSON.stringify(buildCustomerProposal(persistedPlan));
        expect(result).not.toMatch(/[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/);
        expect(result).toContain("7-seat City car service");
        expect(result).not.toContain("(成都)");
    });
    it("客户文字导出不再包含 Included 区块", () => {
        const day = createDayFromTemplate(seedTemplates.find((template) => template.id === "tpl-cd-city")!, 0);
        const plan = synchronizeAutoQuote({ ...basePlan(), days: [day] }, seedProducts);
        expect(JSON.stringify(buildCustomerProposal(plan))).not.toContain("included");
        expect(generateCustomerText(plan)).not.toContain("Included:");
    });
    it("直接报价导出会清理混合语言名称", () => {
        const item = { id: "mixed", sourceKey: "mixed", source: "manual" as const, category: "自定义项目" as const, nameZh: "成都用车", nameEn: "Private car (成都)", note: "", quantity: 1, costPrice: 100, quotePrice: 150, unit: "每次" as const };
        const quote = { people: 1, city: "成都", days: [{ id: "day-1", date: "2026-01-01", title: "Day 01" }], items: [{ ...item, dayId: "day-1" }], updatedAt: "2026-01-01" };
        expect(generateDirectQuoteText(quote)).toContain("Private car × 1");
        expect(generateDirectQuoteText(quote)).not.toMatch(/[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/);
    });
    it("纯中文客户字段会使用英文兜底", () => {
        expect(customerEnglishText("成都接机", "Custom service")).toBe("Custom service");
    });
});
