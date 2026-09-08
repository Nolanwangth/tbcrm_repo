import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
export function SectionCard({ title, description, actions, children, className, contentClassName, }: {
    title?: string;
    description?: string;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
    contentClassName?: string;
}) {
    return (<section className={cn("crm-panel overflow-hidden", className)}>
      {(title || description || actions) && (<header className="crm-section-header">
          <div className="min-w-0">
            {title && <h2 className="crm-section-title">{title}</h2>}
            {description && <p className="crm-section-description">{description}</p>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </header>)}
      <div className={contentClassName}>{children}</div>
    </section>);
}
