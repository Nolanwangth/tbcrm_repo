import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
export function FilterBar({ children, className, }: {
    children: ReactNode;
    className?: string;
}) {
    return (<div className={cn("rounded-xl border border-slate-200/80 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.025)]", className)}>
      {children}
    </div>);
}
