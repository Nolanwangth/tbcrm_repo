"use server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import type { ProposalDraftInput } from "@/lib/proposals";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { ActionResult } from "@/app/actions/customer-actions";
import type { ProposalPricingUnit } from "@/lib/proposals";
type QuoteProductInput = {
    id?: string;
    city: string;
    category: string;
    nameZh: string;
    nameEn: string;
    costPrice: number;
    quotePrice: number;
    pricingUnit: ProposalPricingUnit;
    seatCount?: number | null;
};
export async function saveProposalAction(_input: ProposalDraftInput): Promise<ActionResult> {
    void _input;
    if (!await getCurrentUser())
        return { ok: false, error: "登录状态已失效" };
    return { ok: false, error: "旧版方案仅供查看与导出，请使用新版 2.0 创建草稿" };
}
export async function publishProposalAction(_input: ProposalDraftInput & {
    versionNote?: string;
}): Promise<ActionResult> {
    void _input;
    if (!await getCurrentUser())
        return { ok: false, error: "登录状态已失效" };
    return { ok: false, error: "旧版方案仅供查看与导出，请使用新版 2.0 创建草稿" };
}
export async function saveQuoteProductAction(input: QuoteProductInput): Promise<ActionResult> {
    const user = await getCurrentUser();
    if (!user)
        return { ok: false, error: "登录状态已失效" };
    if (!input.nameZh.trim() || !input.nameEn.trim())
        return { ok: false, error: "价格项目中英文名称不能为空" };
    if (input.costPrice < 0 || input.quotePrice < 0)
        return { ok: false, error: "成本和报价不能为负数" };
    const row = { city: input.city.trim() || "通用", category: input.category, name_zh: input.nameZh.trim(), name_en: input.nameEn.trim(), cost_price: input.costPrice, quote_price: input.quotePrice, pricing_unit: input.pricingUnit, seat_count: input.seatCount ?? null, enabled: true, created_by_user_id: user.id };
    const query = input.id
        ? getSupabaseAdmin().from("quote_products").update(row).eq("id", input.id).select("id").single()
        : getSupabaseAdmin().from("quote_products").insert(row).select("id").single();
    const { data, error } = await query;
    if (error || !data)
        return { ok: false, error: error?.message ?? "价格库保存失败" };
    revalidatePath("/planner/tools/quotation");
    return { ok: true, id: String(data.id) };
}
export async function deleteQuoteProductAction(id: string): Promise<ActionResult> {
    const user = await getCurrentUser();
    if (!user)
        return { ok: false, error: "登录状态已失效" };
    const { error } = await getSupabaseAdmin().from("quote_products").update({ enabled: false }).eq("id", id);
    if (error)
        return { ok: false, error: error.message };
    revalidatePath("/planner/tools/quotation");
    return { ok: true };
}
