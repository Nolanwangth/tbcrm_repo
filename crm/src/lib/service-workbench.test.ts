import { describe, expect, it } from "vitest";
import { demoCustomers } from "@/lib/demo-data";
import { serviceWorkbenchCustomers } from "@/lib/service-workbench";
const assignedAt = "2026-08-18T04:00:00.000Z";
function customer(overrides: Partial<(typeof demoCustomers)[number]> = {}) {
    return {
        ...demoCustomers[0],
        id: crypto.randomUUID(),
        status: "跟进中" as const,
        priority: "中" as const,
        serviceWorkbench: "A" as const,
        serviceAssignmentMode: "round_robin" as const,
        serviceAssignedAt: assignedAt,
        currentCallbackAt: null,
        callbackNotRequired: false,
        followUps: [],
        ...overrides,
    };
}
describe("规划师工作台客户归属", () => {
    it("只保留跟进中且属于指定字母工作台的客户", () => {
        const result = serviceWorkbenchCustomers([
            customer(),
            customer({ serviceWorkbench: "B" }),
            customer({ status: "已成交" }),
        ], "A");
        expect(result).toHaveLength(1);
    });
});
