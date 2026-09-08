import { describe, expect, it } from "vitest";
import { customerFormSchema, followUpSchema, wonAmountSchema } from "@/lib/validators";
describe("客户录入校验", () => {
    it("只要求客户名称、来源渠道和首次询单时间", () => {
        const result = customerFormSchema.safeParse({
            name: "测试客户",
            source: "官网",
            firstInquiryAt: "2026-07-23T12:00",
            expectedAmount: 10000,
            whatsappStatus: "未添加",
            profile: "未确定",
            priority: "中",
            serviceAssignmentMode: "round_robin",
        });
        expect(result.success).toBe(true);
    });
    it("缺少客户名称时拒绝保存", () => {
        const result = customerFormSchema.safeParse({
            name: "",
            source: "官网",
            firstInquiryAt: "2026-07-23T12:00",
            whatsappStatus: "未添加",
            profile: "未确定",
            priority: "中",
            serviceAssignmentMode: "round_robin",
        });
        expect(result.success).toBe(false);
    });
    it("可以记录并清理客户联系方式两侧空格", () => {
        const result = customerFormSchema.safeParse({
            name: "测试客户",
            source: "官网",
            firstInquiryAt: "2026-07-23T12:00",
            expectedAmount: 10000,
            contact: "  微信：tripbook-demo  ",
            whatsappStatus: "已添加微信",
            profile: "未确定",
            priority: "中",
            serviceAssignmentMode: "round_robin",
        });
        expect(result.success).toBe(true);
        if (result.success)
            expect(result.data.contact).toBe("微信：tripbook-demo");
    });
    it("负责人必须使用账号UUID，不能再提交任意姓名", () => {
        const base = {
            name: "测试客户",
            source: "官网",
            firstInquiryAt: "2026-07-23T12:00",
            expectedAmount: 10000,
            whatsappStatus: "未添加",
            profile: "未确定",
            priority: "中",
            serviceAssignmentMode: "round_robin",
        };
        expect(customerFormSchema.safeParse({ ...base, assigneeUserId: "aa100000-0000-4000-8000-000000000001" }).success).toBe(true);
        expect(customerFormSchema.safeParse({ ...base, assigneeUserId: "张栩杰" }).success).toBe(false);
    });
});
describe("成交金额校验", () => {
    it("无成交金额或负数不能确认成交", () => {
        expect(wonAmountSchema.safeParse(undefined).success).toBe(false);
        expect(wonAmountSchema.safeParse(-1).success).toBe(false);
        expect(wonAmountSchema.safeParse(0).success).toBe(true);
    });
});
describe("跟进记录校验", () => {
    it("跟进总结必须同时选择沟通状态", () => {
        const result = followUpSchema.safeParse({
            customerId: "00000000-0000-4000-8000-000000000001",
            summary: "客户确认出行时间",
            callbackNotRequired: false,
            nextCallbackAt: "2026-07-24T12:00",
        });
        expect(result.success).toBe(false);
    });
    it("跟进中必须设置下次回访或填写无需回访原因", () => {
        const base = {
            customerId: "00000000-0000-4000-8000-000000000001",
            summary: "客户确认出行时间",
            communicationStatus: "客户已回复，待我方处理" as const,
        };
        expect(followUpSchema.safeParse({ ...base, callbackNotRequired: false }).success).toBe(false);
        expect(followUpSchema.safeParse({ ...base, callbackNotRequired: true, callbackSkipReason: "客户要求暂缓" }).success).toBe(true);
    });
});
