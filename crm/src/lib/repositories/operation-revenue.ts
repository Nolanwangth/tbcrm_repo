import "server-only";
import { connection } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
export type OperationRevenueItem = {
    id: string;
    caseId: string;
    tourCode: string;
    tourName: string;
    customerName: string;
    kind: "group_fee" | "deposit" | "balance" | "addon" | "other";
    title: string;
    plannedAmount: number;
    receivedAmount: number;
    outstandingAmount: number;
    voidedAt: string | null;
    note: string | null;
    receipts: Array<{
        id: string;
        amount: number;
        receivedAt: string;
        method: string;
        note: string | null;
    }>;
};
const rows = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value as Record<string, unknown>[] : [];
const first = (value: unknown): Record<string, unknown> => Array.isArray(value) ? (value[0] as Record<string, unknown> | undefined) ?? {} : (value as Record<string, unknown> | null) ?? {};
export async function getOperationRevenueItems(): Promise<OperationRevenueItem[]> {
    await connection();
    const { data, error } = await getSupabaseAdmin().from("operation_revenue_items").select(`
    *, operation_cases!inner(tour_code,tour_name,customers!inner(name)), operation_revenue_receipts(*)
  `).order("created_at", { ascending: false });
    if (error)
        throw new Error(`读取团款台账失败：${error.message}`);
    return rows(data).map((row) => {
        const operation = first(row.operation_cases);
        const customer = first(operation.customers);
        const receipts = rows(row.operation_revenue_receipts).map((receipt) => ({
            id: String(receipt.id), amount: Number(receipt.amount), receivedAt: String(receipt.received_at), method: String(receipt.method), note: receipt.note == null ? null : String(receipt.note),
        })).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
        const plannedAmount = Number(row.planned_amount);
        const receivedAmount = receipts.reduce((sum, receipt) => sum + receipt.amount, 0);
        return {
            id: String(row.id), caseId: String(row.case_id), tourCode: String(operation.tour_code), tourName: String(operation.tour_name), customerName: String(customer.name),
            kind: row.kind as OperationRevenueItem["kind"], title: String(row.title), plannedAmount, receivedAmount,
            outstandingAmount: Math.max(plannedAmount - receivedAmount, 0), voidedAt: row.voided_at == null ? null : String(row.voided_at), note: row.note == null ? null : String(row.note), receipts,
        };
    });
}
