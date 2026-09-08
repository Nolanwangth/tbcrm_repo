import * as React from "react";
import { cn } from "@/lib/utils";
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
    return (<textarea data-slot="textarea" className={cn("flex field-sizing-content min-h-20 w-full rounded-lg border border-input bg-white px-3 py-2.5 text-base leading-6 shadow-[0_1px_2px_rgba(15,23,42,0.025)] transition-[border-color,box-shadow,background-color] outline-none placeholder:text-slate-400 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15 md:text-[13px] dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40", className)} {...props}/>);
}
export { Textarea };
