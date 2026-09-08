"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { getPendingServiceAlertsAction } from "@/app/actions/service-history-actions";
export function ServiceAlertBanner() {
    const [summary, setSummary] = useState<{
        count: number;
        caseId: string | null;
    }>({ count: 0, caseId: null });
    useEffect(() => { let live = true; async function check() { if (document.hidden)
        return; try {
        const result = await getPendingServiceAlertsAction();
        if (live && result.ok)
            setSummary(result);
    }
    catch { } } void check(); const timer = setInterval(() => void check(), 15000); window.addEventListener('focus', check); return () => { live = false; clearInterval(timer); window.removeEventListener('focus', check); }; }, []);
    if (!summary.count || !summary.caseId)
        return null;
    return <aside role="alert" className="border-b border-amber-300 bg-amber-50 text-amber-950"><div className="mx-auto flex max-w-[1920px] flex-wrap items-center gap-3 px-4 py-3 text-sm lg:px-8"><AlertTriangle className="size-5 shrink-0"/><strong>行程中服务清单有 {summary.count} 条变更尚未双确认</strong><span>需要规划师与计调分别核对。</span><Link className="ml-auto rounded-md border border-amber-400 bg-white px-3 py-1.5 font-medium" href={`/operations/${summary.caseId}#service-change-history`}>查看并确认</Link></div></aside>;
}
