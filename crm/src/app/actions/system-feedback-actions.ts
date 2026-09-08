"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import type { ActionResult } from "@/app/actions/customer-actions";
const feedbackSchema = z.object({
    body: z.string().trim().min(1, "反馈内容不能为空").max(5000, "反馈内容不能超过5000字"),
    messageId: z.string().uuid().optional(),
    parentMessageId: z.string().uuid().optional(),
});
export async function saveSystemFeedbackAction(input: z.input<typeof feedbackSchema>): Promise<ActionResult> {
    if (!isSupabaseConfigured())
        return { ok: false, error: "Supabase 尚未配置，无法保存系统反馈。" };
    const parsed = feedbackSchema.safeParse(input);
    if (!parsed.success)
        return { ok: false, error: parsed.error.issues[0]?.message ?? "反馈内容有误" };
    const user = await getCurrentUser();
    if (!user)
        return { ok: false, error: "请先登录后再发表反馈。" };
    const supabase = getSupabaseAdmin();
    if (parsed.data.messageId) {
        const { data, error } = await supabase
            .from("system_feedback_messages")
            .update({ body: parsed.data.body })
            .eq("id", parsed.data.messageId)
            .eq("author_id", user.id)
            .select("id")
            .maybeSingle();
        if (error)
            return { ok: false, error: error.message };
        if (!data)
            return { ok: false, error: "只能修改自己发表的反馈" };
    }
    else {
        const { error } = await supabase.from("system_feedback_messages").insert({
            parent_message_id: parsed.data.parentMessageId ?? null,
            author_id: user.id,
            author_name: user.displayName,
            body: parsed.data.body,
        });
        if (error)
            return { ok: false, error: error.message };
    }
    revalidatePath("/feedback");
    return { ok: true };
}
