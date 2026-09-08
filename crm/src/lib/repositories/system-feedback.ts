import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { CollaborationMessage } from "@/lib/types";
export async function getSystemFeedbackMessages(): Promise<CollaborationMessage[]> {
    const { data, error } = await getSupabaseAdmin()
        .from("system_feedback_messages")
        .select("id,parent_message_id,author_id,author_name,body,created_at,updated_at")
        .order("created_at", { ascending: false });
    if (error)
        throw new Error(`系统反馈读取失败：${error.message}`);
    return (data ?? []).map((message) => ({
        id: String(message.id),
        parentMessageId: message.parent_message_id ? String(message.parent_message_id) : null,
        authorId: message.author_id ? String(message.author_id) : null,
        authorName: String(message.author_name),
        body: String(message.body),
        createdAt: String(message.created_at),
        updatedAt: String(message.updated_at),
    }));
}
