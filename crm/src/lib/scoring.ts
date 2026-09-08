import type { AmountRange, CommunicationEffectiveness, CustomerProfile, InitialScore, Level, TravelNeed, } from "@/lib/types";
export const SCORING_CONFIG = {
    version: "V2",
    weights: {
        travelReadiness: 30,
        communication: 25,
        demandClarity: 25,
        profile: 12,
        amount: 8,
    },
    itemWeights: {
        flight: 12,
        hotel: 18,
        communication: 25,
        clarity: 6.25,
        profile: 12,
        amount: 8,
    },
    levelThresholds: [
        { level: "S" as Level, min: 80 },
        { level: "A" as Level, min: 65 },
        { level: "B" as Level, min: 45 },
        { level: "C" as Level, min: 0 },
    ],
    flight: {
        已购买: 12,
        "日期已定，但暂未购买": 10,
        日期尚未确定: 5,
    },
    hotel: {
        已自行安排: 11,
        需要我们安排酒店: 18,
        "已基本选定，暂未预订": 14,
        尚未确定: 6,
    },
    communication: {
        沟通积极: 25,
        沟通一般: 16,
        沟通较弱: 8,
    },
    clarity: {
        明确: 6.25,
        大致明确: 4,
        未确定: 1.5,
    },
    profile: {
        家庭: 12,
        情侣: 10,
        朋友: 10,
        个人: 7,
        未确定: 3,
    },
    amount: {
        "1万元以下": 2,
        "1万至3万元": 4,
        "3万至5万元": 5.5,
        "5万至10万元": 7,
        "10万元以上": 8,
    },
} as const;
type ScoreInput = {
    travelNeed: TravelNeed;
    communicationEffectiveness?: CommunicationEffectiveness | null;
    profile?: CustomerProfile | null;
    amountRange?: AmountRange | null;
    expectedAmount?: number | null;
    confirmedLevel?: Level;
};
function baseLevelFromScore(score: number): Level {
    return SCORING_CONFIG.levelThresholds.find((item) => score >= item.min)?.level ?? "C";
}
function applyCompletenessCap(level: Level, filledItemCount: number): Level {
    const ranks: Record<Level, number> = { S: 4, A: 3, B: 2, C: 1 };
    const cap: Level = filledItemCount < 4 ? "C" : filledItemCount < 6 ? "B" : filledItemCount < 8 ? "A" : "S";
    return ranks[level] <= ranks[cap] ? level : cap;
}
function amountCondition(input: ScoreInput, nonAmountScore: number, nonAmountFilledCount: number) {
    if (input.expectedAmount != null) {
        return input.expectedAmount >= 15000
            ? { eligible: true, reason: null }
            : { eligible: false, reason: "预计具体金额低于1.5万元" };
    }
    if (["3万至5万元", "5万至10万元", "10万元以上"].includes(input.amountRange ?? "")) {
        return { eligible: true, reason: null };
    }
    if (input.amountRange === "1万元以下") {
        return { eligible: false, reason: "预计金额低于1.5万元" };
    }
    const unknownAmountEligible = nonAmountFilledCount === 8 && nonAmountScore >= 80;
    return unknownAmountEligible
        ? { eligible: true, reason: null }
        : { eligible: false, reason: "金额暂不明确，且其他8项信息或非金额得分不足" };
}
export function calculateInitialScore(input: ScoreInput): InitialScore {
    const { travelNeed } = input;
    const flightKnown = Boolean(travelNeed.flightStatus && travelNeed.flightStatus !== "未知");
    const hotelKnown = Boolean(travelNeed.hotelStatus && travelNeed.hotelStatus !== "未知");
    const flightPoints = flightKnown ? SCORING_CONFIG.flight[travelNeed.flightStatus as keyof typeof SCORING_CONFIG.flight] : 0;
    const hotelPoints = hotelKnown ? SCORING_CONFIG.hotel[travelNeed.hotelStatus as keyof typeof SCORING_CONFIG.hotel] : 0;
    const communicationPoints = input.communicationEffectiveness
        ? SCORING_CONFIG.communication[input.communicationEffectiveness]
        : 0;
    const clarityValues = [
        travelNeed.timeClarity,
        travelNeed.peopleClarity,
        travelNeed.destinationClarity,
        travelNeed.daysClarity,
    ].filter((value): value is NonNullable<typeof value> => Boolean(value));
    const clarityPoints = clarityValues.reduce((sum, value) => sum + SCORING_CONFIG.clarity[value], 0);
    const profilePoints = input.profile ? SCORING_CONFIG.profile[input.profile] : 0;
    const amountPoints = input.amountRange ? SCORING_CONFIG.amount[input.amountRange] : 0;
    const travelReadiness = flightPoints + hotelPoints;
    const nonAmountScore = travelReadiness + communicationPoints + clarityPoints + profilePoints;
    const totalScore = Math.round(nonAmountScore + amountPoints);
    const nonAmountFilledCount = Number(flightKnown) +
        Number(hotelKnown) +
        Number(Boolean(input.communicationEffectiveness)) +
        clarityValues.length +
        Number(Boolean(input.profile));
    const filledItemCount = nonAmountFilledCount + Number(Boolean(input.amountRange));
    const strongClarityCount = clarityValues.filter((value) => value === "明确" || value === "大致明确").length;
    const travelStrong = ["已购买", "日期已定，但暂未购买"].includes(travelNeed.flightStatus ?? "") ||
        ["已自行安排", "需要我们安排酒店", "已基本选定，暂未预订"].includes(travelNeed.hotelStatus ?? "");
    const amountGate = amountCondition(input, nonAmountScore, nonAmountFilledCount);
    const sEligibilityReasons = [
        ...(filledItemCount >= 8 ? [] : ["有效评分信息不足8项"]),
        ...(input.communicationEffectiveness === "沟通积极" ? [] : ["沟通有效性不是“沟通积极”"]),
        ...(strongClarityCount >= 3 ? [] : ["时间、人数、目的地和天数中少于3项达到大致明确"]),
        ...(travelStrong ? [] : ["机票或酒店尚无较明确状态"]),
        ...(amountGate.eligible || !amountGate.reason ? [] : [amountGate.reason]),
    ];
    const sEligible = sEligibilityReasons.length === 0;
    const thresholdLevel = totalScore >= 80 && !sEligible ? "A" : baseLevelFromScore(totalScore);
    const suggestedLevel = applyCompletenessCap(thresholdLevel, filledItemCount);
    return {
        totalScore,
        suggestedLevel,
        confirmedLevel: input.confirmedLevel ?? suggestedLevel,
        filledItemCount,
        totalItemCount: 9,
        calculableRatio: Math.round((filledItemCount / 9) * 100),
        breakdown: {
            travelReadiness: flightKnown || hotelKnown ? travelReadiness : null,
            communication: input.communicationEffectiveness ? communicationPoints : null,
            demandClarity: clarityValues.length ? Math.round(clarityPoints * 100) / 100 : null,
            profile: input.profile ? profilePoints : null,
            amount: input.amountRange ? amountPoints : null,
        },
        scoringVersion: SCORING_CONFIG.version,
        sEligible,
        sEligibilityReasons,
    };
}
