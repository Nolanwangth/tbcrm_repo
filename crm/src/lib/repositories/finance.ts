import "server-only";
import { connection } from "next/server";
import type { FinanceClaim, FinanceClaimStatus, FinanceClaimType, } from "@/lib/finance";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
type Row = Record<string, unknown>;
const rows = (value: unknown): Row[] => Array.isArray(value) ? value as Row[] : [];
const first = (value: unknown): Row => {
    if (Array.isArray(value))
        return (value[0] as Row | undefined) ?? {};
    return (value as Row | null) ?? {};
};
const nullable = (value: unknown) => value == null || value === "" ? null : String(value);
function mapClaim(row: Row): FinanceClaim {
    const customer = first(row.customers);
    const operation = first(row.operation_cases);
    return {
        id: String(row.id),
        claimNo: String(row.claim_no),
        operationCaseId: String(row.operation_case_id),
        tourCode: nullable(operation.tour_code),
        tourName: nullable(operation.tour_name),
        customerId: String(row.customer_id),
        customerName: String(customer.name ?? "未知客户"),
        applicantName: String(row.applicant_name),
        claimType: row.claim_type as FinanceClaimType,
        payeeName: String(row.payee_name),
        amount: Number(row.amount),
        status: row.status as FinanceClaimStatus,
        note: nullable(row.note),
        submittedAt: String(row.submitted_at),
        reviewedAt: nullable(row.reviewed_at),
        reviewedByName: nullable(row.reviewed_by_name),
        reviewNote: nullable(row.review_note),
        items: rows(row.finance_claim_items)
            .map((item) => ({
            id: String(item.id),
            operationServiceItemId: String(item.operation_service_item_id),
            title: String(item.title),
            category: String(item.category),
            supplierName: nullable(item.supplier_name),
            serviceDate: nullable(item.service_date),
            requestedAmount: Number(item.requested_amount),
            invoiceFileId: nullable(item.invoice_file_id),
        }))
            .sort((a, b) => (a.serviceDate ?? "").localeCompare(b.serviceDate ?? "") ||
            a.title.localeCompare(b.title, "zh-CN")),
        payments: rows(row.finance_payments)
            .map((payment) => {
            const receipt = first(payment.customer_files);
            return {
                id: String(payment.id),
                amount: Number(payment.amount),
                paidAt: String(payment.paid_at),
                paidByName: String(payment.paid_by_name),
                note: nullable(payment.note),
                receiptFileId: String(payment.receipt_file_id),
                receiptFileName: String(receipt.name ?? "付款回执"),
                createdAt: String(payment.created_at),
            };
        })
            .sort((a, b) => b.paidAt.localeCompare(a.paidAt)),
        events: rows(row.finance_claim_events)
            .map((event) => ({
            id: String(event.id),
            eventType: event.event_type as FinanceClaim["events"][number]["eventType"],
            actorName: String(event.actor_name),
            note: nullable(event.note),
            amount: event.amount == null ? null : Number(event.amount),
            createdAt: String(event.created_at),
        }))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        updatedAt: String(row.updated_at),
        createdAt: String(row.created_at),
    };
}
const financeClaimSelect = `
  *,
  customers!inner(name),
  operation_cases(tour_code,tour_name),
  finance_claim_items(*),
  finance_payments(*, customer_files(name)),
  finance_claim_events(*)
`;
export async function getFinanceClaims(summary = false, operationCaseId?: string) {
    await connection();
    let query = getSupabaseAdmin()
        .from("finance_claims")
        .select(summary ? '*, customers!inner(name), operation_cases(tour_code,tour_name), finance_payments(amount,paid_at)' : financeClaimSelect)
        .order("submitted_at", { ascending: false })
        .order("paid_at", { referencedTable: "finance_payments", ascending: false });
    if (!summary)
        query = query.order("created_at", { referencedTable: "finance_claim_events", ascending: false });
    if (operationCaseId)
        query = query.eq('operation_case_id', operationCaseId);
    const { data, error } = await query;
    if (error)
        throw new Error(`读取报账数据失败：${error.message}`);
    return (data as unknown as Row[]).map(mapClaim);
}
