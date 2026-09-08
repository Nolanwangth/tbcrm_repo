import { describe, expect, it } from "vitest";
import { calculateMarginBreakdown, marginCategoryForItem } from "./margin";
import type { QuoteItem } from "../types";
const item = (category: QuoteItem["category"], costPrice: number, quotePrice: number): QuoteItem => ({
    id: category, sourceKey: category, source: "manual", category, nameZh: category, nameEn: category,
    note: "", quantity: 1, costPrice, quotePrice, unit: "每次",
});
describe("three-way margin reporting", () => {
    it("only classifies flights and high-speed rail as transportation", () => {
        expect(marginCategoryForItem(item("机票", 100, 150))).toBe("transportation");
        expect(marginCategoryForItem(item("高铁", 100, 150))).toBe("transportation");
        expect(marginCategoryForItem(item("市区用车", 100, 150))).toBe("service");
        expect(marginCategoryForItem(item("郊区用车", 100, 150))).toBe("service");
        expect(marginCategoryForItem(item("接机", 100, 150))).toBe("service");
        expect(marginCategoryForItem(item("景区交通", 100, 150))).toBe("service");
        expect(marginCategoryForItem(item("缆车", 100, 150))).toBe("service");
        expect(marginCategoryForItem(item("游船", 100, 150))).toBe("service");
        expect(marginCategoryForItem(item("酒店", 500, 600))).toBe("hotel");
        expect(marginCategoryForItem(item("景点门票", 80, 120))).toBe("service");
    });
    it("keeps category totals and weighted overall margin consistent", () => {
        const result = calculateMarginBreakdown([item("机票", 100, 120), item("酒店", 200, 260), item("服务费", 50, 100)]);
        expect(result.transportation.profit).toBe(20);
        expect(result.hotel.profit).toBe(60);
        expect(result.service.profit).toBe(50);
        expect(result.overall).toEqual({ costBasis: 350, quoteBasis: 480, profit: 130, margin: 130 / 480 });
    });
});
