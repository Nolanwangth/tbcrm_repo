"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { SERVICE_WORKBENCHES } from "@/lib/constants";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import type { ServiceWorkbench } from "@/lib/types";
import type { ActionResult } from "@/app/actions/customer-actions";
const assignmentSchema = z.object({
    customerId: z.string().uuid(),
    targetWorkbench: z.enum(SERVICE_WORKBENCHES),
    reason: z.string().trim().max(500).optional(),
});
export async function changeServiceAssignmentAction(input: {
    customerId: string;
    targetWorkbench: ServiceWorkbench;
    reason?: string;
}): Promise<ActionResult> {
    if (!isSupabaseConfigured())
        return { ok: false, error: "Supabase 尚未配置，无法修改规划师归属。" };
    const parsed = assignmentSchema.safeParse(input);
    if (!parsed.success)
        return { ok: false, error: parsed.error.issues[0]?.message ?? "规划师归属数据有误" };
    const user = await getCurrentUser();
    if (!user)
        return { ok: false, error: "登录状态已失效，请重新登录" };
    const { error } = await getSupabaseAdmin().rpc("crm_change_customer_assignment", { p_actor: user.id, p_customer: parsed.data.customerId, p_slot: parsed.data.targetWorkbench, p_unlock: false, p_reason: parsed.data.reason ?? null });
    if (error)
        return { ok: false, error: error.message };
    revalidatePath("/", "layout");
    return { ok: true };
}
export async function unlockExclusiveServiceAssignmentAction(input: {
    customerId: string;
    reason: string;
}): Promise<ActionResult> {
    if (!isSupabaseConfigured())
        return { ok: false, error: "Supabase 尚未配置，无法解除专属归属。" };
    const parsed = z.object({ customerId: z.string().uuid(), reason: z.string().trim().min(2, "请填写解除原因").max(500) }).safeParse(input);
    if (!parsed.success)
        return { ok: false, error: parsed.error.issues[0]?.message ?? "解除原因有误" };
    const user = await getCurrentUser();
    if (!user)
        return { ok: false, error: "登录状态已失效，请重新登录" };
    const { error } = await getSupabaseAdmin().rpc("crm_change_customer_assignment", { p_actor: user.id, p_customer: parsed.data.customerId, p_slot: null, p_unlock: true, p_reason: parsed.data.reason });
    if (error)
        return { ok: false, error: error.message };
    revalidatePath("/", "layout");
    return { ok: true };
}
