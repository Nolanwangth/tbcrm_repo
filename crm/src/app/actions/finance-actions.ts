"use server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/app/actions/customer-actions";
import { FINANCE_CLAIM_TYPES, validateFinancePayment, type FinanceClaimType } from "@/lib/finance";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
const bucket = () => process.env.SUPABASE_STORAGE_BUCKET || "crm-files";
const MAX_RECEIPT_SIZE_BYTES = 20 * 1024 * 1024;
const FINANCE_FOLDER_NAME = "报账资料";
const RECEIPT_FOLDER_NAME = "付款回执";
function unavailable(): ActionResult | null {
    return isSupabaseConfigured()
        ? null
        : { ok: false, error: "Supabase 尚未配置，无法保存报账数据。" };
}
function refreshFinance(customerId?: string) {
    revalidatePath("/finance");
    revalidatePath("/operations");
    if (customerId)
        revalidatePath(`/customers/${customerId}`);
}
export async function createFinanceClaimAction(input: {
    operationCaseId: string;
    claimType: FinanceClaimType;
    payeeName: string;
    note?: string | null;
    items: Array<{
        itemId: string;
        amount: number;
    }>;
}): Promise<ActionResult> {
    const missing = unavailable();
    if (missing)
        return missing;
    const actor = await getCurrentUser();
    if (!actor)
        return { ok: false, error: "登录已过期，请重新登录" };
    if (!input.operationCaseId)
        return { ok: false, error: "请选择计调客户" };
    if (!FINANCE_CLAIM_TYPES.includes(input.claimType))
        return { ok: false, error: "费用申请类型无效" };
    if (!input.payeeName.trim())
        return { ok: false, error: "请填写收款方" };
    if (!input.items.length)
        return { ok: false, error: "请至少选择一项计调费用" };
    if (input.items.some((item) => !item.itemId || !Number.isFinite(item.amount) || item.amount <= 0)) {
        return { ok: false, error: "报账费用数据无效" };
    }
    const { data, error } = await getSupabaseAdmin().rpc("create_finance_claim_v2", {
        p_operation_case_id: input.operationCaseId,
        p_applicant_name: actor.displayName,
        p_claim_type: input.claimType,
        p_payee_name: input.payeeName.trim(),
        p_note: input.note?.trim() || null,
        p_items: input.items,
    });
    if (error)
        return { ok: false, error: error.message };
    refreshFinance();
    return { ok: true, id: String(data) };
}
export async function reviewFinanceClaimAction(input: {
    claimId: string;
    decision: "approved" | "rejected";
    financeName: string;
    note?: string | null;
}): Promise<ActionResult> {
    const missing = unavailable();
    if (missing)
        return missing;
    const actor = await getCurrentUser();
    if (!actor)
        return { ok: false, error: "登录已过期，请重新登录" };
    if (!input.claimId)
        return { ok: false, error: "报账单不存在" };
    if (actor.role !== "admin")
        return { ok: false, error: "只有管理员可以审核报账" };
    if (input.decision === "rejected" && !input.note?.trim()) {
        return { ok: false, error: "驳回时请填写原因" };
    }
    const { error } = await getSupabaseAdmin().rpc("review_finance_claim", {
        p_claim_id: input.claimId,
        p_decision: input.decision,
        p_finance_name: actor.displayName,
        p_note: input.note?.trim() || null,
    });
    if (error)
        return { ok: false, error: error.message };
    refreshFinance();
    return { ok: true };
}
async function ensureFolder(customerId: string, name: string, parentId: string | null) {
    const supabase = getSupabaseAdmin();
    let query = supabase
        .from("customer_folders")
        .select("id")
        .eq("customer_id", customerId)
        .eq("name", name);
    query = parentId ? query.eq("parent_id", parentId) : query.is("parent_id", null);
    const { data: existing, error } = await query.maybeSingle();
    if (error)
        throw new Error(error.message);
    if (existing)
        return String(existing.id);
    const { data, error: insertError } = await supabase
        .from("customer_folders")
        .insert({
        customer_id: customerId,
        parent_id: parentId,
        name,
        workflow_status_enabled: false,
    })
        .select("id")
        .single();
    if (!insertError && data)
        return String(data.id);
    if (insertError?.code === "23505") {
        let concurrentQuery = supabase
            .from("customer_folders")
            .select("id")
            .eq("customer_id", customerId)
            .eq("name", name);
        concurrentQuery = parentId
            ? concurrentQuery.eq("parent_id", parentId)
            : concurrentQuery.is("parent_id", null);
        const { data: concurrent, error: concurrentError } = await concurrentQuery.maybeSingle();
        if (!concurrentError && concurrent)
            return String(concurrent.id);
    }
    throw new Error(insertError?.message ?? "无法创建报账附件目录");
}
async function ensureReceiptFolder(customerId: string, claimNo: string) {
    const financeFolderId = await ensureFolder(customerId, FINANCE_FOLDER_NAME, null);
    const claimFolderId = await ensureFolder(customerId, claimNo, financeFolderId);
    return ensureFolder(customerId, RECEIPT_FOLDER_NAME, claimFolderId);
}
export async function registerFinancePaymentAction(formData: FormData): Promise<ActionResult> {
    const missing = unavailable();
    if (missing)
        return missing;
    const actor = await getCurrentUser();
    if (!actor)
        return { ok: false, error: "登录已过期，请重新登录" };
    if (actor.role !== "admin")
        return { ok: false, error: "只有管理员可以登记付款" };
    const claimId = String(formData.get("claimId") ?? "");
    const financeName = actor.displayName;
    const note = String(formData.get("note") ?? "").trim();
    const paidAtInput = String(formData.get("paidAt") ?? "");
    const amount = Number(formData.get("amount"));
    const receipt = formData.get("receipt");
    if (!(receipt instanceof File) || receipt.size === 0) {
        return { ok: false, error: "请上传付款回执" };
    }
    if (receipt.size > MAX_RECEIPT_SIZE_BYTES) {
        return { ok: false, error: "付款回执不能超过 20 MB" };
    }
    const supabase = getSupabaseAdmin();
    const { data: claim, error: claimError } = await supabase
        .from("finance_claims")
        .select("id,claim_no,customer_id,amount,finance_payments(amount)")
        .eq("id", claimId)
        .maybeSingle();
    if (claimError || !claim)
        return { ok: false, error: claimError?.message ?? "报账单不存在" };
    const payments = Array.isArray(claim.finance_payments) ? claim.finance_payments : [];
    const paidTotal = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const remaining = Math.max(Number(claim.amount) - paidTotal, 0);
    const validationError = validateFinancePayment({
        amount,
        remaining,
        paidAt: paidAtInput,
        paidByName: financeName,
        hasReceipt: true,
    });
    if (validationError)
        return { ok: false, error: validationError };
    const paidAt = new Date(paidAtInput);
    if (Number.isNaN(paidAt.getTime()))
        return { ok: false, error: "付款时间无效" };
    let folderId: string;
    try {
        folderId = await ensureReceiptFolder(String(claim.customer_id), String(claim.claim_no));
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "无法创建付款回执目录" };
    }
    const safeName = receipt.name.replace(/[^\p{L}\p{N}._-]+/gu, "-");
    const storagePath = `${claim.customer_id}/finance/${claimId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from(bucket()).upload(storagePath, receipt, {
        contentType: receipt.type || "application/octet-stream",
        upsert: false,
    });
    if (uploadError)
        return { ok: false, error: uploadError.message };
    const { data: storedFile, error: fileError } = await supabase
        .from("customer_files")
        .insert({
        customer_id: claim.customer_id,
        folder_id: folderId,
        name: receipt.name,
        storage_path: storagePath,
        size_bytes: receipt.size,
        mime_type: receipt.type || null,
    })
        .select("id")
        .single();
    if (fileError || !storedFile) {
        await supabase.storage.from(bucket()).remove([storagePath]);
        return { ok: false, error: fileError?.message ?? "保存付款回执失败" };
    }
    const { data: paymentId, error: paymentError } = await supabase.rpc("register_finance_payment", {
        p_claim_id: claimId,
        p_amount: amount,
        p_paid_at: paidAt.toISOString(),
        p_receipt_file_id: storedFile.id,
        p_paid_by_name: financeName,
        p_note: note || null,
    });
    if (paymentError) {
        await supabase.from("customer_files").delete().eq("id", storedFile.id);
        await supabase.storage.from(bucket()).remove([storagePath]);
        return { ok: false, error: paymentError.message };
    }
    refreshFinance(String(claim.customer_id));
    return { ok: true, id: String(paymentId) };
}
