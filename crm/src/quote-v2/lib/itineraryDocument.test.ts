import { describe, expect, it } from "vitest";
import { ItineraryDocumentParseError, parseItineraryDocument, type ItineraryDocumentDraft } from "./itineraryDocument";
const draft = (overrides: Partial<ItineraryDocumentDraft> = {}): ItineraryDocumentDraft => ({
    clientName: "Smith Family",
    adults: 2,
    children: 1,
    seniors: 1,
    itineraryText: `Day 1 | August 6 | Kunming
Private Transfer: Airport pickup
Guide: Yes
Morning | Arrival in Kunming
Afternoon: Green Lake Park
Evening | Hotel Rest`,
    ...overrides,
});
describe("原行程系统英文行程导出", () => {
    it("保留客户姓名、成人、儿童、老人及自由格式英文行程", () => {
        const result = parseItineraryDocument(draft());
        expect(result).toMatchObject({ clientName: "Smith Family", adults: 2, children: 1, seniors: 1 });
        expect(result.days[0]).toMatchObject({
            dayNumber: 1,
            date: "August 6",
            city: "Kunming",
            transfer: "Private Transfer: Airport pickup",
            guide: "Guide: Yes",
            morning: { title: "Morning ｜ Arrival in Kunming", body: "" },
            afternoon: { title: "Afternoon", body: "Green Lake Park" },
        });
    });
    it("允许原系统支持的无日期 Day 标题和续写行", () => {
        const result = parseItineraryDocument(draft({ itineraryText: `Day 2 | Beijing
Morning | Forbidden City
Continue with a relaxed visit` }));
        expect(result.days[0]).toMatchObject({ date: "", city: "Beijing", morning: { title: "Morning ｜ Forbidden City", body: "Continue with a relaxed visit" } });
    });
    it("客户名可留空并沿用原系统的 Client 默认值", () => {
        expect(parseItineraryDocument(draft({ clientName: "" })).clientName).toBe("Client");
    });
    it("没有 Day 行程时阻止导出", () => {
        expect(() => parseItineraryDocument(draft({ itineraryText: "Morning | Arrival" }))).toThrow(ItineraryDocumentParseError);
    });
});
