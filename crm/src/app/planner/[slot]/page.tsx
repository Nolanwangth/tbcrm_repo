import { notFound } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { ServiceWorkbenchView } from "@/components/service-workbench";
import { SERVICE_WORKBENCHES } from "@/lib/constants";
import { getCustomers } from "@/lib/repositories/customers";
import { getCurrentUser } from "@/lib/auth";
import { getServiceWorkbenchForUser, resolveServiceWorkbench } from "@/lib/repositories/service-assignments";
import type { ServiceWorkbench } from "@/lib/types";
type PlannerSeatScope = ServiceWorkbench | "unassigned";
export default async function PlannerSeatPage({ params }: {
    params: Promise<{
        slot: string;
    }>;
}) {
    const { slot: rawSlot } = await params;
    const normalized = rawSlot.toLowerCase() === "unassigned" ? "unassigned" : rawSlot.toUpperCase();
    if (normalized !== "unassigned" && !SERVICE_WORKBENCHES.includes(normalized as ServiceWorkbench))
        notFound();
    const slot = normalized as PlannerSeatScope;
    const [user, { customers }] = await Promise.all([getCurrentUser(), getCustomers({ summary: true, workbench: slot, status: "跟进中" })]);
    const [ownWorkbench, seat] = await Promise.all([
        user ? getServiceWorkbenchForUser(user.id) : Promise.resolve(null),
        slot === "unassigned" ? Promise.resolve(null) : resolveServiceWorkbench(slot),
    ]);
    const isOwnWorkbench = ownWorkbench === slot;
    const isUnassigned = slot === "unassigned";
    return <>
    <PageHeading title={isUnassigned ? "规划师待人工分配" : `规划师${slot}工作台`} description={isUnassigned ? "查看尚未归属规划师的客户，并人工分配到 A-E。" : `${seat?.displayName ?? "尚未绑定账号"}负责的客户清单。客户优先级与最近跟进信息仅用于业务排序，不产生额外提醒。`} actions={isOwnWorkbench ? <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">我的规划师工作台</span> : undefined}/>
    <ServiceWorkbenchView customers={customers} workbench={slot}/>
  </>;
}
