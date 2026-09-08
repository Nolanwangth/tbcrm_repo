"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "@/components/customer-badges";
import { serviceWorkbenchCustomers } from "@/lib/service-workbench";
import type { Customer, ServiceWorkbench } from "@/lib/types";
type PlannerSeatScope = ServiceWorkbench | "unassigned";
function dateTime(value?: string | null) {
    if (!value)
        return "—";
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
export function ServiceWorkbenchView({ customers, workbench }: {
    customers: Customer[];
    workbench: PlannerSeatScope;
}) {
    const [query, setQuery] = useState("");
    const [priorityFilter, setPriorityFilter] = useState("");
    const assigned = useMemo(() => workbench === "unassigned"
        ? customers.filter((customer) => !customer.serviceWorkbench)
        : serviceWorkbenchCustomers(customers, workbench), [customers, workbench]);
    const rows = useMemo(() => assigned.filter(c => (!query || `${c.name} ${c.nationality ?? ""} ${c.travelNeed.destinations ?? ""}`.toLowerCase().includes(query.toLowerCase())) && (!priorityFilter || c.priority === priorityFilter)).sort((a, b) => {
        const priority: Record<Customer["priority"], number> = { 需立即处理: 0, 紧急: 1, 高: 2, 中: 3, 低: 4 };
        return (priority[a.priority] ?? 9) - (priority[b.priority] ?? 9) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }), [assigned, query, priorityFilter]);
    return (<section className="crm-panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/70 px-5 py-4">
        <div><h2 className="text-sm font-semibold text-slate-950">名下客户</h2><p className="mt-1 text-xs text-muted-foreground">共 {rows.length} 位，按优先级与最近更新时间排序</p></div><div className="flex flex-wrap gap-2"><Input aria-label="搜索名下客户" className="w-52" placeholder="姓名、国家或目的地" value={query} onChange={e => setQuery(e.target.value)}/><select aria-label="按优先级筛选" className="crm-native-select w-auto" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}><option value="">全部优先级</option>{["需立即处理", "紧急", "高", "中", "低"].map(v => <option key={v}>{v}</option>)}</select><Button asChild variant="outline"><Link href="/customers/new">新增客户</Link></Button></div>
      </div>
      <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr><th className="px-4 py-3">客户名称</th><th className="px-4 py-3">规划师归属</th><th className="px-4 py-3">优先级</th><th className="px-4 py-3">来源</th><th className="px-4 py-3">预计出行</th><th className="px-4 py-3">最近跟进</th><th className="px-4 py-3">最近更新</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((customer) => {
            return (<tr key={customer.id} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3"><Link href={`/customers/${customer.id}?returnTo=${encodeURIComponent(`/planner/${workbench}`)}`} className="font-semibold text-slate-950 hover:text-primary hover:underline">{customer.name}</Link></td>
                        <td className="px-4 py-3">{customer.serviceWorkbench ? `规划师 ${customer.serviceWorkbench}` : <span className="text-amber-700">待分配</span>}</td>
                        <td className="px-4 py-3"><PriorityBadge priority={customer.priority}/></td>
                        <td className="px-4 py-3">{customer.source}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{customer.travelNeed.expectedStartDate || "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{dateTime(customer.latestFollowUpAt)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{dateTime(customer.updatedAt)}</td>
                      </tr>);
        })}

                </tbody>
              </table>
      </div>
      {!rows.length && <div className="px-5 py-10 text-sm text-muted-foreground">{assigned.length ? "没有符合筛选条件的客户" : "当前席位没有跟进中的客户。可从客户总池分配，或新增客户时选择专属规划师。"}<Link href="/customers" className="mt-3 block text-primary underline">打开客户总池</Link></div>}
    </section>);
}
