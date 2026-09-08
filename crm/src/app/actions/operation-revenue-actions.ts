"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import type { ActionResult } from "@/app/actions/customer-actions";
const revenueKinds = ["group_fee", "deposit", "balance", "addon", "other"] as const;
const paymentMethods = ["bank_transfer", "alipay", "wechat", "cash", "paypal", "other"] as const;
const refresh = () => { revalidatePath("/finance"); revalidatePath("/operations"); };
export async function createOperationRevenueItemAction(input: {
    caseId: string;
    kind: typeof revenueKinds[number];
    title: string;
    plannedAmount: number;
    note?: string;
}): Promise<ActionResult> {
    if (!isSupabaseConfigured())
        return { ok: false, error: "Supabase 尚未配置" };
    const actor = await getCurrentUser();
    if (!actor)
        return { ok: false, error: "登录已过期，请重新登录" };
    if (!input.caseId || !revenueKinds.includes(input.kind) || !input.title.trim() || !Number.isFinite(input.plannedAmount) || input.plannedAmount <= 0)
        return { ok: false, error: "团款计划信息无效" };
    const { data, error } = await getSupabaseAdmin().from("operation_revenue_items").insert({ case_id: input.caseId, kind: input.kind, title: input.title.trim(), planned_amount: input.plannedAmount, note: input.note?.trim() || null, created_by_name: actor.displayName }).select("id").single();
    if (error || !data)
        return { ok: false, error: error?.message ?? "新增团款计划失败" };
    refresh();
    return { ok: true, id: String(data.id) };
}
export async function recordOperationRevenueReceiptAction(input: {
    revenueItemId: string;
    amount: number;
    receivedAt: string;
    method: typeof paymentMethods[number];
    note?: string;
}): Promise<ActionResult> {
    if (!isSupabaseConfigured())
        return { ok: false, error: "Supabase 尚未配置" };
    const actor = await getCurrentUser();
    if (!actor)
        return { ok: false, error: "登录已过期，请重新登录" };
    if (!input.revenueItemId || !paymentMethods.includes(input.method) || !Number.isFinite(input.amount) || input.amount <= 0 || !input.receivedAt)
        return { ok: false, error: "收款信息无效" };
    const supabase = getSupabaseAdmin();
    const { data: item, error: itemError } = await supabase.from("operation_revenue_items").select("planned_amount,voided_at,operation_revenue_receipts(amount)").eq("id", input.revenueItemId).maybeSingle();
    if (itemError || !item || item.voided_at)
        return { ok: false, error: "团款计划不存在或已作废" };
    const received = ((item.operation_revenue_receipts ?? []) as Array<{
        amount: number;
    }>).reduce((sum, row) => sum + Number(row.amount), 0);
    if (received + input.amount > Number(item.planned_amount) + 0.01)
        return { ok: false, error: "本次收款超过计划剩余金额" };
    const { error } = await supabase.from("operation_revenue_receipts").insert({ revenue_item_id: input.revenueItemId, amount: input.amount, received_at: input.receivedAt, method: input.method, note: input.note?.trim() || null, received_by_name: actor.displayName });
    if (error)
        return { ok: false, error: error.message };
    refresh();
    return { ok: true };
}
