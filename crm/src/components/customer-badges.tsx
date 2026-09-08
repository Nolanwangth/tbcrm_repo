import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BusinessStage, CommunicationStatus, CustomerStatus, FolderReviewStatus, FolderStatus, ItineraryStatus, Level, Priority, QuotationStatus, WhatsappStatus, } from "@/lib/types";
const levelStyle: Record<Level, string> = {
    S: "border-rose-200/80 bg-rose-50 text-rose-700",
    A: "border-amber-200/80 bg-amber-50 text-amber-800",
    B: "border-blue-200/80 bg-blue-50 text-blue-700",
    C: "border-slate-200 bg-slate-100 text-slate-600",
};
const priorityStyle: Record<Priority, string> = {
    "需立即处理": "border-red-300 bg-red-50 text-red-800",
    紧急: "border-red-200/80 bg-red-50 text-red-700",
    高: "border-orange-200/80 bg-orange-50 text-orange-700",
    中: "border-amber-200/80 bg-amber-50 text-amber-800",
    低: "border-emerald-200/80 bg-emerald-50 text-emerald-700",
};
const communicationStyle: Record<CommunicationStatus, string> = {
    待首次跟进: "border-violet-200/80 bg-violet-50 text-violet-700",
    "客户已回复，待我方处理": "border-emerald-200/80 bg-emerald-50 text-emerald-700",
    "我方已回复，等待客户": "border-blue-200/80 bg-blue-50 text-blue-700",
    客户未读: "border-slate-200 bg-slate-100 text-slate-600",
    客户已读未回: "border-orange-200/80 bg-orange-50 text-orange-700",
    客户暂缓决定: "border-zinc-200 bg-zinc-100 text-zinc-600",
};
const statusStyle: Record<string, string> = {
    跟进中: "border-blue-200/80 bg-blue-50 text-blue-700",
    已成交: "border-emerald-200/80 bg-emerald-50 text-emerald-700",
    已关闭: "border-slate-200 bg-slate-100 text-slate-600",
    沟通中: "border-sky-200/80 bg-sky-50 text-sky-700",
    制作中: "border-indigo-200/80 bg-indigo-50 text-indigo-700",
    暂不需要: "border-slate-200 bg-slate-100 text-slate-600",
    未出行程: "border-amber-200/80 bg-amber-50 text-amber-800",
    已出行程: "border-emerald-200/80 bg-emerald-50 text-emerald-700",
    行程待修改: "border-orange-200/80 bg-orange-50 text-orange-700",
    未出报价: "border-amber-200/80 bg-amber-50 text-amber-800",
    已出报价: "border-emerald-200/80 bg-emerald-50 text-emerald-700",
    报价待修改: "border-orange-200/80 bg-orange-50 text-orange-700",
    待发送: "border-amber-200/80 bg-amber-50 text-amber-800",
    已发送: "border-blue-200/80 bg-blue-50 text-blue-700",
    需修改: "border-orange-200/80 bg-orange-50 text-orange-700",
    最终版: "border-emerald-200/80 bg-emerald-50 text-emerald-700",
    未添加: "border-amber-200/80 bg-amber-50 text-amber-800",
    已添加: "border-emerald-200/80 bg-emerald-50 text-emerald-700",
    待审核: "border-violet-200/80 bg-violet-50 text-violet-700",
    已审核: "border-teal-200/80 bg-teal-50 text-teal-700",
};
const dotStyle: Record<string, string> = {
    跟进中: "bg-blue-500",
    已成交: "bg-emerald-500",
    已关闭: "bg-slate-400",
    沟通中: "bg-sky-500",
    制作中: "bg-indigo-500",
    暂不需要: "bg-slate-400",
    未出行程: "bg-amber-500",
    已出行程: "bg-emerald-500",
    行程待修改: "bg-orange-500",
    未出报价: "bg-amber-500",
    已出报价: "bg-emerald-500",
    报价待修改: "bg-orange-500",
    待发送: "bg-amber-500",
    已发送: "bg-blue-500",
    需修改: "bg-orange-500",
    最终版: "bg-emerald-500",
    未添加: "bg-amber-500",
    已添加: "bg-emerald-500",
    待审核: "bg-violet-500",
    已审核: "bg-teal-500",
};
export function FolderStatusBadge({ status }: {
    status: FolderStatus;
}) {
    return (<Badge className={cn("border", statusStyle[status])}>
      <span className={cn("size-1.5 rounded-full", dotStyle[status])}/>
      {status}
    </Badge>);
}
export function FolderReviewStatusBadge({ status }: {
    status: FolderReviewStatus;
}) {
    return (<Badge className={cn("border", statusStyle[status])}>
      <span className={cn("size-1.5 rounded-full", dotStyle[status])}/>
      {status}
    </Badge>);
}
export function LevelBadge({ level }: {
    level: Level;
}) {
    return (<Badge className={cn("min-w-7 justify-center rounded-md border font-mono font-semibold", levelStyle[level])}>
      {level}
    </Badge>);
}
export function PriorityBadge({ priority }: {
    priority: Priority;
}) {
    return (<Badge className={cn("border", priorityStyle[priority])}>
      <span className={cn("size-1.5 rounded-full", priority === "需立即处理" || priority === "紧急" ? "bg-red-500" : priority === "高" ? "bg-orange-500" : priority === "中" ? "bg-amber-500" : "bg-emerald-500")}/>
      {priority}
    </Badge>);
}
export function CommunicationBadge({ status }: {
    status: CommunicationStatus;
}) {
    return (<Badge className={cn("max-w-[180px] truncate border", communicationStyle[status])}>
      {status}
    </Badge>);
}
export function StatusBadge({ status, className, }: {
    status: CustomerStatus | BusinessStage | ItineraryStatus | QuotationStatus | WhatsappStatus;
    className?: string;
}) {
    return (<Badge className={cn("border", statusStyle[status] ?? "border-slate-200 bg-slate-100 text-slate-600", className)}>
      <span className={cn("size-1.5 rounded-full", dotStyle[status] ?? "bg-slate-400")}/>
      {status}
    </Badge>);
}
