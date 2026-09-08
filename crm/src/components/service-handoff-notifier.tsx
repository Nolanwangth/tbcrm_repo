"use client";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
export function ServiceHandoffNotifier({ enabled }: {
    enabled: boolean;
}) {
    const seen = useRef(new Set<string>());
    useEffect(() => {
        if (!enabled)
            return;
        let active = true;
        const check = async () => {
            const response = await fetch("/api/service-handoffs", { cache: "no-store" });
            if (!active || !response.ok)
                return;
            const payload = await response.json() as {
                handoffs?: Array<{
                    id: string;
                    customerId: string;
                    customerName?: string;
                }>;
            };
            for (const handoff of payload.handoffs ?? []) {
                if (seen.current.has(handoff.id))
                    continue;
                seen.current.add(handoff.id);
                toast.warning(`请接手：${handoff.customerName ?? "客户"}的行程与报价均已出`, {
                    duration: Infinity,
                    action: { label: "查看客户", onClick: async () => { await fetch("/api/service-handoffs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: handoff.id }) }); window.location.assign(`/customers/${handoff.customerId}`); } },
                });
            }
        };
        void check();
        const timer = window.setInterval(check, 30000);
        return () => { active = false; window.clearInterval(timer); };
    }, [enabled]);
    return null;
}
