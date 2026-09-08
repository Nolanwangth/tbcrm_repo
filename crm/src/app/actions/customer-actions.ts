"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { amountRangeFromValue } from "@/lib/constants";
import { normalizeBusinessDateTime } from "@/lib/business-time";
import { validatePlanningRequest } from "@/lib/planning";
import { calculateInitialScore } from "@/lib/scoring";
import { requiresUrgentConfirmation } from "@/lib/priority-confirmation";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { resolveAssignableUser } from "@/lib/repositories/users";
import type { BusinessStage, CommunicationStatus, ItineraryStatus, Level, PlanningRequestType, Priority, QuotationStatus, WhatsappStatus, } from "@/lib/types";
import { customerFormSchema, expectedAmountSchema, followUpSchema, wonAmountSchema, type CustomerFormValues } from "@/lib/validators";
export type ActionResult = {
    ok: true;
    id?: string;
    revision?: number;
    warning?: string;
} | {
    ok: false;
    error: string;
};
async function configured(): Promise<ActionResult | null> {
    if (!await getCurrentUser())
        return { ok: false, error: "登录状态已失效" };
    if (isSupabaseConfigured())
        return null;
    return { ok: false, error: "Supabase 尚未配置，无法写入业务数据。" };
}
export async function createCustomerAction(values: CustomerFormValues): Promise<ActionResult> {
    const missing = await configured();
    if (missing)
        return missing;
    const parsed = customerFormSchema.safeParse(values);
    if (!parsed.success)
        return { ok: false, error: parsed.error.issues[0]?.message ?? "表单数据有误" };
    const data = parsed.data;
    const expectedAmount = data.expectedAmount === "" ? null : data.expectedAmount;
    const amountRange = expectedAmount ? amountRangeFromValue(expectedAmount) : (data.amountRange ?? null);
    const firstInquiryAt = normalizeBusinessDateTime(data.firstInquiryAt);
    if (!firstInquiryAt)
        return { ok: false, error: "首次询单时间格式不正确" };
    const travelNeed = {
        expectedStartDate: data.expectedStartDate || null,
        expectedEndDate: data.expectedEndDate || null,
        fuzzyTravelTime: data.fuzzyTravelTime || null,
        travelerCount: data.travelerCount || null,
        travelDays: data.travelDays || null,
        destinations: data.destinations || null,
        flightStatus: data.flightStatus ?? null,
        hotelStatus: data.hotelStatus ?? null,
        serviceType: data.serviceType ?? null,
        domesticTransportStatus: data.domesticTransportStatus ?? null,
        specialRequirements: data.specialRequirements || null,
        timeClarity: data.timeClarity ?? null,
        peopleClarity: data.peopleClarity ?? null,
        destinationClarity: data.destinationClarity ?? null,
        daysClarity: data.daysClarity ?? null,
    };
    const score = calculateInitialScore({
        travelNeed,
        communicationEffectiveness: data.communicationEffectiveness,
        profile: data.profile,
        amountRange,
        expectedAmount,
        confirmedLevel: data.confirmedLevel,
    });
    const level = data.confirmedLevel ?? score.suggestedLevel;
    const assignee = await resolveAssignableUser(data.assigneeUserId || null);
    if (data.assigneeUserId && !assignee)
        return { ok: false, error: "负责人账号不存在、已停用或不能负责客户" };
    if (assignee && assignee.role !== "planner")
        return { ok: false, error: "新增客户只能关联规划师账号" };
    const currentUser = await getCurrentUser();
    if (!currentUser)
        return { ok: false, error: "登录状态已失效，请重新登录" };
    const { data: customer, error } = await getSupabaseAdmin().rpc("crm_create_customer_bundle", {
        p_actor: currentUser.id,
        p_customer: {
            name: data.name,
            source: data.source,
            source_detail: data.sourceDetail || null,
            referrer_name: data.referrerName || null,
            partner_name: data.partnerName || null,
            first_inquiry_at: firstInquiryAt,
            nationality: data.nationality || null,
            contact: data.contact || null,
            whatsapp_status: data.whatsappStatus,
            communication_effectiveness: data.communicationEffectiveness ?? null,
            profile: data.profile,
            amount_range: amountRange,
            expected_amount: expectedAmount,
            assignee_user_id: assignee?.id ?? null,
            assignee: assignee?.displayName ?? null,
            service_assignment_mode: data.serviceAssignmentMode,
            service_workbench: data.serviceAssignmentMode === "exclusive" ? data.exclusiveServiceWorkbench : null,
            level,
            system_suggested_level: score.suggestedLevel,
            priority: data.priority,
            communication_status: "待首次跟进",
            status: "跟进中",
        },
        p_travel: {
            expected_start_date: travelNeed.expectedStartDate,
            expected_end_date: travelNeed.expectedEndDate,
            fuzzy_travel_time: travelNeed.fuzzyTravelTime,
            traveler_count: travelNeed.travelerCount,
            travel_days: travelNeed.travelDays,
            destinations: travelNeed.destinations,
            flight_status: travelNeed.flightStatus,
            hotel_status: travelNeed.hotelStatus,
            service_type: travelNeed.serviceType,
            domestic_transport_status: travelNeed.domesticTransportStatus,
            special_requirements: travelNeed.specialRequirements,
            time_clarity: travelNeed.timeClarity,
            people_clarity: travelNeed.peopleClarity,
            destination_clarity: travelNeed.destinationClarity,
            days_clarity: travelNeed.daysClarity,
        },
        p_score: {
            total_score: score.totalScore,
            suggested_level: score.suggestedLevel,
            confirmed_level: level,
            filled_item_count: score.filledItemCount,
            total_item_count: score.totalItemCount,
            calculable_ratio: score.calculableRatio,
            breakdown: score.breakdown,
            scoring_version: score.scoringVersion,
            s_eligible: score.sEligible,
            s_eligibility_reasons: score.sEligibilityReasons,
        },
    });
    if (error || !customer)
        return { ok: false, error: `创建客户失败，所有关联写入已撤销：${error?.message ?? "未知错误"}` };
    const customerId = String(customer.id);
    revalidatePath("/", "layout");
    return {
        ok: true,
        id: customerId,
        warning: customer.service_workbench ? undefined : "客户已保存，但规划师 A-E 当前均不可分配，请在客户详情中人工处理。",
    };
}
export async function createCustomerAndRedirect(values: CustomerFormValues) {
    const result = await createCustomerAction(values);
    if (!result.ok || !result.id)
        return result;
    redirect(`/customers/${result.id}`);
}
async function customerWorkflow(customerIds: string[], operation: string, input: Record<string, unknown>): Promise<ActionResult> {
    const missing = await configured();
    if (missing)
        return missing;
    const actor = await getCurrentUser();
    if (!actor)
        return { ok: false, error: "登录状态已失效" };
    if (!customerIds.length)
        return { ok: false, error: "请先选择客户" };
    const { error } = await getSupabaseAdmin().rpc("crm_customer_workflow", { p_actor: actor.id, p_customers: customerIds, p_operation: operation, p_input: input });
    if (error)
        return { ok: false, error: error.message };
    revalidatePath("/", "layout");
    return { ok: true };
}
function isValidCalendarDate(value: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match)
        return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return (parsed.getUTCFullYear() === year &&
        parsed.getUTCMonth() === month - 1 &&
        parsed.getUTCDate() === day);
}
export async function updateCustomerControlAction(input: {
    customerId: string;
    field: "level" | "priority" | "communication_status" | "whatsapp_status";
    value: Level | Priority | CommunicationStatus | WhatsappStatus;
    confirmUrgent?: boolean;
}): Promise<ActionResult> {
    const missing = await configured();
    if (missing)
        return missing;
    const supabase = getSupabaseAdmin();
    const { data: current, error: readError } = await supabase
        .from("customers")
        .select("level,priority,communication_status,whatsapp_status")
        .eq("id", input.customerId)
        .single();
    if (readError || !current)
        return { ok: false, error: "找不到客户" };
    if (input.field === "priority" &&
        requiresUrgentConfirmation(current.priority as Priority, input.value as Priority) &&
        !input.confirmUrgent) {
        return { ok: false, error: "将客户优先级改为“紧急”前必须二次确认" };
    }
    const { error } = await supabase.rpc("crm_update_customer_control", { p_actor: (await getCurrentUser())!.id, p_customer: input.customerId, p_field: input.field, p_value: input.value, p_expected_old: current[input.field] });
    if (error)
        return { ok: false, error: error.message };
    revalidatePath("/", "layout");
    return { ok: true };
}
export async function updateBusinessStageAction(input: {
    customerId: string;
    value: BusinessStage;
}): Promise<ActionResult> {
    const missing = await configured();
    if (missing)
        return missing;
    if (!["沟通中", "制作中"].includes(input.value))
        return { ok: false, error: "业务阶段无效" };
    const supabase = getSupabaseAdmin();
    const { data: current } = await supabase
        .from("customers")
        .select("business_stage")
        .eq("id", input.customerId)
        .single();
    if (!current)
        return { ok: false, error: "找不到客户" };
    const { error } = await supabase.rpc("crm_update_customer_control", { p_actor: (await getCurrentUser())!.id, p_customer: input.customerId, p_field: "business_stage", p_value: input.value, p_expected_old: current.business_stage });
    if (error)
        return { ok: false, error: error.message };
    revalidatePath("/", "layout");
    return { ok: true };
}
export async function updatePlanningProgressAction(input: {
    customerIds: string[];
    requestType: PlanningRequestType;
    status: ItineraryStatus | QuotationStatus;
    content?: string | null;
}): Promise<ActionResult> {
    const missing = await configured();
    if (missing)
        return missing;
    const validationError = validatePlanningRequest(input.requestType, input.status, input.content);
    if (validationError)
        return { ok: false, error: validationError };
    return customerWorkflow(input.customerIds, "planning", input);
}
export async function updateWonInfoAction(input: {
    customerId: string;
    wonAmount: number;
    wonDate: string;
}): Promise<ActionResult> {
    if (!wonAmountSchema.safeParse(input.wonAmount).success)
        return { ok: false, error: "成交总金额必须是大于或等于 0 的数字" };
    if (!isValidCalendarDate(input.wonDate))
        return { ok: false, error: "请选择有效的成交日期" };
    return customerWorkflow([input.customerId], "won-info", input);
}
export async function updateCustomerProfileAction(input: {
    customerId: string;
    expectedUpdatedAt?: string;
    basic?: {
        name: string;
        source: string;
        sourceDetail?: string | null;
        firstInquiryAt: string;
        nationality?: string | null;
        contact?: string | null;
        whatsappStatus: WhatsappStatus;
        profile: string;
        amountRange?: string | null;
        expectedAmount?: number | null;
        assigneeUserId?: string | null;
    };
    travel?: {
        expectedStartDate?: string | null;
        expectedEndDate?: string | null;
        fuzzyTravelTime?: string | null;
        travelerCount?: string | null;
        travelDays?: string | null;
        destinations?: string | null;
        flightStatus?: string | null;
        hotelStatus?: string | null;
        serviceType?: string | null;
        domesticTransportStatus?: string | null;
        specialRequirements?: string | null;
    };
}): Promise<ActionResult> {
    const missing = await configured();
    if (missing)
        return missing;
    const supabase = getSupabaseAdmin();
    let basicPatch: Record<string, unknown> | null = null;
    let travelPatch: Record<string, unknown> | null = null;
    if (input.basic) {
        const { data: old, error: readError } = await supabase.from("customers").select("*").eq("id", input.customerId).single();
        if (readError || !old)
            return { ok: false, error: "找不到客户" };
        const firstInquiryAt = normalizeBusinessDateTime(input.basic.firstInquiryAt);
        if (!firstInquiryAt)
            return { ok: false, error: "首次询单时间格式不正确" };
        const oldExpectedAmount = old.expected_amount == null ? null : Number(old.expected_amount);
        let expectedAmount = input.basic.expectedAmount ?? null;
        if (expectedAmount == null && (oldExpectedAmount ?? 0) > 0) {
            return { ok: false, error: "已填写的预计金额不能清空" };
        }
        if (expectedAmount != null) {
            const parsedAmount = expectedAmountSchema.safeParse(expectedAmount);
            if (!parsedAmount.success)
                return { ok: false, error: parsedAmount.error.issues[0]?.message ?? "预计金额格式不正确" };
            expectedAmount = parsedAmount.data;
        }
        const amountRange = expectedAmount == null
            ? (old.amount_range as string | null)
            : amountRangeFromValue(expectedAmount);
        const updates = {
            name: input.basic.name.trim(),
            source: input.basic.source,
            source_detail: input.basic.sourceDetail || null,
            first_inquiry_at: firstInquiryAt,
            nationality: input.basic.nationality || null,
            contact: input.basic.contact || null,
            whatsapp_status: input.basic.whatsappStatus,
            profile: input.basic.profile,
            amount_range: amountRange,
            expected_amount: expectedAmount,
        };
        basicPatch = updates;
    }
    if (input.travel) {
        const updates = {
            expected_start_date: input.travel.expectedStartDate || null,
            expected_end_date: input.travel.expectedEndDate || null,
            fuzzy_travel_time: input.travel.fuzzyTravelTime || null,
            traveler_count: input.travel.travelerCount || null,
            travel_days: input.travel.travelDays || null,
            destinations: input.travel.destinations || null,
            flight_status: input.travel.flightStatus || null,
            hotel_status: input.travel.hotelStatus || null,
            service_type: input.travel.serviceType || null,
            domestic_transport_status: input.travel.domesticTransportStatus || null,
            special_requirements: input.travel.specialRequirements || null,
        };
        travelPatch = updates;
    }
    const actor = await getCurrentUser();
    if (!actor)
        return { ok: false, error: "登录状态已失效" };
    const { error } = await supabase.rpc("crm_update_customer_profile", { p_actor: actor.id, p_customer: input.customerId, p_expected_updated_at: input.expectedUpdatedAt ?? null, p_basic: basicPatch, p_travel: travelPatch });
    if (error)
        return { ok: false, error: error.message };
    revalidatePath("/", "layout");
    return { ok: true };
}
export async function updateCustomerExpectedAmountAction(input: {
    customerId: string;
    expectedAmount: number;
}): Promise<ActionResult> {
    const parsed = expectedAmountSchema.safeParse(input.expectedAmount);
    if (!parsed.success)
        return { ok: false, error: parsed.error.issues[0]?.message ?? "预计金额格式不正确" };
    return customerWorkflow([input.customerId], "expected-amount", { expectedAmount: parsed.data });
}
export async function saveFollowUpAction(input: {
    customerId: string;
    followUpId?: string;
    summary: string;
    communicationStatus: CommunicationStatus;
    nextCallbackAt?: string;
    callbackNotRequired: boolean;
    callbackSkipReason?: string;
}): Promise<ActionResult> {
    const parsed = followUpSchema.safeParse(input);
    if (!parsed.success)
        return { ok: false, error: parsed.error.issues[0]?.message ?? "跟进数据有误" };
    const nextCallbackAt = parsed.data.callbackNotRequired ? null : normalizeBusinessDateTime(parsed.data.nextCallbackAt ?? "");
    if (!parsed.data.callbackNotRequired && !nextCallbackAt)
        return { ok: false, error: "下次回访时间格式不正确" };
    return customerWorkflow([input.customerId], "follow-up", { ...parsed.data, followUpId: input.followUpId, nextCallbackAt });
}
export async function changeCustomerStatusAction(input: {
    customerIds: string[];
    action: "won" | "close" | "recover" | "delete";
    closeReason?: string;
    level?: Level;
    priority?: Priority;
    communicationStatus?: CommunicationStatus;
    deleteReason?: string;
    wonAmount?: number;
    wonDate?: string;
}): Promise<ActionResult> {
    if (input.action === "won") {
        if (!wonAmountSchema.safeParse(input.wonAmount).success)
            return { ok: false, error: "请填写大于或等于 0 的成交总金额" };
        if (!input.wonDate || !isValidCalendarDate(input.wonDate))
            return { ok: false, error: "请选择有效的成交日期" };
    }
    if (input.action === "delete" && !["录入错误", "测试数据", "重复客户"].includes(input.deleteReason ?? ""))
        return { ok: false, error: "彻底删除必须选择允许的删除原因" };
    return customerWorkflow(input.customerIds, input.action, input);
}
