import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
export type CustomerAuditInput = {
    customerId: string;
    fieldName: string;
    oldValue?: unknown;
    newValue?: unknown;
};
export async function writeCustomerAudits(rows: CustomerAuditInput[]) {
    if (!rows.length)
        return { error: null };
    const actor = await getCurrentUser();
    if (!actor)
        return { error: new Error("登录状态已失效，请重新登录") };
    return getSupabaseAdmin().from("audit_logs").insert(rows.map((row) => ({
        customer_id: row.customerId,
        field_name: row.fieldName,
        old_value: row.oldValue == null ? null : String(row.oldValue),
        new_value: row.newValue == null ? null : String(row.newValue),
        actor_user_id: actor.id,
        actor_name_snapshot: actor.displayName,
        actor_role_snapshot: actor.role,
    })));
}
export async function writeRawCustomerAudits(rows: Array<{
    customer_id: string;
    field_name: string;
    old_value?: unknown;
    new_value?: unknown;
}>) {
    return writeCustomerAudits(rows.map((row) => ({
        customerId: row.customer_id,
        fieldName: row.field_name,
        oldValue: row.old_value,
        newValue: row.new_value,
    })));
}
