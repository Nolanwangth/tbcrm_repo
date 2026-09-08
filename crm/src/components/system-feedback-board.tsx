"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareReply, MessagesSquare } from "lucide-react";
import { toast } from "sonner";
import { saveSystemFeedbackAction } from "@/app/actions/system-feedback-actions";
import { buildCollaborationThreads } from "@/lib/collaboration-threads";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CollaborationMessage } from "@/lib/types";
function excerpt(value: string) {
    return `${value.slice(0, 60)}${value.length > 60 ? "…" : ""}`;
}
function dateTime(value: string) {
    return new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(new Date(value));
}
export function SystemFeedbackBoard({ messages, currentUserId }: {
    messages: CollaborationMessage[];
    currentUserId: string;
}) {
    const router = useRouter();
    const [body, setBody] = useState("");
    const [replyTo, setReplyTo] = useState<string>();
    const [editing, setEditing] = useState<string>();
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [pending, startTransition] = useTransition();
    const byId = new Map(messages.map((message) => [message.id, message]));
    const threads = buildCollaborationThreads(messages);
    const rootFor = (messageId?: string) => threads.find((thread) => thread.root.id === messageId || thread.replies.some((reply) => reply.id === messageId))?.root.id;
    const cancel = () => { setBody(""); setReplyTo(undefined); setEditing(undefined); };
    const openReply = (message: CollaborationMessage) => {
        setEditing(undefined);
        setReplyTo(message.id);
        setBody("");
        const rootId = rootFor(message.id);
        if (rootId)
            setExpanded((current) => new Set(current).add(rootId));
    };
    const openEdit = (message: CollaborationMessage) => {
        setReplyTo(undefined);
        setEditing(message.id);
        setBody(message.body);
    };
    const submit = () => {
        if (!body.trim())
            return;
        const threadToExpand = rootFor(replyTo || editing);
        startTransition(async () => {
            const result = await saveSystemFeedbackAction({
                body,
                messageId: editing,
                parentMessageId: editing ? undefined : replyTo,
            });
            if (!result.ok) {
                toast.error(result.error);
                return;
            }
            if (threadToExpand)
                setExpanded((current) => new Set(current).add(threadToExpand));
            toast.success(editing ? "反馈已修改" : replyTo ? "回复已发布" : "反馈已发布");
            cancel();
            router.refresh();
        });
    };
    const composer = (targetId?: string) => {
        const active = targetId ? replyTo === targetId || editing === targetId : !replyTo && !editing;
        if (!active)
            return null;
        const target = targetId ? byId.get(targetId) : undefined;
        return (<div className={targetId ? "mt-2 rounded-lg border border-blue-100 bg-blue-50/60 p-3" : "border-b border-slate-200/70 bg-white p-4"}>
        {replyTo && target && <p className="mb-2 text-[11px] text-blue-700">回复 @{target.authorName}：{excerpt(target.body)}</p>}
        <Textarea className="min-h-24 resize-y bg-white text-sm" value={body} maxLength={5000} onChange={(event) => setBody(event.target.value)} placeholder={targetId ? "填写回复，回车用于换行" : "留下系统使用建议或问题，回车用于换行"}/>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-[10px] text-slate-400">{body.length}/5000</span>
          <div className="flex gap-2">
            {targetId && <Button type="button" variant="outline" size="sm" onClick={cancel}>取消</Button>}
            <Button type="button" size="sm" disabled={!body.trim() || pending} onClick={submit}>{editing ? "保存修改" : replyTo ? "发布回复" : "发布反馈"}</Button>
          </div>
        </div>
      </div>);
    };
    const messageCard = (message: CollaborationMessage, isReply = false) => {
        const parent = message.parentMessageId ? byId.get(message.parentMessageId) : undefined;
        const edited = message.updatedAt !== message.createdAt;
        return (<div key={message.id}>
        <article className="rounded-lg border border-slate-200 bg-white p-3.5 text-sm shadow-sm shadow-slate-950/[0.02]">
          {isReply && parent && <p className="mb-2 rounded-md bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-500">回复 @{parent.authorName}：{excerpt(parent.body)}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-900">{message.authorName}</span>
            <span className="text-[10px] text-slate-400">{dateTime(message.updatedAt)}{edited ? " · 已编辑" : ""}</span>
            <Button type="button" variant="link" size="sm" className="ml-auto h-6 p-0 text-[11px]" onClick={() => openReply(message)}>回复</Button>
            {message.authorId === currentUserId && <Button type="button" variant="link" size="sm" className="h-6 p-0 text-[11px]" onClick={() => openEdit(message)}>编辑</Button>}
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words leading-6 text-slate-700">{message.body}</p>
        </article>
        {composer(message.id)}
      </div>);
    };
    return (<section className="crm-panel overflow-hidden">
      {composer()}
      <div className="crm-scrollbar max-h-[calc(100vh-285px)] min-h-[430px] space-y-4 overflow-y-auto bg-slate-50/50 p-4">
        {threads.length ? threads.map((thread) => (<section key={thread.root.id} className="space-y-2">
            {messageCard(thread.root)}
            {thread.replies.length > 0 && (<Button type="button" variant="ghost" size="sm" className="ml-2 h-7 gap-1.5 text-[11px] text-blue-600" onClick={() => setExpanded((current) => { const next = new Set(current); if (next.has(thread.root.id))
                next.delete(thread.root.id);
            else
                next.add(thread.root.id); return next; })}>
                <MessageSquareReply className="size-3.5"/>{expanded.has(thread.root.id) ? "收起回复" : `查看 ${thread.replies.length} 条回复`}
              </Button>)}
            {expanded.has(thread.root.id) && <div className="space-y-2 border-l-2 border-blue-100 pl-3">{thread.replies.map((reply) => messageCard(reply, true))}</div>}
          </section>)) : (<div className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-slate-400">
            <MessagesSquare className="size-10 text-slate-300"/>
            <p className="font-medium text-slate-600">还没有系统反馈</p>
            <p className="text-xs">可以在上方发表第一条建议。</p>
          </div>)}
      </div>
    </section>);
}
