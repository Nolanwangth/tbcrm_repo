import { describe, expect, it } from "vitest";
import { SERVICE_WORKBENCHES } from "@/lib/constants";
describe("规划师席位", () => {
    it("业务工作台固定覆盖 A-E 五个可配置席位", () => {
        expect(SERVICE_WORKBENCHES).toEqual(["A", "B", "C", "D", "E"]);
    });
});
