import { z } from "zod";
import { AMOUNT_RANGES, CLARITY_LEVELS, COMMUNICATION_EFFECTIVENESS, COMMUNICATION_STATUSES, CUSTOMER_LEVELS, DOMESTIC_TRANSPORT_STATUSES, FLIGHT_STATUSES, HOTEL_STATUSES, PRIORITIES, PROFILES, SERVICE_TYPES, SERVICE_ASSIGNMENT_MODES, SERVICE_WORKBENCHES, SOURCES, WHATSAPP_STATUSES, } from "@/lib/constants";
const optionalText = z.string().trim().optional().or(z.literal(""));
export const expectedAmountSchema = z
    .number({ message: "请输入预计金额" })
    .finite("预计金额格式不正确")
    .int("预计金额必须是整数人民币元")
    .positive("预计金额必须大于 0")
    .max(999999999999, "预计金额超出系统支持范围");
export const customerFormSchema = z.object({
    name: z.string().trim().min(1, "请输入客户名称"),
    source: z.enum(SOURCES, { message: "请选择来源渠道" }),
    sourceDetail: optionalText,
    referrerName: optionalText,
    partnerName: optionalText,
    firstInquiryAt: z.string().min(1, "请选择首次询单时间"),
    nationality: optionalText,
    contact: optionalText,
    whatsappStatus: z.enum(WHATSAPP_STATUSES),
    profile: z.enum(PROFILES),
    amountRange: z.enum(AMOUNT_RANGES).optional(),
    expectedAmount: expectedAmountSchema.or(z.literal("").refine(() => false, "请输入预计金额")),
    assigneeUserId: z.string().uuid("负责人账号格式不正确").optional().or(z.literal("")),
    serviceAssignmentMode: z.enum(SERVICE_ASSIGNMENT_MODES, { message: "请选择分配方式" }),
    exclusiveServiceWorkbench: z.enum(SERVICE_WORKBENCHES).optional(),
    communicationEffectiveness: z.enum(COMMUNICATION_EFFECTIVENESS).optional(),
    confirmedLevel: z.enum(CUSTOMER_LEVELS).optional(),
    priority: z.enum(PRIORITIES),
    expectedStartDate: optionalText,
    expectedEndDate: optionalText,
    fuzzyTravelTime: optionalText,
    travelerCount: optionalText,
    travelDays: optionalText,
    destinations: optionalText,
    flightStatus: z.enum(FLIGHT_STATUSES).optional(),
    hotelStatus: z.enum(HOTEL_STATUSES).optional(),
    serviceType: z.enum(SERVICE_TYPES).optional(),
    domesticTransportStatus: z.enum(DOMESTIC_TRANSPORT_STATUSES).optional(),
    specialRequirements: optionalText,
    timeClarity: z.enum(CLARITY_LEVELS).optional(),
    peopleClarity: z.enum(CLARITY_LEVELS).optional(),
    destinationClarity: z.enum(CLARITY_LEVELS).optional(),
    daysClarity: z.enum(CLARITY_LEVELS).optional(),
}).superRefine((value, context) => {
    if (value.serviceAssignmentMode === "exclusive" && !value.exclusiveServiceWorkbench) {
        context.addIssue({
            code: "custom",
            path: ["exclusiveServiceWorkbench"],
            message: "请选择专属规划师工作台",
        });
    }
});
export const followUpSchema = z.object({
    customerId: z.string().uuid(),
    followUpId: z.string().uuid().optional(),
    summary: z.string().trim().min(1, "请填写跟进总结"),
    communicationStatus: z.enum(COMMUNICATION_STATUSES),
    nextCallbackAt: optionalText,
    callbackNotRequired: z.boolean(),
    callbackSkipReason: optionalText,
}).superRefine((value, context) => {
    if (value.callbackNotRequired) {
        if (!value.callbackSkipReason?.trim()) {
            context.addIssue({ code: "custom", path: ["callbackSkipReason"], message: "请填写无需安排回访的原因" });
        }
        return;
    }
    if (!value.nextCallbackAt?.trim()) {
        context.addIssue({ code: "custom", path: ["nextCallbackAt"], message: "请选择下次回访时间" });
    }
});
export const wonAmountSchema = z.number().finite().nonnegative("成交总金额必须大于或等于 0");
export type CustomerFormValues = z.infer<typeof customerFormSchema>;
