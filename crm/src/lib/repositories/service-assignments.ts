import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { ServiceAssignmentMode, ServiceWorkbench } from "@/lib/types";
export async function resolveServiceWorkbench(workbench: ServiceWorkbench) {
    const supabase = getSupabaseAdmin();
    const { data: slot, error } = await supabase
        .from("service_workbench_slots")
        .select("slot,user_id,enabled")
        .eq("slot", workbench)
        .maybeSingle();
    if (error || !slot?.enabled || !slot.user_id)
        return null;
    const { data: user } = await supabase
        .from("crm_users")
        .select("id,display_name,active,role")
        .eq("id", slot.user_id)
        .maybeSingle();
    return user?.active && (user.role === "planner") ? { slot: workbench, userId: String(user.id), displayName: String(user.display_name) } : null;
}
export async function getServiceWorkbenchForUser(userId: string) {
    const { data, error } = await getSupabaseAdmin()
        .from("service_workbench_slots")
        .select("slot")
        .eq("user_id", userId)
        .maybeSingle();
    if (error || !data || !(["A", "B", "C", "D", "E"] as const).includes(data.slot as ServiceWorkbench))
        return null;
    return data.slot as ServiceWorkbench;
}
export async function recordServiceAssignmentEvent(input: {
    customerId: string;
    action: "auto_assigned" | "exclusive_assigned" | "manually_assigned" | "reassigned" | "exclusive_unlocked" | "assignment_failed";
    assignmentMode?: ServiceAssignmentMode | null;
    fromWorkbench?: ServiceWorkbench | null;
    toWorkbench?: ServiceWorkbench | null;
    actor?: {
        id: string;
        displayName: string;
    } | null;
    reason?: string | null;
}) {
    return getSupabaseAdmin().from("service_assignment_events").insert({
        customer_id: input.customerId,
        action: input.action,
        assignment_mode: input.assignmentMode ?? null,
        from_workbench: input.fromWorkbench ?? null,
        to_workbench: input.toWorkbench ?? null,
        actor_id: input.actor?.id ?? null,
        actor_name_snapshot: input.actor?.displayName ?? null,
        reason: input.reason ?? null,
    });
}
