"use server";
import { revalidatePath } from "next/cache";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import type { ActionResult } from "@/app/actions/customer-actions";
import { getCurrentUser } from "@/lib/auth";
export async function saveCollaborationMessageAction(input: {
    customerId: string;
    messageId?: string;
    parentMessageId?: string;
    topic?: "itinerary" | "quotation" | "general";
    body: string;
    authorName?: string;
}): Promise<ActionResult> {
    if (!isSupabaseConfigured())
        return { ok: false, error: "Supabase 尚未配置，无法保存交流内容。" };
    const user = await getCurrentUser();
    if (!user)
        return { ok: false, error: "请先登录后再发表交流。" };
    const body = input.body.trim();
    if (!body)
        return { ok: false, error: "交流内容不能为空" };
    const supabase = getSupabaseAdmin();
    const payload = { body, author_id: user.id, author_name: user.displayName, topic: input.topic || "general" };
    const result = input.messageId
        ? await supabase.from("customer_collaboration_messages").update({ body, topic: input.topic || "general" }).eq("id", input.messageId).eq("customer_id", input.customerId).eq("author_id", user.id)
        : await supabase.from("customer_collaboration_messages").insert({ customer_id: input.customerId, parent_message_id: input.parentMessageId || null, ...payload });
    if (result.error)
        return { ok: false, error: result.error.message };
    revalidatePath(`/customers/${input.customerId}`);
    revalidatePath("/planner");
    return { ok: true };
}
