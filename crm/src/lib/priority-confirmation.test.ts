import { describe, expect, it } from "vitest";
import { PRIORITIES } from "@/lib/constants";
import { requiresUrgentConfirmation } from "@/lib/priority-confirmation";
describe("requiresUrgentConfirmation", () => {
    it.each(PRIORITIES.filter((priority) => priority !== "紧急"))("从 %s 变动至紧急需要二次确认", (priority) => expect(requiresUrgentConfirmation(priority, "紧急")).toBe(true));
    it("重复保存紧急不需要再次确认", () => {
        expect(requiresUrgentConfirmation("紧急", "紧急")).toBe(false);
    });
    it.each(PRIORITIES.filter((priority) => priority !== "紧急"))("从紧急变动至 %s 不需要二次确认", (priority) => expect(requiresUrgentConfirmation("紧急", priority)).toBe(false));
});
