import { Badge } from "@/components/ui/badge";
import { BOOKING_STATUS_LABELS, OPERATION_PHASE_LABELS, SERVICE_LIST_STATUS_LABELS, type BookingStatus, type OperationPhase, type ServiceListStatus, } from "@/lib/operations";
import { cn } from "@/lib/utils";
const phaseStyles: Record<OperationPhase, string> = {
    processing: "border-amber-200 bg-amber-50 text-amber-800",
    waiting: "border-blue-200 bg-blue-50 text-blue-700",
    in_service: "border-emerald-200 bg-emerald-50 text-emerald-700",
    completed: "border-slate-200 bg-slate-100 text-slate-600",
    date_incomplete: "border-rose-200 bg-rose-50 text-rose-700",
};
const bookingStyles: Record<BookingStatus, string> = {
    pending: "border-amber-200 bg-amber-50 text-amber-800",
    booking: "border-sky-200 bg-sky-50 text-sky-700",
    confirmed: "border-emerald-200 bg-emerald-50 text-emerald-700",
    not_required: "border-slate-200 bg-slate-100 text-slate-600",
    cancelled: "border-rose-200 bg-rose-50 text-rose-700",
};
export function OperationPhaseBadge({ phase }: {
    phase: OperationPhase;
}) {
    return <Badge variant="outline" className={phaseStyles[phase]}>{OPERATION_PHASE_LABELS[phase]}</Badge>;
}
export function BookingStatusBadge({ status }: {
    status: BookingStatus;
}) {
    return <Badge variant="outline" className={bookingStyles[status]}>{BOOKING_STATUS_LABELS[status]}</Badge>;
}
export function ServiceListStatusBadge({ status, manual, }: {
    status: ServiceListStatus;
    manual?: boolean;
}) {
    return (<Badge variant="outline" className={cn(status === "uploaded"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-slate-200 bg-slate-100 text-slate-600")}>
      清单附件 · {SERVICE_LIST_STATUS_LABELS[status]}{manual ? "（人工）" : ""}
    </Badge>);
}
