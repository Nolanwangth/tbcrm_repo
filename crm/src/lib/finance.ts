import type { OperationServiceItem } from "@/lib/operations";
export const FINANCE_CLAIM_STATUSES = [
    "pending",
    "approved",
    "rejected",
    "partially_paid",
    "paid",
] as const;
export type FinanceClaimStatus = (typeof FINANCE_CLAIM_STATUSES)[number];
export const FINANCE_CLAIM_TYPES = ["personal_reimbursement", "supplier_payment"] as const;
export type FinanceClaimType = (typeof FINANCE_CLAIM_TYPES)[number];
export const FINANCE_CLAIM_TYPE_LABELS: Record<FinanceClaimType, string> = {
    personal_reimbursement: "个人垫付报销",
    supplier_payment: "供应商付款",
};
export const FINANCE_CLAIM_STATUS_LABELS: Record<FinanceClaimStatus, string> = {
    pending: "待财务审核",
    approved: "待付款",
    rejected: "已驳回",
    partially_paid: "部分付款",
    paid: "已付清",
};
export interface FinanceClaimItem {
    id: string;
    operationServiceItemId: string;
    title: string;
    category: string;
    supplierName: string | null;
    serviceDate: string | null;
    requestedAmount: number;
    invoiceFileId: string | null;
}
export interface FinancePayment {
    id: string;
    amount: number;
    paidAt: string;
    paidByName: string;
    note: string | null;
    receiptFileId: string;
    receiptFileName: string;
    createdAt: string;
}
export interface FinanceClaimEvent {
    id: string;
    eventType: "submitted" | "approved" | "rejected" | "payment_recorded";
    actorName: string;
    note: string | null;
    amount: number | null;
    createdAt: string;
}
export interface FinanceClaim {
    id: string;
    claimNo: string;
    operationCaseId: string;
    tourCode: string | null;
    tourName: string | null;
    customerId: string;
    customerName: string;
    applicantName: string;
    claimType: FinanceClaimType;
    payeeName: string;
    amount: number;
    status: FinanceClaimStatus;
    note: string | null;
    submittedAt: string;
    reviewedAt: string | null;
    reviewedByName: string | null;
    reviewNote: string | null;
    items: FinanceClaimItem[];
    payments: FinancePayment[];
    events: FinanceClaimEvent[];
    updatedAt: string;
    createdAt: string;
}
export function validateFinanceClaimInput(input: {
    claimType: FinanceClaimType;
    payeeName: string;
    selectedItems: Array<Pick<FinanceOperationItem, "supplierName">>;
}) {
    if (!input.payeeName.trim())
        return "请填写收款方";
    if (input.claimType !== "supplier_payment")
        return null;
    if (!input.selectedItems.length)
        return "请至少选择一项计调费用";
    const suppliers = new Set(input.selectedItems.map((item) => item.supplierName?.trim() ?? ""));
    if (suppliers.has(""))
        return "供应商付款项目必须先填写供应商";
    if (suppliers.size !== 1)
        return "一张供应商付款申请不能混合不同供应商";
    if (!suppliers.has(input.payeeName.trim()))
        return "收款方必须与所选服务项目的供应商一致";
    return null;
}
export type FinanceOperationItem = Pick<OperationServiceItem, "id" | "title" | "category" | "supplierName" | "serviceDate" | "bookingStatus" | "finalSupplierSettlement" | "invoiceUnitCost" | "quantity">;
export interface FinanceOperationOption {
    id: string;
    customerName: string;
    tourCode?: string;
    tourName?: string;
    ownerName: string | null;
    items: FinanceOperationItem[];
}
export function operationItemClaimBaseAmount(item: Pick<OperationServiceItem, "finalSupplierSettlement" | "invoiceUnitCost" | "quantity">) {
    if (item.finalSupplierSettlement != null)
        return roundMoney(item.finalSupplierSettlement);
    return roundMoney((item.invoiceUnitCost ?? 0) * item.quantity);
}
export function financeClaimPaymentSummary(claim: {
    amount: number;
    payments: Array<Pick<FinancePayment, "amount">>;
}) {
    const paid = roundMoney(claim.payments.reduce((sum, payment) => sum + payment.amount, 0));
    return {
        paid,
        remaining: roundMoney(Math.max(claim.amount - paid, 0)),
    };
}
export function financeClaimedAmounts(claims: FinanceClaim[]) {
    const amounts = new Map<string, number>();
    claims
        .filter((claim) => claim.status !== "rejected")
        .flatMap((claim) => claim.items)
        .forEach((item) => {
        amounts.set(item.operationServiceItemId, roundMoney((amounts.get(item.operationServiceItemId) ?? 0) + item.requestedAmount));
    });
    return amounts;
}
export function validateFinancePayment(input: {
    amount: number;
    remaining: number;
    paidAt: string;
    paidByName: string;
    hasReceipt: boolean;
}) {
    if (!Number.isFinite(input.amount) || input.amount <= 0)
        return "付款金额必须大于 0";
    if (input.amount > input.remaining)
        return "付款金额不能超过剩余待付金额";
    if (!input.paidAt)
        return "请选择付款时间";
    if (!input.paidByName.trim())
        return "请填写财务经办人";
    if (!input.hasReceipt)
        return "请上传付款回执";
    return null;
}
function roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}
