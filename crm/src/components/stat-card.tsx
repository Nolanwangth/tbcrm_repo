import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
const toneStyles = {
    blue: {
        icon: "bg-blue-50 text-blue-600 ring-blue-100",
        dot: "bg-blue-500",
    },
    emerald: {
        icon: "bg-emerald-50 text-emerald-600 ring-emerald-100",
        dot: "bg-emerald-500",
    },
    violet: {
        icon: "bg-violet-50 text-violet-600 ring-violet-100",
        dot: "bg-violet-500",
    },
    amber: {
        icon: "bg-amber-50 text-amber-700 ring-amber-100",
        dot: "bg-amber-500",
    },
    slate: {
        icon: "bg-slate-100 text-slate-600 ring-slate-200",
        dot: "bg-slate-400",
    },
};
export function StatCard({ label, value, hint, icon: Icon, tone = "blue", emphasis = false, className, }: {
    label: string;
    value: ReactNode;
    hint?: string;
    icon: LucideIcon;
    tone?: keyof typeof toneStyles;
    emphasis?: boolean;
    className?: string;
}) {
    const styles = toneStyles[tone];
    return (<article className={cn("group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.025),0_8px_28px_rgba(15,23,42,0.03)] transition-[border-color,box-shadow] duration-200 hover:border-slate-300/90 hover:shadow-[0_1px_2px_rgba(15,23,42,0.03),0_12px_34px_rgba(15,23,42,0.055)]", emphasis && "border-border bg-card", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="crm-label">{label}</p>
          <p className={cn("crm-metric mt-3 truncate text-[28px] font-semibold leading-none text-foreground", emphasis && "text-[31px]")}>
            {value}
          </p>
        </div>
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg ring-1", styles.icon)}>
          <Icon className="size-4.5" strokeWidth={1.8}/>
        </span>
      </div>
      <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
        <span className={cn("size-1.5 rounded-full", styles.dot)}/>
        <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">{hint ?? "当前所选时间范围"}</p>
      </div>
    </article>);
}
