"use server";
export async function getPendingServiceAlertsAction() {
    const actor = await getCurrentUser();
    if (!actor)
        return { ok: false as const };
    const { data, count, error } = await getSupabaseAdmin().from('operation_change_events').select('case_id', { count: 'exact' }).eq('strong_alert', true).or('planner_ack_at.is.null,operations_ack_at.is.null').order('created_at', { ascending: false }).limit(1);
    if (error)
        return { ok: false as const };
    return { ok: true as const, count: count ?? 0, caseId: data?.[0]?.case_id as string | null ?? null };
}
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
export async function getServiceHistoryAction(caseId: string, page: number, onlyOpen: boolean) {
    const user = await getCurrentUser();
    if (!user)
        return { ok: false as const, error: "登录状态已失效" };
    const offset = (Math.max(1, Math.min(100000, Math.floor(page) || 1)) - 1) * 20;
    let query = getSupabaseAdmin().from("operation_change_events").select("*,operation_change_acknowledgements(*)", { count: "exact" }).eq("case_id", caseId);
    if (onlyOpen)
        query = query.eq("strong_alert", true).or("planner_ack_at.is.null,operations_ack_at.is.null");
    const { data, error, count } = await query.order("created_at", { ascending: false }).order("id").range(offset, offset + 19);
    if (error)
        return { ok: false as const, error: error.message };
    return { ok: true as const, rows: data as Record<string, unknown>[], total: count ?? 0, role: user.role };
}
