"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { buildStorageObjectName } from "@/lib/storage-object-name";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { writeCustomerAudits } from "@/lib/customer-audit";
import { mutateOperation } from "@/lib/operation-mutations";
import { validateTravelerDetails } from "@/lib/traveler-validation";
import type { ActionResult } from "@/app/actions/customer-actions";
const bucket = () => process.env.SUPABASE_STORAGE_BUCKET || "crm-files";
const MAX_SIZE = 20 * 1024 * 1024;
async function storeFile(customerId: string, file: File) {
    if (file.size > MAX_SIZE)
        throw new Error("文件不能超过 20 MB");
    const supabase = getSupabaseAdmin();
    const storagePath = `${customerId}/archive/${buildStorageObjectName(file.name, crypto.randomUUID())}`;
    const { error: uploadError } = await supabase.storage.from(bucket()).upload(storagePath, file, { contentType: file.type || "application/octet-stream" });
    if (uploadError)
        throw new Error(uploadError.message);
    const { data, error } = await supabase.from("customer_files").insert({ customer_id: customerId, name: file.name, storage_path: storagePath, size_bytes: file.size, mime_type: file.type || null }).select("id").single();
    if (error || !data) {
        await supabase.storage.from(bucket()).remove([storagePath]);
        throw new Error(error?.message ?? "文件登记失败");
    }
    return { id: String(data.id), storagePath };
}
async function discardStoredFile(fileId: string, storagePath: string) {
    const supabase = getSupabaseAdmin();
    await supabase.from("customer_files").delete().eq("id", fileId);
    await supabase.storage.from(bucket()).remove([storagePath]);
}
export async function uploadCustomerDocumentAction(formData: FormData): Promise<ActionResult> {
    const customerId = String(formData.get("customerId") ?? "");
    const documentType = String(formData.get("documentType") ?? "");
    const file = formData.get("file");
    if (!customerId || !(file instanceof File) || !["contract", "proforma_invoice"].includes(documentType))
        return { ok: false, error: "请选择合同或形式发票文件" };
    const user = await getCurrentUser();
    if (!user)
        return { ok: false, error: "登录状态已失效" };
    try {
        const stored = await storeFile(customerId, file);
        const supabase = getSupabaseAdmin();
        const { error } = await supabase.rpc("crm_link_customer_document", { p_actor: user.id, p_customer: customerId, p_file: stored.id, p_type: documentType, p_previous: String(formData.get("previousLinkId") ?? "") || null });
        if (error) {
            await discardStoredFile(stored.id, stored.storagePath);
            throw new Error(error.message);
        }
        revalidatePath(`/customers/${customerId}`);
        return { ok: true, id: stored.id };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "上传失败" };
    }
}
export async function saveTravelerAction(formData: FormData): Promise<ActionResult> {
    const customerId = String(formData.get("customerId") ?? "");
    const caseId = String(formData.get("caseId") ?? "");
    const travelerId = String(formData.get("travelerId") ?? "");
    const user = await getCurrentUser();
    if (!user)
        return { ok: false, error: "登录状态已失效" };
    const travelerType = String(formData.get("travelerType") ?? "adult");
    const age = String(formData.get("age") ?? "").trim() === "" ? null : Number(formData.get("age"));
    const height = String(formData.get("heightCm") ?? "").trim() === "" ? null : Number(formData.get("heightCm"));
    const validationError = validateTravelerDetails(travelerType, age, height);
    if (validationError)
        return { ok: false, error: validationError };
    if (!customerId || !caseId || !String(formData.get("fullName") ?? "").trim())
        return { ok: false, error: "请填写旅客姓名" };
    const { data: operation } = await getSupabaseAdmin().from("operation_cases").select("customer_id").eq("id", caseId).single();
    if (operation?.customer_id !== customerId)
        return { ok: false, error: "服务清单不属于该客户" };
    try {
        const passport = formData.get("passportFile");
        let storedPassport: {
            id: string;
            storagePath: string;
        } | null = null;
        if (passport instanceof File && passport.size) {
            if (passport.size > MAX_SIZE)
                throw new Error("护照附件不能超过 20 MB");
            const bytes = new Uint8Array(await passport.slice(0, 16).arrayBuffer());
            const ascii = String.fromCharCode(...bytes);
            const mime = ascii.startsWith("%PDF-") ? "application/pdf" : bytes[0] === 0xff && bytes[1] === 0xd8 ? "image/jpeg" : bytes[0] === 137 && ascii.slice(1, 4) === "PNG" ? "image/png" : ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP" ? "image/webp" : null;
            if (!mime)
                throw new Error("护照附件须为真实 PDF、JPG、PNG 或 WebP 文件");
            storedPassport = await storeFile(customerId, new File([passport], passport.name, { type: mime }));
        }
        const passportFileId = storedPassport?.id ?? null;
        const row = { case_id: caseId, traveler_type: String(formData.get("travelerType") ?? "adult"), full_name: String(formData.get("fullName") ?? "").trim(), age: String(formData.get("age") ?? "").trim() === "" ? null : Number(formData.get("age")), height_cm: Number(formData.get("heightCm")) || null, nationality: String(formData.get("nationality") ?? "").trim() || null, passport_number: String(formData.get("passportNumber") ?? "").trim() || null, birth_date: String(formData.get("birthDate") ?? "") || null, passport_expiry_date: String(formData.get("passportExpiryDate") ?? "") || null, ...(passportFileId ? { passport_file_id: passportFileId } : {}) };
        const result = await mutateOperation("operation_travelers", caseId, travelerId || null, travelerId ? Number(formData.get("revision")) : undefined, row);
        if (result.error) {
            if (storedPassport)
                await discardStoredFile(storedPassport.id, storedPassport.storagePath);
            throw new Error(result.error.message);
        }
        await writeCustomerAudits([{ customerId, fieldName: "旅客与护照资料", newValue: row.full_name }]);
        revalidatePath(`/customers/${customerId}`);
        revalidatePath(`/operations/${caseId}`);
        return { ok: true };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "保存失败" };
    }
}
export async function deleteTravelerAction(input: {
    customerId: string;
    caseId: string;
    travelerId: string;
    revision?: number;
}): Promise<ActionResult> {
    const { error } = await mutateOperation("operation_travelers", input.caseId, input.travelerId, input.revision, {}, true);
    if (error)
        return { ok: false, error: error.message };
    revalidatePath(`/customers/${input.customerId}`);
    revalidatePath(`/operations/${input.caseId}`);
    return { ok: true };
}
export async function acknowledgeOperationChangeAction(input: {
    customerId: string;
    eventId: string;
    role: "planner" | "operations";
    reason?: string;
}): Promise<ActionResult> {
    const user = await getCurrentUser();
    if (!user)
        return { ok: false, error: "登录状态已失效" };
    const { error } = await getSupabaseAdmin().rpc("crm_acknowledge_operation_change", { p_actor: user.id, p_customer: input.customerId, p_event: input.eventId, p_role: input.role, p_reason: input.reason ?? null });
    if (error)
        return { ok: false, error: error.message };
    revalidatePath(`/customers/${input.customerId}`);
    revalidatePath("/operations", "layout");
    return { ok: true };
}
