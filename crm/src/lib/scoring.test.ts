import { describe, expect, it } from "vitest";
import { amountRangeFromValue } from "@/lib/constants";
import { calculateInitialScore } from "@/lib/scoring";
describe("首次评分 V2", () => {
    it("高意向且信息完整、金额达到1.5万元的客户建议为S级", () => {
        const result = calculateInitialScore({
            travelNeed: {
                flightStatus: "已购买",
                hotelStatus: "需要我们安排酒店",
                timeClarity: "明确",
                peopleClarity: "明确",
                destinationClarity: "明确",
                daysClarity: "明确",
            },
            communicationEffectiveness: "沟通积极",
            profile: "家庭",
            amountRange: "1万至3万元",
            expectedAmount: 15000,
        });
        expect(result.totalScore).toBe(96);
        expect(result.suggestedLevel).toBe("S");
        expect(result.sEligible).toBe(true);
        expect(result.calculableRatio).toBe(100);
    });
    it("少量高分信息不会被放大为S级", () => {
        const result = calculateInitialScore({
            travelNeed: {},
            communicationEffectiveness: "沟通积极",
            profile: "家庭",
        });
        expect(result.totalScore).toBe(37);
        expect(result.suggestedLevel).toBe("C");
        expect(result.filledItemCount).toBe(2);
    });
    it("只填写酒店不会获得整个旅行准备维度30分", () => {
        const result = calculateInitialScore({
            travelNeed: { hotelStatus: "需要我们安排酒店" },
        });
        expect(result.breakdown.travelReadiness).toBe(18);
        expect(result.totalScore).toBe(18);
    });
    it("金额未知但其他8项完整且非金额得分达到80分时可以成为S级", () => {
        const result = calculateInitialScore({
            travelNeed: {
                flightStatus: "日期已定，但暂未购买",
                hotelStatus: "需要我们安排酒店",
                timeClarity: "明确",
                peopleClarity: "明确",
                destinationClarity: "明确",
                daysClarity: "明确",
            },
            communicationEffectiveness: "沟通积极",
            profile: "家庭",
        });
        expect(result.totalScore).toBe(90);
        expect(result.filledItemCount).toBe(8);
        expect(result.suggestedLevel).toBe("S");
    });
    it("明确金额低于1.5万元时最高为A级", () => {
        const result = calculateInitialScore({
            travelNeed: {
                flightStatus: "已购买",
                hotelStatus: "需要我们安排酒店",
                timeClarity: "明确",
                peopleClarity: "明确",
                destinationClarity: "明确",
                daysClarity: "明确",
            },
            communicationEffectiveness: "沟通积极",
            profile: "家庭",
            amountRange: "1万至3万元",
            expectedAmount: 12000,
        });
        expect(result.totalScore).toBe(96);
        expect(result.suggestedLevel).toBe("A");
        expect(result.sEligibilityReasons).toContain("预计具体金额低于1.5万元");
    });
    it("国内交通和WhatsApp状态不参与首次评分", () => {
        const base = {
            flightStatus: "日期已定，但暂未购买" as const,
            hotelStatus: "需要我们安排酒店" as const,
            timeClarity: "大致明确" as const,
            peopleClarity: "明确" as const,
            destinationClarity: "大致明确" as const,
            daysClarity: "明确" as const,
        };
        const left = calculateInitialScore({
            travelNeed: { ...base, domesticTransportStatus: "已自行安排" },
            communicationEffectiveness: "沟通一般",
            profile: "家庭",
            amountRange: "5万至10万元",
        });
        const right = calculateInitialScore({
            travelNeed: { ...base, domesticTransportStatus: "需要我们安排" },
            communicationEffectiveness: "沟通一般",
            profile: "家庭",
            amountRange: "5万至10万元",
        });
        expect(right).toEqual(left);
    });
});
describe("金额区间", () => {
    it.each([
        [9999, "1万元以下"],
        [10000, "1万至3万元"],
        [30000, "3万至5万元"],
        [50000, "5万至10万元"],
        [100000, "10万元以上"],
    ] as const)("金额 %d 自动匹配 %s", (value, range) => {
        expect(amountRangeFromValue(value)).toBe(range);
    });
});
