import { describe, expect, it, vi } from "vitest";
import { createEmptyPlan } from "../data/seed";
import type { SavedProposal } from "../types";
import { addSavedDirectQuoteVersion, addSavedVersion, createSavedDirectQuoteVersion, createSavedVersion, duplicateSavedDirectQuoteVersion, nextDirectQuoteVersion, nextProposalVersion, normalizeSavedProposals, } from "./versioning";
const saved = (values: Partial<SavedProposal> & Pick<SavedProposal, "id" | "customerName" | "proposalName" | "version">): SavedProposal => ({
    title: values.proposalName,
    savedAt: `2026-07-${String(values.version).padStart(2, "0")}T00:00:00.000Z`,
    plan: createEmptyPlan(),
    ...values,
});
describe("proposal versioning", () => {
    it("increments versions within the same customer and proposal only", () => {
        const records = [
            saved({ id: "1", customerName: "Jasmine", proposalName: "经典路线", version: 1 }),
            saved({ id: "2", customerName: "Jasmine", proposalName: "亲子路线", version: 1 }),
            saved({ id: "3", customerName: "Khoi", proposalName: "经典路线", version: 1 }),
        ];
        expect(nextProposalVersion(records, "Jasmine", "经典路线")).toBe(2);
        expect(nextProposalVersion(records, "Jasmine", "新路线")).toBe(1);
    });
    it("migrates legacy flat snapshots without losing their plans", () => {
        const plan = createEmptyPlan();
        const migrated = normalizeSavedProposals([{ id: "legacy", title: "成都方案", savedAt: "2026-07-01", plan }]);
        expect(migrated[0]).toMatchObject({
            customerName: "未分类客户",
            proposalName: "成都方案",
            version: 1,
            plan,
        });
    });
    it("keeps at most thirty versions per proposal", () => {
        const records = Array.from({ length: 30 }, (_, index) => saved({ id: String(index + 1), customerName: "Jasmine", proposalName: "经典路线", version: index + 1 }));
        const latest = saved({ id: "31", customerName: "Jasmine", proposalName: "经典路线", version: 31 });
        const result = addSavedVersion(records, latest);
        expect(result).toHaveLength(30);
        expect(result.some((record) => record.version === 1)).toBe(false);
        expect(result[0].version).toBe(31);
    });
    it("creates the next saved version with a clean name and note", () => {
        vi.stubGlobal("crypto", { randomUUID: () => "new-version" });
        const first = saved({ id: "1", customerName: "Jasmine", proposalName: "经典路线", version: 1 });
        const created = createSavedVersion({
            customerName: " Jasmine ",
            proposalName: " 经典路线 ",
            versionNote: " 调整酒店 ",
            plan: createEmptyPlan(),
            savedProposals: [first],
        });
        expect(created).toMatchObject({
            id: "new-version",
            customerName: "Jasmine",
            proposalName: "经典路线",
            version: 2,
            versionNote: "调整酒店",
        });
        vi.unstubAllGlobals();
    });
    it("keeps existing casing when a logical group is entered with different casing", () => {
        vi.stubGlobal("crypto", { randomUUID: () => "second-version" });
        const first = saved({ id: "1", customerName: "Khoi", proposalName: "China Discovery", version: 1 });
        const created = createSavedVersion({
            customerName: " khoi ",
            proposalName: "china discovery",
            plan: createEmptyPlan(),
            savedProposals: [first],
        });
        expect(created).toMatchObject({
            customerName: "Khoi",
            proposalName: "China Discovery",
            version: 2,
        });
        vi.unstubAllGlobals();
    });
});
describe("direct quote versioning", () => {
    const quote = {
        people: 3,
        city: "凤凰古城",
        days: [{ id: "day-1", date: "2026-08-01", title: "直接报价", city: "凤凰古城" }],
        items: [],
        updatedAt: "2026-07-27T00:00:00.000Z",
    };
    it("increments versions inside the same direct quote proposal", () => {
        vi.stubGlobal("crypto", { randomUUID: () => "direct-v1" });
        const first = createSavedDirectQuoteVersion({
            customerName: "Smith",
            proposalName: "Fenghuang Quote",
            quote,
            costsHidden: true,
            savedDirectQuotes: [],
        });
        vi.stubGlobal("crypto", { randomUUID: () => "direct-v2" });
        const second = createSavedDirectQuoteVersion({
            customerName: "smith",
            proposalName: "fenghuang quote",
            versionNote: "Hotel updated",
            quote,
            costsHidden: false,
            savedDirectQuotes: [first],
        });
        expect(nextDirectQuoteVersion([first], "Smith", "Fenghuang Quote")).toBe(2);
        expect(second).toMatchObject({
            customerName: "Smith",
            proposalName: "Fenghuang Quote",
            version: 2,
            versionNote: "Hotel updated",
            costsHidden: false,
        });
        vi.unstubAllGlobals();
    });
    it("duplicates a direct quote as the next version and keeps full quote data", () => {
        vi.stubGlobal("crypto", { randomUUID: () => "direct-copy" });
        const source = {
            id: "source",
            title: "Fenghuang Quote",
            savedAt: "2026-07-27T00:00:00.000Z",
            quote,
            customerName: "Smith",
            proposalName: "Fenghuang Quote",
            version: 1,
            costsHidden: true,
            groupId: "group-a",
        };
        const duplicated = duplicateSavedDirectQuoteVersion([source], source);
        const records = addSavedDirectQuoteVersion([source], duplicated);
        expect(duplicated.version).toBe(2);
        expect(duplicated.quote).toMatchObject({
            people: quote.people,
            city: quote.city,
            days: quote.days,
            items: quote.items,
        });
        expect(duplicated.quote).not.toBe(quote);
        expect(duplicated.groupId).toBe("group-a");
        expect(records.map((record) => record.version)).toEqual([2, 1]);
        vi.unstubAllGlobals();
    });
});
