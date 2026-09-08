import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
export function EmptyState({ icon: Icon, title, description, action, className, }: {
    icon: LucideIcon;
    title: string;
    description?: string;
    action?: ReactNode;
    className?: string;
}) {
    return (<div className={cn("crm-empty", className)}>
      <div className="max-w-sm">
        <span className="mx-auto grid size-10 place-items-center rounded-lg bg-white text-slate-400 shadow-sm ring-1 ring-slate-200/80">
          <Icon className="size-5" strokeWidth={1.7}/>
        </span>
        <p className="mt-3 text-[13px] font-semibold text-slate-800">{title}</p>
        {description && <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>);
}
