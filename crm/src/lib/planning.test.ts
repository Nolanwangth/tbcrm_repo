import { describe, expect, it } from "vitest";
import { deriveBusinessStage } from "@/lib/constants";
import { demoCustomers } from "@/lib/demo-data";
import { filterPlannerCustomers, isCompletedPlannerCustomer, isPendingPlannerCustomer, validatePlanningRequest, } from "@/lib/planning";
function customer(index: number, overrides: Partial<(typeof demoCustomers)[number]>) {
    return { ...demoCustomers[index], ...overrides };
}
describe("业务制作进度", () => {
    it("行程和报价状态可以独立组合并自动推导业务阶段", () => {
        expect(deriveBusinessStage("已出行程", "未出报价")).toBe("制作中");
        expect(deriveBusinessStage("暂不需要", "未出报价")).toBe("制作中");
        expect(deriveBusinessStage("暂不需要", "暂不需要")).toBe("沟通中");
    });
    it("待制作和待修改必须填写对应要求", () => {
        expect(validatePlanningRequest("itinerary", "未出行程", "")).toMatch("行程");
        expect(validatePlanningRequest("quotation", "报价待修改", "  ")).toMatch("报价");
        expect(validatePlanningRequest("itinerary", "已出行程", "")).toBeNull();
    });
    it("规划师工作台正确区分待处理、已完成并排除成交和关闭", () => {
        const pending = customer(0, { status: "跟进中", itineraryStatus: "未出行程" });
        const completed = customer(1, { status: "跟进中", quotationStatus: "已出报价" });
        const won = customer(2, { status: "已成交", itineraryStatus: "未出行程" });
        const closed = customer(3, { status: "已关闭", quotationStatus: "未出报价" });
        expect(isPendingPlannerCustomer(pending)).toBe(true);
        expect(isCompletedPlannerCustomer(completed)).toBe(true);
        expect(filterPlannerCustomers([pending, completed, won, closed], "all")).toHaveLength(2);
    });
    it("双任务客户只出现一行，且同优先级等待最久者优先", () => {
        const older = customer(0, {
            id: "older",
            priority: "高",
            itineraryStatus: "未出行程",
            quotationStatus: "未出报价",
            itineraryStatusUpdatedAt: "2026-07-01T00:00:00Z",
            quotationStatusUpdatedAt: "2026-07-03T00:00:00Z",
        });
        const newer = customer(1, {
            id: "newer",
            priority: "高",
            itineraryStatus: "未出行程",
            itineraryStatusUpdatedAt: "2026-07-05T00:00:00Z",
        });
        const rows = filterPlannerCustomers([newer, older], "pending");
        expect(rows.map((item) => item.id)).toEqual(["older", "newer"]);
        expect(rows.filter((item) => item.id === "older")).toHaveLength(1);
    });
});
