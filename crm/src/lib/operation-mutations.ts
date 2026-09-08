import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
export async function mutateOperation(table: string, caseId: string, id: string | null | undefined, revision: number | undefined, values: Record<string, unknown>, remove = false) {
    const actor = await getCurrentUser();
    if (!actor)
        return { data: null, error: { message: "登录状态已失效", code: "42501" } };
    return getSupabaseAdmin().rpc("crm_mutate_operation", { p_actor: actor.id, p_case: caseId, p_table: table, p_id: id ?? null, p_expected_revision: revision ?? null, p_values: values, p_delete: remove });
}
