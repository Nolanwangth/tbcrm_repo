import "server-only";
import { connection } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
type Row = Record<string, unknown>;
export async function getCustomerArchive(customerId: string, caseId?: string | null) {
    await connection();
    const supabase = getSupabaseAdmin();
    const [documents, travelers, changes, proposals] = await Promise.all([
        supabase.from("customer_document_links").select("id,document_type,replaced_at,created_at,customer_files(id,name,mime_type,created_at),crm_users!customer_document_links_created_by_user_id_fkey(display_name)").eq("customer_id", customerId).order("created_at", { ascending: false }),
        caseId ? supabase.from("operation_travelers").select("*,customer_files!operation_travelers_passport_file_id_fkey(id,name,mime_type)").eq("case_id", caseId).order("sort_order") : Promise.resolve({ data: [], error: null }),
        Promise.resolve({ data: [] as Row[], error: null }),
        supabase.from("customer_proposals").select("id,title,tool_type,status,customer_proposal_versions!customer_proposal_versions_proposal_id_fkey(id,version_number,version_note,published_at)").eq("customer_id", customerId).order("updated_at", { ascending: false }),
    ]);
    const error = documents.error ?? travelers.error ?? changes.error ?? proposals.error;
    if (error)
        throw new Error(`读取客户档案失败：${error.message}`);
    return {
        documents: (documents.data ?? []) as Row[],
        travelers: (travelers.data ?? []) as Row[],
        changes: (changes.data ?? []) as Row[],
        proposals: (proposals.data ?? []) as Row[],
    };
}
