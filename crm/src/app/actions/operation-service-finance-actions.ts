"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import type { ActionResult } from "@/app/actions/customer-actions";
export async function saveOperationServiceFinanceControlAction(input: {
    serviceItemId: string;
    paymentChannel: "public" | "personal";
    reconciliationStatus: "pending" | "reconciled";
    reconciledAmount?: number | null;
    note?: string | null;
}): Promise<ActionResult> {
    if (!isSupabaseConfigured())
        return { ok: false, error: "Supabase 尚未配置" };
    const actor = await getCurrentUser();
    if (!actor)
        return { ok: false, error: "登录已过期，请重新登录" };
    if (!input.serviceItemId || !["public", "personal"].includes(input.paymentChannel) || !["pending", "reconciled"].includes(input.reconciliationStatus))
        return { ok: false, error: "对账状态无效" };
    if (input.reconciliationStatus === "reconciled" && (!Number.isFinite(input.reconciledAmount) || Number(input.reconciledAmount) < 0))
        return { ok: false, error: "请填写有效对账金额" };
    const { error } = await getSupabaseAdmin().from("operation_service_finance_controls").upsert({ service_item_id: input.serviceItemId, payment_channel: input.paymentChannel, reconciliation_status: input.reconciliationStatus, reconciled_amount: input.reconciliationStatus === "reconciled" ? input.reconciledAmount : null, reconciled_at: input.reconciliationStatus === "reconciled" ? new Date().toISOString() : null, reconciled_by_name: input.reconciliationStatus === "reconciled" ? actor.displayName : null, note: input.note?.trim() || null }, { onConflict: "service_item_id" });
    if (error)
        return { ok: false, error: error.message };
    revalidatePath("/finance");
    revalidatePath("/operations");
    return { ok: true };
}
