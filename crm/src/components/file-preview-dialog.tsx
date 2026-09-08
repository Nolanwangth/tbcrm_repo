"use client";
import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
export function FilePreviewDialog({ id, name, mime, children, className }: {
    id: string;
    name: string;
    mime: string;
    children: ReactNode;
    className?: string;
}) {
    const [failed, setFailed] = useState(false);
    const src = `/api/files/${id}/download?inline=1`, isImage = /^image\/(png|jpeg|webp|gif)$/.test(mime);
    return <Dialog><DialogTrigger asChild><button type="button" className={className} aria-label={`预览${name}`}>{children}</button></DialogTrigger><DialogContent className="flex w-[calc(100vw-2rem)] flex-col sm:max-w-5xl"><DialogHeader><DialogTitle className="break-all pr-6">{name}</DialogTitle><DialogDescription>私有附件，仅限登录账号查看。原件不会因预览被修改。</DialogDescription></DialogHeader><div className="min-h-40 overflow-auto rounded-lg border bg-muted p-2">{failed ? <p role="alert" className="p-6 text-sm">预览加载失败。请下载原件或重新登录后重试。</p> : isImage ? <img src={src} alt={name} onError={() => setFailed(true)} className="mx-auto max-h-[65dvh] w-auto object-contain"/> : mime === 'application/pdf' ? <iframe title={name} src={`${src}#view=FitH&navpanes=0`} className="h-[65dvh] w-full bg-white" onError={() => setFailed(true)}/> : <p className="p-6 text-sm">此文件格式请下载后使用 Word / WPS 打开。</p>}</div><a className="self-start rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted" href={`/api/files/${id}/download`}>下载原件</a></DialogContent></Dialog>;
}
