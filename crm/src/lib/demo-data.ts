import { subDays, subHours } from "date-fns";
import { calculateInitialScore } from "@/lib/scoring";
import type { Customer, CustomerProfile, Level, Priority, Source, TravelNeed } from "@/lib/types";
const now = new Date("2026-07-23T16:00:00+08:00");
const iso = (date: Date) => date.toISOString();
function makeCustomer(input: {
    index: number;
    name: string;
    level: Level;
    priority: Priority;
    source: Source;
    profile: CustomerProfile;
    status?: Customer["status"];
    communicationStatus: Customer["communicationStatus"];
    amountRange: Customer["amountRange"];
    amount?: number;
    daysAgo: number;
    followUps?: string[];
    closeReason?: string;
}) {
    const id = `00000000-0000-4000-8000-${String(input.index).padStart(12, "0")}`;
    const travelNeed: TravelNeed = {
        fuzzyTravelTime: input.index % 2 ? "2026年10月中旬" : "明年春天",
        travelerCount: input.profile === "家庭" ? "2位成人加1名儿童" : "2人",
        travelDays: input.index % 3 ? "10至12天" : "大约两周",
        destinations: input.index % 2 ? "北京、西安、成都" : "上海、杭州、苏州",
        flightStatus: input.level === "S" ? "已购买" : input.level === "A" ? "日期已定，但暂未购买" : "日期尚未确定",
        hotelStatus: input.level === "S" || input.level === "A" ? "需要我们安排酒店" : "尚未确定",
        serviceType: input.index % 3 === 0 ? "拼接" : "全托管",
        domesticTransportStatus: input.level === "S" || input.level === "A"
            ? "需要我们安排"
            : input.level === "B"
                ? "部分已安排，部分需要我们安排"
                : "尚未确定",
        specialRequirements: input.profile === "家庭" ? "希望安排亲子友好的住宿与节奏，儿童不吃辣。" : "希望减少购物点，偏好在地体验。",
        timeClarity: input.level === "S" ? "明确" : "大致明确",
        peopleClarity: "明确",
        destinationClarity: input.level === "C" ? "未确定" : "大致明确",
        daysClarity: input.level === "S" || input.level === "A" ? "明确" : "大致明确",
    };
    const score = calculateInitialScore({
        travelNeed,
        communicationEffectiveness: input.level === "S" ? "沟通积极" : input.level === "C" ? "沟通较弱" : "沟通一般",
        profile: input.profile,
        amountRange: input.amountRange,
        expectedAmount: input.amount,
        confirmedLevel: input.level,
    });
    const firstInquiry = subDays(now, input.daysAgo + 3);
    const summaries = input.followUps ?? [];
    const followUps = summaries.map((summary, index) => ({
        id: `${id.slice(0, -2)}${String(index + 20).padStart(2, "0")}`,
        summary,
        communicationStatus: input.communicationStatus,
        createdAt: iso(subHours(now, (summaries.length - index) * 26 + input.index)),
        updatedAt: iso(subHours(now, (summaries.length - index) * 26 + input.index)),
        previousInterval: index === 0 ? null : "1天2小时",
        nextCallbackAt: null,
        callbackNotRequired: false,
        callbackSkipReason: null,
    }));
    const latest = followUps.at(-1);
    const status = input.status ?? "跟进中";
    return {
        id,
        name: input.name,
        source: input.source,
        firstInquiryAt: iso(firstInquiry),
        nationality: input.index % 2 ? "美国" : "澳大利亚",
        whatsappStatus: input.index % 2 ? "已添加whatsapp" : "未添加",
        profile: input.profile,
        amountRange: input.amountRange,
        expectedAmount: input.amount,
        serviceWorkbench: null,
        serviceAssignmentMode: null,
        serviceOwnerUserId: null,
        serviceAssignedAt: null,
        currentCallbackAt: null,
        callbackNotRequired: false,
        callbackSkipReason: null,
        serviceAssignmentEvents: [],
        serviceHandoffs: [],
        level: input.level,
        systemSuggestedLevel: score.suggestedLevel,
        priority: input.priority,
        communicationStatus: input.communicationStatus,
        status,
        businessStage: "沟通中",
        itineraryStatus: "暂不需要",
        quotationStatus: "暂不需要",
        itineraryStatusUpdatedAt: iso(firstInquiry),
        quotationStatusUpdatedAt: iso(firstInquiry),
        planningRequests: [],
        score,
        travelNeed,
        followUps,
        collaborationMessages: [],
        auditLogs: [
            {
                id: `${id.slice(0, -2)}91`,
                fieldName: "优先级",
                oldValue: "中",
                newValue: input.priority,
                changedAt: iso(subDays(now, Math.max(1, input.daysAgo - 1))),
            },
        ],
        levelChanges: [
            {
                id: `${id.slice(0, -2)}81`,
                fromLevel: null,
                toLevel: input.level,
                changedAt: iso(firstInquiry),
            },
        ],
        folders: [{
                id: `${id.slice(0, -2)}71`,
                name: "客户资料",
                parentId: null,
                status: "待发送",
                reviewStatus: "待审核",
                statusHistory: [],
                createdAt: iso(firstInquiry),
            }],
        files: [],
        latestFollowUpAt: latest?.updatedAt ?? null,
        latestFollowUpSummary: latest?.summary ?? null,
        wonAt: status === "已成交" ? iso(subDays(now, 2)) : null,
        wonAmount: status === "已成交" ? (input.amount ?? 0) : null,
        closedAt: status === "已关闭" ? iso(subDays(now, 1)) : null,
        closeReason: input.closeReason ?? null,
        updatedAt: latest?.updatedAt ?? iso(firstInquiry),
        createdAt: iso(firstInquiry),
    } satisfies Customer;
}
export const demoCustomers: Customer[] = [
    makeCustomer({
        index: 1,
        name: "Olivia Johnson",
        level: "S",
        priority: "紧急",
        source: "Instagram 广告",
        profile: "家庭",
        communicationStatus: "客户已回复，待我方处理",
        amountRange: "10万元以上",
        amount: 128000,
        daysAgo: 1,
        followUps: ["客户确认暑期档期，希望优先确认亲子酒店和高铁票。", "已发送初步服务范围，客户询问婴儿车与儿童餐安排。"],
    }),
    makeCustomer({
        index: 2,
        name: "Liam Brown",
        level: "S",
        priority: "高",
        source: "转介绍",
        profile: "情侣",
        communicationStatus: "待首次跟进",
        amountRange: "5万至10万元",
        amount: 76000,
        daysAgo: 0,
    }),
    makeCustomer({
        index: 3,
        name: "Emma Wilson",
        level: "A",
        priority: "高",
        source: "官网",
        profile: "朋友",
        communicationStatus: "我方已回复，等待客户",
        amountRange: "5万至10万元",
        amount: 68000,
        daysAgo: 2,
        followUps: ["已根据朋友团人数补充商务车建议，等待确认出行时间。"],
    }),
    makeCustomer({
        index: 4,
        name: "Noah Martin",
        level: "A",
        priority: "中",
        source: "Facebook 自然",
        profile: "家庭",
        communicationStatus: "客户已读未回",
        amountRange: "3万至5万元",
        amount: 49000,
        daysAgo: 4,
        followUps: ["客户希望加入熊猫基地，已询问儿童年龄和房型偏好。"],
    }),
    makeCustomer({
        index: 5,
        name: "Sophia Davis",
        level: "B",
        priority: "中",
        source: "TikTok",
        profile: "个人",
        communicationStatus: "客户未读",
        amountRange: "1万至3万元",
        amount: 28000,
        daysAgo: 5,
        followUps: ["已发送单人小团和单独接送两种服务说明。"],
    }),
    makeCustomer({
        index: 6,
        name: "Mason Taylor",
        level: "B",
        priority: "低",
        source: "YouTube",
        profile: "未确定",
        communicationStatus: "客户暂缓决定",
        amountRange: "3万至5万元",
        daysAgo: 8,
        followUps: ["客户需要先确认年假，暂缓决定，约定确认后再联系。"],
    }),
    makeCustomer({
        index: 7,
        name: "Ava Anderson",
        level: "C",
        priority: "低",
        source: "邮箱",
        profile: "个人",
        communicationStatus: "待首次跟进",
        amountRange: "1万元以下",
        daysAgo: 1,
    }),
    makeCustomer({
        index: 8,
        name: "Ethan Thomas",
        level: "C",
        priority: "中",
        source: "其他",
        profile: "未确定",
        communicationStatus: "客户已读未回",
        amountRange: "1万至3万元",
        daysAgo: 12,
        followUps: ["第二次补充询问出行月份，客户已读但暂无回复。"],
    }),
    makeCustomer({
        index: 9,
        name: "Isabella Moore",
        level: "A",
        priority: "高",
        source: "B2B",
        profile: "家庭",
        communicationStatus: "我方已回复，等待客户",
        amountRange: "10万元以上",
        amount: 160000,
        daysAgo: 15,
        status: "已成交",
        followUps: ["合作方确认服务范围，本单已成交并等待后续交接。"],
    }),
    makeCustomer({
        index: 10,
        name: "Lucas Jackson",
        level: "B",
        priority: "低",
        source: "Instagram 自然",
        profile: "情侣",
        communicationStatus: "客户暂缓决定",
        amountRange: "3万至5万元",
        daysAgo: 20,
        status: "已关闭",
        closeReason: "客户取消出行计划",
        followUps: ["客户确认本年度取消中国旅行计划。"],
    }),
];
