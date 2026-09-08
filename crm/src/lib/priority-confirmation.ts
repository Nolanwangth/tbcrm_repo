import type { Priority } from "@/lib/types";
export function requiresUrgentConfirmation(current: Priority, next: Priority) {
    return current !== "紧急" && next === "紧急";
}
