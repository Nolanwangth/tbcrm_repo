import { describe, expect, it } from "vitest";
import { buildProposalSnapshot, validateProposalDraft, type ProposalDraftInput } from "@/lib/proposals";
const draft: ProposalDraftInput = {
    customerId: "customer-1",
    toolType: "quotation",
    title: "北京报价",
    travelerCount: 2,
    days: [],
    items: [{ category: "景点", nameZh: "故宫", nameEn: "Forbidden City", quantity: 2, costPrice: 100, quotePrice: 180, sortOrder: 0 }],
};
describe("规划师方案版本", () => {
    it("必须使用 customer_id，不能只按姓名保存", () => {
        expect(validateProposalDraft({ ...draft, customerId: "" })).toBe("必须先选择 CRM 客户");
    });
    it("将中英文字段和金额固化到不可变版本快照数据", () => {
        const snapshot = buildProposalSnapshot(draft);
        expect(snapshot.items[0]).toMatchObject({ nameZh: "故宫", nameEn: "Forbidden City" });
        expect(snapshot.totals).toEqual({ cost: 200, quote: 360, grossProfit: 160 });
    });
    it("路线和报价保持独立的最小内容校验", () => {
        expect(validateProposalDraft({ ...draft, items: [] })).toBe("出报价工具至少需要一个报价项目");
        expect(validateProposalDraft({ ...draft, toolType: "itinerary", items: [], days: [] })).toBe("出路线工具至少需要一个 Day");
    });
});
