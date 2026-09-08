"use server";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { FOLDER_REVIEW_STATUSES, FOLDER_STATUSES } from "@/lib/constants";
import { buildStorageObjectName } from "@/lib/storage-object-name";
import type { FolderReviewStatus, FolderStatus } from "@/lib/types";
import type { ActionResult } from "@/app/actions/customer-actions";
import { writeCustomerAudits } from "@/lib/customer-audit";
const bucket = () => process.env.SUPABASE_STORAGE_BUCKET || "crm-files";
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
const INITIAL_FILES_FOLDER_NAME = "客户初始资料";
async function folderBelongsToCustomer(customerId: string, folderId: string) {
    const { data, error } = await getSupabaseAdmin()
        .from("customer_folders")
        .select("id")
        .eq("id", folderId)
        .eq("customer_id", customerId)
        .maybeSingle();
    return !error && Boolean(data);
}
async function folderUsesWorkflowStatus(customerId: string, folderId: string) {
    const { data, error } = await getSupabaseAdmin()
        .from("customer_folders")
        .select("workflow_status_enabled")
        .eq("id", folderId)
        .eq("customer_id", customerId)
        .maybeSingle();
    return !error && data?.workflow_status_enabled !== false;
}
function unavailable(): ActionResult | null {
    return isSupabaseConfigured()
        ? null
        : { ok: false, error: "Supabase 尚未配置，无法进行文件操作。" };
}
function refreshFileViews(customerId: string) {
    revalidatePath(`/customers/${customerId}`);
    revalidatePath("/operations", "layout");
}
async function writeFileAudit(customerId: string, fieldName: string, newValue: string, oldValue?: string | null) {
    return writeCustomerAudits([{ customerId, fieldName, oldValue, newValue }]);
}
export async function createFolderAction(input: {
    customerId: string;
    name: string;
    parentId?: string | null;
}): Promise<ActionResult> {
    const missing = unavailable();
    if (missing)
        return missing;
    if (!input.name.trim())
        return { ok: false, error: "请输入文件夹名称" };
    if (input.parentId && !(await folderBelongsToCustomer(input.customerId, input.parentId))) {
        return { ok: false, error: "上级文件夹不存在或不属于当前客户" };
    }
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
        .from("customer_folders")
        .insert({ customer_id: input.customerId, name: input.name.trim(), parent_id: input.parentId ?? null })
        .select("id")
        .single();
    if (error)
        return { ok: false, error: error.message };
    await writeFileAudit(input.customerId, "新建文件夹", input.name.trim());
    refreshFileViews(input.customerId);
    return { ok: true, id: data.id };
}
export async function ensureInitialCustomerFilesFolderAction(customerId: string): Promise<ActionResult> {
    const missing = unavailable();
    if (missing)
        return missing;
    if (!customerId)
        return { ok: false, error: "缺少客户信息" };
    const supabase = getSupabaseAdmin();
    const { data: existing, error: findError } = await supabase
        .from("customer_folders")
        .select("id, workflow_status_enabled")
        .eq("customer_id", customerId)
        .is("parent_id", null)
        .eq("name", INITIAL_FILES_FOLDER_NAME)
        .maybeSingle();
    if (findError)
        return { ok: false, error: findError.message };
    if (existing) {
        if (existing.workflow_status_enabled !== false) {
            const { error } = await supabase
                .from("customer_folders")
                .update({ workflow_status_enabled: false })
                .eq("id", existing.id)
                .eq("customer_id", customerId);
            if (error)
                return { ok: false, error: error.message };
        }
        return { ok: true, id: String(existing.id) };
    }
    const { data, error } = await supabase
        .from("customer_folders")
        .insert({
        customer_id: customerId,
        parent_id: null,
        name: INITIAL_FILES_FOLDER_NAME,
        workflow_status_enabled: false,
    })
        .select("id")
        .single();
    if (error)
        return { ok: false, error: error.message };
    refreshFileViews(customerId);
    return { ok: true, id: String(data.id) };
}
export async function uploadFileAction(formData: FormData): Promise<ActionResult> {
    const missing = unavailable();
    if (missing)
        return missing;
    const customerId = String(formData.get("customerId") ?? "");
    const folderId = String(formData.get("folderId") ?? "") || null;
    const file = formData.get("file");
    if (!(file instanceof File) || !customerId)
        return { ok: false, error: "请选择需要上传的文件" };
    if (file.size > MAX_FILE_SIZE_BYTES)
        return { ok: false, error: "单个文件不能超过 100 MB" };
    if (folderId && !(await folderBelongsToCustomer(customerId, folderId))) {
        return { ok: false, error: "目标文件夹不存在或不属于当前客户" };
    }
    const storagePath = `${customerId}/${buildStorageObjectName(file.name, crypto.randomUUID())}`;
    const supabase = getSupabaseAdmin();
    const { error: uploadError } = await supabase.storage.from(bucket()).upload(storagePath, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
    });
    if (uploadError)
        return { ok: false, error: uploadError.message };
    const { error } = await supabase.from("customer_files").insert({
        customer_id: customerId,
        folder_id: folderId,
        name: file.name,
        storage_path: storagePath,
        size_bytes: file.size,
        mime_type: file.type || null,
    });
    if (error) {
        await supabase.storage.from(bucket()).remove([storagePath]);
        return { ok: false, error: error.message };
    }
    await supabase.from("customers").update({ updated_at: new Date().toISOString() }).eq("id", customerId);
    await writeFileAudit(customerId, "上传文件", file.name);
    refreshFileViews(customerId);
    return { ok: true };
}
export async function renameFileNodeAction(input: {
    customerId: string;
    kind: "file" | "folder";
    id: string;
    name: string;
}): Promise<ActionResult> {
    const missing = unavailable();
    if (missing)
        return missing;
    if (!input.name.trim())
        return { ok: false, error: "名称不能为空" };
    const table = input.kind === "file" ? "customer_files" : "customer_folders";
    const { error } = await getSupabaseAdmin()
        .from(table)
        .update({ name: input.name.trim() })
        .eq("id", input.id)
        .eq("customer_id", input.customerId);
    if (error)
        return { ok: false, error: error.message };
    await writeFileAudit(input.customerId, input.kind === "file" ? "文件重命名" : "文件夹重命名", input.name.trim());
    refreshFileViews(input.customerId);
    return { ok: true };
}
export async function updateFolderStatusAction(input: {
    customerId: string;
    folderId: string;
    status: FolderStatus;
    confirmPendingReview?: boolean;
}): Promise<ActionResult> {
    const missing = unavailable();
    if (missing)
        return missing;
    if (!FOLDER_STATUSES.includes(input.status)) {
        return { ok: false, error: "不支持的文件夹状态" };
    }
    if (!(await folderUsesWorkflowStatus(input.customerId, input.folderId))) {
        return { ok: false, error: "该文件夹不使用发送状态" };
    }
    const { error } = await getSupabaseAdmin().rpc("update_customer_folder_status", {
        p_customer_id: input.customerId,
        p_folder_id: input.folderId,
        p_new_status: input.status,
        p_confirm_pending_review: input.confirmPendingReview ?? false,
    });
    if (error)
        return { ok: false, error: error.message };
    await writeFileAudit(input.customerId, "文件夹发送状态", input.status);
    refreshFileViews(input.customerId);
    return { ok: true };
}
export async function updateFolderReviewStatusAction(input: {
    customerId: string;
    folderId: string;
    status: FolderReviewStatus;
}): Promise<ActionResult> {
    const missing = unavailable();
    if (missing)
        return missing;
    if (!FOLDER_REVIEW_STATUSES.includes(input.status)) {
        return { ok: false, error: "不支持的文件夹审核状态" };
    }
    if (!(await folderUsesWorkflowStatus(input.customerId, input.folderId))) {
        return { ok: false, error: "该文件夹不使用审核状态" };
    }
    const { error } = await getSupabaseAdmin().rpc("update_customer_folder_review_status", {
        p_customer_id: input.customerId,
        p_folder_id: input.folderId,
        p_new_status: input.status,
    });
    if (error)
        return { ok: false, error: error.message };
    await writeFileAudit(input.customerId, "文件夹审核状态", input.status);
    refreshFileViews(input.customerId);
    return { ok: true };
}
export async function moveFileNodeAction(input: {
    customerId: string;
    kind: "file" | "folder";
    id: string;
    targetFolderId: string | null;
}): Promise<ActionResult> {
    const missing = unavailable();
    if (missing)
        return missing;
    if (input.kind === "folder" && input.id === input.targetFolderId) {
        return { ok: false, error: "文件夹不能移动到自身" };
    }
    if (input.targetFolderId && !(await folderBelongsToCustomer(input.customerId, input.targetFolderId))) {
        return { ok: false, error: "目标文件夹不存在或不属于当前客户" };
    }
    if (input.kind === "folder" && input.targetFolderId) {
        const supabase = getSupabaseAdmin();
        let ancestorId: string | null = input.targetFolderId;
        while (ancestorId) {
            if (ancestorId === input.id)
                return { ok: false, error: "文件夹不能移动到自己的子文件夹中" };
            const folderResult: {
                data: {
                    parent_id: string | null;
                } | null;
                error: {
                    message: string;
                } | null;
            } = await supabase
                .from("customer_folders")
                .select("parent_id")
                .eq("id", ancestorId)
                .eq("customer_id", input.customerId)
                .maybeSingle();
            if (folderResult.error)
                return { ok: false, error: folderResult.error.message };
            ancestorId = folderResult.data?.parent_id ?? null;
        }
    }
    const table = input.kind === "file" ? "customer_files" : "customer_folders";
    const field = input.kind === "file" ? "folder_id" : "parent_id";
    const { error } = await getSupabaseAdmin()
        .from(table)
        .update({ [field]: input.targetFolderId })
        .eq("id", input.id)
        .eq("customer_id", input.customerId);
    if (error)
        return { ok: false, error: error.message };
    await writeFileAudit(input.customerId, input.kind === "file" ? "移动文件" : "移动文件夹", input.targetFolderId ?? "根目录");
    refreshFileViews(input.customerId);
    return { ok: true };
}
export async function deleteFileNodeAction(input: {
    customerId: string;
    kind: "file" | "folder";
    id: string;
}): Promise<ActionResult> {
    const missing = unavailable();
    if (missing)
        return missing;
    const supabase = getSupabaseAdmin();
    if (input.kind === "file") {
        const { data } = await supabase
            .from("customer_files")
            .select("storage_path")
            .eq("id", input.id)
            .eq("customer_id", input.customerId)
            .single();
        if (data?.storage_path) {
            const { error: storageError } = await supabase.storage.from(bucket()).remove([data.storage_path]);
            if (storageError)
                return { ok: false, error: storageError.message };
        }
        const { error } = await supabase
            .from("customer_files")
            .delete()
            .eq("id", input.id)
            .eq("customer_id", input.customerId);
        if (error)
            return { ok: false, error: error.message };
    }
    else {
        const { count } = await supabase
            .from("customer_folders")
            .select("id", { count: "exact", head: true })
            .eq("parent_id", input.id)
            .eq("customer_id", input.customerId);
        const { count: fileCount } = await supabase
            .from("customer_files")
            .select("id", { count: "exact", head: true })
            .eq("folder_id", input.id)
            .eq("customer_id", input.customerId);
        if ((count ?? 0) > 0 || (fileCount ?? 0) > 0) {
            return { ok: false, error: "文件夹非空，请先移动或删除其中内容" };
        }
        const { error } = await supabase
            .from("customer_folders")
            .delete()
            .eq("id", input.id)
            .eq("customer_id", input.customerId);
        if (error)
            return { ok: false, error: error.message };
    }
    await supabase.from("customers").update({ updated_at: new Date().toISOString() }).eq("id", input.customerId);
    await writeFileAudit(input.customerId, input.kind === "file" ? "删除文件" : "删除文件夹", "已删除");
    refreshFileViews(input.customerId);
    return { ok: true };
}
