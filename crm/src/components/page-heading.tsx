import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
export function PageHeading({ title, description, actions, eyebrow = "TRIPBOOK CRM", className, }: {
    title: string;
    description?: string;
    actions?: ReactNode;
    eyebrow?: string;
    className?: string;
}) {
    return (<div className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between 2xl:mb-8", className)}>
      <div className="min-w-0">
        <p className="crm-eyebrow">{eyebrow}</p>
        <h1 className="mt-2 text-[25px] font-semibold leading-8 tracking-[-0.035em] text-foreground 2xl:text-[29px] 2xl:leading-9">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>);
}
