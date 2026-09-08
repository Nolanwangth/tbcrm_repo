"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { validateQuoteV2, quoteV2CatalogSchemas, type QuoteV2Snapshot } from "@/lib/quote-v2";
import { calculateTotals } from "@/quote-v2/lib/logic";
import { parseItineraryDocument } from "@/quote-v2/lib/itineraryDocument";
export async function saveQuoteV2Action(input: {
    proposalId: string;
    revision: number;
    snapshot: QuoteV2Snapshot;
    publishRequest?: string;
    note?: string;
}) {
    const actor = await getCurrentUser();
    if (!actor)
        return { ok: false as const, error: "登录已失效，请重新登录" };
    if (!z.string().uuid().safeParse(input.proposalId).success || !Number.isInteger(input.revision) || input.revision < 0 || (input.publishRequest && !z.string().uuid().safeParse(input.publishRequest).success))
        return { ok: false as const, error: "方案请求无效" };
    const parsed = validateQuoteV2(input.snapshot);
    if (!parsed.snapshot)
        return { ok: false as const, error: parsed.error! };
    const snapshot = parsed.snapshot;
    if (input.publishRequest) {
        if (!snapshot.partyConfirmed)
            return { ok: false as const, error: "请先核对并确认成人、儿童、老人人数" };
        if (snapshot.toolType === "quotation" && !(snapshot.mode === "quick" ? snapshot.plan.items : snapshot.directQuote.items).length)
            return { ok: false as const, error: "正式报价至少需要一项服务" };
        if (snapshot.toolType === "itinerary") {
            try {
                parseItineraryDocument(snapshot.itinerary);
            }
            catch (error) {
                return { ok: false as const, error: error instanceof Error ? error.message : "行程格式无效" };
            }
        }
    }
    snapshot.totals = calculateTotals(snapshot.mode === "quick" ? snapshot.plan.items : snapshot.directQuote.items);
    const { data, error } = await getSupabaseAdmin().rpc("crm_save_quote_v2", { p_actor: actor.id, p_customer: snapshot.customerId, p_proposal: input.proposalId, p_revision: input.revision, p_snapshot: snapshot, p_publish_request: input.publishRequest ?? null, p_note: input.note?.slice(0, 2000) || null });
    if (error)
        return { ok: false as const, error: error.message };
    revalidatePath(`/customers/${snapshot.customerId}`);
    revalidatePath(`/planner/tools/${snapshot.toolType}`);
    return { ok: true as const, revision: Number(data.revision), versionId: data.versionId as string | null, versionNumber: data.versionNumber as number | null };
}
export async function saveQuoteV2CatalogAction(key: "products" | "templates" | "settings", revision: number, payload: unknown) {
    const actor = await getCurrentUser();
    if (!actor)
        return { ok: false as const, error: "登录状态已失效" };
    if (!["products", "templates", "settings"].includes(key) || JSON.stringify(payload).length > 20000000)
        return { ok: false as const, error: "共享资料无效或过大" };
    if (!Number.isInteger(revision) || revision < 0 || !quoteV2CatalogSchemas[key].safeParse(payload).success)
        return { ok: false as const, error: "共享资料格式无效，请检查价格、规格、模板及设置" };
    const { data, error } = await getSupabaseAdmin().rpc("crm_update_quote_v2_catalog", { p_actor: actor.id, p_key: key, p_revision: revision, p_payload: payload });
    if (error)
        return { ok: false as const, error: error.message };
    return { ok: true as const, revision: Number(data) };
}
export async function saveQuoteV2GroupAction(customerId: string, name: string, id?: string) {
    const actor = await getCurrentUser();
    if (!actor)
        return { ok: false as const, error: "登录状态已失效" };
    if (!z.string().uuid().safeParse(customerId).success || !name.trim() || name.length > 100)
        return { ok: false as const, error: "分组信息无效" };
    const db = getSupabaseAdmin();
    const { data, error } = await db.rpc("crm_save_quote_v2_group", { p_actor: actor.id, p_customer: customerId, p_name: name, p_id: id ?? null });
    if (error)
        return { ok: false as const, error: error.code === "23505" ? "该客户已存在同名分组" : error.message };
    return { ok: true as const, group: { id: String(data.id), name: String(data.name), sortOrder: Number(data.sort_order), createdAt: String(data.created_at), updatedAt: String(data.updated_at) } };
}
