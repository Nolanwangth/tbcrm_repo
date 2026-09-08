import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { defaultSettings } from "@/quote-v2/data/seed";
import type { QuoteV2Bootstrap, QuoteV2Customer, QuoteV2Record, QuoteV2Snapshot } from "@/lib/quote-v2";
export async function getQuoteV2Bootstrap(customer: QuoteV2Customer, toolType: string, selected: {
    versionId?: string;
    draftId?: string;
} = {}): Promise<QuoteV2Bootstrap> {
    const db = getSupabaseAdmin();
    const [catalog, groups, proposals] = await Promise.all([
        db.from("crm_quote_v2_catalog").select("key,payload,revision"),
        db.from("crm_quote_v2_groups").select("*").eq("customer_id", customer.id).order("sort_order").order("created_at"),
        db.from("customer_proposals").select("id,title,status,editor_schema,group_id:editor_snapshot->>groupId,edit_revision,updated_at,customer_proposal_versions!customer_proposal_versions_proposal_id_fkey(id,version_number,version_note,schema_version:snapshot->>schemaVersion,group_id:snapshot->>groupId,published_at,crm_proposal_pdf_artifacts(version_id))").eq("customer_id", customer.id).eq("tool_type", toolType).order("updated_at", { ascending: false }),
    ]);
    const error = catalog.error || groups.error || proposals.error;
    if (error)
        throw new Error(error.message);
    const value = (key: string) => catalog.data?.find(c => c.key === key)?.payload;
    const drafts: QuoteV2Record[] = [];
    const versions: QuoteV2Record[] = [];
    for (const p of proposals.data ?? []) {
        if (p.editor_schema === 2 && p.status === "draft")
            drafts.push({ id: p.id, proposalId: p.id, title: p.title, revision: p.edit_revision, schemaVersion: 2, groupId: p.group_id, createdAt: p.updated_at });
        for (const v of p.customer_proposal_versions ?? [])
            versions.push({ id: v.id, proposalId: p.id, title: p.title, revision: p.edit_revision, versionNumber: v.version_number, note: v.version_note, originalPdf: Array.isArray(v.crm_proposal_pdf_artifacts) ? v.crm_proposal_pdf_artifacts.length > 0 : Boolean(v.crm_proposal_pdf_artifacts), schemaVersion: Number(v.schema_version), groupId: v.group_id, createdAt: v.published_at });
    }
    const active = selected.versionId ? versions.find(v => v.id === selected.versionId) : selected.draftId
        ? drafts.find(d => d.id === selected.draftId) ?? versions.filter(v => v.proposalId === selected.draftId).sort((a, b) => (b.versionNumber ?? 0) - (a.versionNumber ?? 0))[0]
        : drafts[0];
    if ((selected.versionId || selected.draftId) && !active)
        throw new Error("方案不属于当前客户或工具，或已不存在");
    if (active) {
        const result = active.versionNumber
            ? await db.from("customer_proposal_versions").select("snapshot").eq("id", active.id).eq("proposal_id", active.proposalId).single()
            : await db.from("customer_proposals").select("snapshot:editor_snapshot").eq("id", active.id).eq("customer_id", customer.id).eq("tool_type", toolType).eq("status", "draft").single();
        if (result.error)
            throw new Error(result.error.message);
        active.snapshot = result.data.snapshot as QuoteV2Snapshot;
    }
    return { customer, drafts, versions: versions.sort((a, b) => b.createdAt.localeCompare(a.createdAt)), groups: (groups.data ?? []).map(g => ({ id: g.id, name: g.name, sortOrder: g.sort_order, createdAt: g.created_at, updatedAt: g.updated_at })), catalog: { products: value("products") ?? [], templates: value("templates") ?? [], settings: value("settings") ?? defaultSettings }, catalogRevisions: Object.fromEntries((catalog.data ?? []).map(c => [c.key, c.revision])) };
}
