"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: {
    reset: () => void;
}) { return <section role="alert" className="mx-auto my-10 max-w-xl rounded-xl border bg-card p-8"><h1 className="text-xl font-semibold">暂时无法读取业务资料</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">请确认本地数据库服务正在运行，再重新加载。若刚才提交了保存，请先核对操作历史，不要重复新建记录。</p><div className="mt-6 flex gap-3"><Button onClick={reset}>重新加载</Button><Button variant="outline" asChild><Link href="/dashboard">返回总览</Link></Button></div></section>; }
