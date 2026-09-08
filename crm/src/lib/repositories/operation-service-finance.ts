import "server-only";
import { connection } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
export type ServiceFinanceControl = {
    serviceItemId: string;
    paymentChannel: "public" | "personal";
    reconciliationStatus: "pending" | "reconciled";
    reconciledAmount: number | null;
    reconciledAt: string | null;
    reconciledByName: string | null;
    note: string | null;
};
export async function getServiceFinanceControls(): Promise<ServiceFinanceControl[]> {
    await connection();
    const { data, error } = await getSupabaseAdmin().from("operation_service_finance_controls").select("*");
    if (error)
        throw new Error(`读取服务费用对账失败：${error.message}`);
    return (data ?? []).map((row) => ({ serviceItemId: String(row.service_item_id), paymentChannel: row.payment_channel as ServiceFinanceControl["paymentChannel"], reconciliationStatus: row.reconciliation_status as ServiceFinanceControl["reconciliationStatus"], reconciledAmount: row.reconciled_amount == null ? null : Number(row.reconciled_amount), reconciledAt: row.reconciled_at == null ? null : String(row.reconciled_at), reconciledByName: row.reconciled_by_name == null ? null : String(row.reconciled_by_name), note: row.note == null ? null : String(row.note) }));
}
