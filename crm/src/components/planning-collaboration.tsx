"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { saveCollaborationMessageAction } from "@/app/actions/collaboration-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Customer } from "@/lib/types";
import { buildCollaborationThreads } from "@/lib/collaboration-threads";
type Message = Customer["collaborationMessages"][number];
function excerpt(value: string) {
    return `${value.slice(0, 48)}${value.length > 48 ? "…" : ""}`;
}
export function PlanningCollaboration({ customer, topic, currentUserId }: {
    customer: Customer;
    topic: "itinerary" | "quotation";
    currentUserId: string | null;
}) {
    const router = useRouter();
    const [body, setBody] = useState("");
    const [replyTo, setReplyTo] = useState<string>();
    const [editing, setEditing] = useState<string>();
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [pending, startTransition] = useTransition();
    const messages = customer.collaborationMessages.filter((message) => message.topic === topic);
    const byId = new Map(messages.map((message) => [message.id, message]));
    const threads = buildCollaborationThreads(messages);
    const rootFor = (messageId?: string) => threads.find((thread) => thread.root.id === messageId || thread.replies.some((reply) => reply.id === messageId))?.root.id;
    const cancel = () => { setBody(""); setReplyTo(undefined); setEditing(undefined); };
    const openReply = (message: Message) => {
        setEditing(undefined);
        setReplyTo(message.id);
        setBody("");
        const rootId = rootFor(message.id);
        if (rootId)
            setExpanded((current) => new Set(current).add(rootId));
    };
    const openEdit = (message: Message) => { setReplyTo(undefined); setEditing(message.id); setBody(message.body); };
    const submit = () => {
        if (!body.trim())
            return;
        const threadToExpand = rootFor(replyTo || editing);
        startTransition(async () => {
            const result = await saveCollaborationMessageAction({ customerId: customer.id, topic, body, messageId: editing, parentMessageId: editing ? undefined : replyTo });
            if (!result.ok) {
                toast.error(result.error);
                return;
            }
            if (threadToExpand)
                setExpanded((current) => new Set(current).add(threadToExpand));
            toast.success(editing ? "留言已修改" : replyTo ? "回复已发布" : "留言已发布");
            cancel();
            router.refresh();
        });
    };
    const composer = (targetId?: string) => {
        const active = targetId ? replyTo === targetId || editing === targetId : !replyTo && !editing;
        if (!active)
            return null;
        const target = targetId ? byId.get(targetId) : undefined;
        return <div className="mt-2 rounded-md border border-blue-100 bg-blue-50/50 p-2">
      {replyTo && target && <p className="mb-1 text-[10px] text-blue-700">回复 @{target.authorName}：{excerpt(target.body)}</p>}
      <Textarea className="min-h-16 bg-white text-xs" value={body} onChange={(event) => setBody(event.target.value)} placeholder={`填写${topic === "itinerary" ? "行程" : "报价"}留言，支持回车换行`}/>
      <div className="mt-2 flex justify-end gap-2">{targetId && <Button type="button" variant="outline" size="sm" onClick={cancel}>取消</Button>}<Button type="button" size="sm" disabled={!body.trim() || pending} onClick={submit}>{editing ? "保存修改" : replyTo ? "发布回复" : "发布留言"}</Button></div>
    </div>;
    };
    const messageCard = (message: Message, isReply = false) => {
        const parent = message.parentMessageId ? byId.get(message.parentMessageId) : undefined;
        return <div key={message.id} className={isReply ? "ml-4" : ""}>
      <article className="rounded-md border border-slate-200 bg-white p-2.5 text-xs">
        {isReply && parent && <p className="mb-1 rounded bg-slate-50 px-2 py-1 text-[10px] text-slate-500">回复 @{parent.authorName}：{excerpt(parent.body)}</p>}
        <div className="flex items-center gap-2"><span className="font-medium">{message.authorName}</span><span className="text-[10px] text-slate-400">{new Date(message.updatedAt).toLocaleString("zh-CN", { hour12: false })}</span><Button type="button" variant="link" size="sm" className="ml-auto h-5 p-0 text-[10px]" onClick={() => openReply(message)}>回复</Button>{message.authorId === currentUserId && <Button type="button" variant="link" size="sm" className="h-5 p-0 text-[10px]" onClick={() => openEdit(message)}>编辑</Button>}</div>
        <p className="mt-1 whitespace-pre-wrap leading-5">{message.body}</p>
      </article>
      {composer(message.id)}
    </div>;
    };
    return <div className="mt-3 rounded-lg border border-slate-200/70 bg-slate-50/50 p-3">
    <p className="mb-2 text-[11px] font-medium text-slate-600">{topic === "itinerary" ? "行程留言" : "报价留言"}</p>
    <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
      {threads.length ? threads.map((thread) => <section key={thread.root.id} className="space-y-2">
        {messageCard(thread.root)}
        {thread.replies.length > 0 && <Button type="button" variant="ghost" size="sm" className="ml-2 h-6 text-[10px] text-blue-600" onClick={() => setExpanded((current) => { const next = new Set(current); if (next.has(thread.root.id))
            next.delete(thread.root.id);
        else
            next.add(thread.root.id); return next; })}>{expanded.has(thread.root.id) ? "收起回复" : `查看 ${thread.replies.length} 条回复`}</Button>}
        {expanded.has(thread.root.id) && <div className="space-y-2 border-l-2 border-blue-100 pl-2">{thread.replies.map((reply) => messageCard(reply, true))}</div>}
      </section>) : <p className="py-3 text-center text-[11px] text-slate-400">暂无{topic === "itinerary" ? "行程" : "报价"}留言</p>}
    </div>
    {composer()}
  </div>;
}
