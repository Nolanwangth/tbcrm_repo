import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { CrmUserRole, CrmUserSummary } from "@/lib/types";
function mapUser(row: Record<string, unknown>): CrmUserSummary {
    return {
        id: String(row.id),
        username: String(row.username),
        displayName: String(row.display_name),
        role: row.role as CrmUserRole,
        active: Boolean(row.active),
    };
}
export async function getAssignableUsers() {
    const { data, error } = await getSupabaseAdmin()
        .from("crm_users")
        .select("id,username,display_name,role,active")
        .eq("active", true)
        .in("role", ["planner"])
        .order("role")
        .order("display_name");
    if (error)
        throw new Error(`读取负责人账号失败：${error.message}`);
    return (data ?? []).map((row) => mapUser(row as Record<string, unknown>));
}
export async function resolveAssignableUser(userId?: string | null) {
    if (!userId)
        return null;
    const { data, error } = await getSupabaseAdmin()
        .from("crm_users")
        .select("id,username,display_name,role,active")
        .eq("id", userId)
        .eq("active", true)
        .in("role", ["planner"])
        .maybeSingle();
    if (error)
        throw new Error(`校验负责人账号失败：${error.message}`);
    return data ? mapUser(data as Record<string, unknown>) : null;
}
