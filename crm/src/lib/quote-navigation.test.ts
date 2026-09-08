import { describe, expect, it } from "vitest";
import { shouldGuardQuoteLink } from "./quote-navigation";
const current = { href: "http://127.0.0.1:3001/planner/tools/itinerary", origin: "http://127.0.0.1:3001" };
const link = (href: string, download = false, target = "") => ({ ...new URL(href), href, origin: new URL(href).origin, protocol: new URL(href).protocol, target, hasAttribute: (key: string) => key === "download" && download });
describe("quotation unsaved-navigation protection", () => {
    it("guards internal customer and workbench navigation", () => expect(shouldGuardQuoteLink(link(current.origin + "/customers"), current)).toBe(true));
    it("does not block generated Word blob downloads", () => expect(shouldGuardQuoteLink(link("blob:" + current.origin + "/document", true), current)).toBe(false));
    it("does not block same-origin attachment downloads", () => expect(shouldGuardQuoteLink(link(current.origin + "/api/files/1/download", true), current)).toBe(false));
    it("does not block PDF in a new tab", () => expect(shouldGuardQuoteLink(link(current.origin + "/api/proposal-versions/1/pdf", false, "_blank"), current)).toBe(false));
    it("does not intercept external or unchanged links", () => { expect(shouldGuardQuoteLink(link("https://example.com"), current)).toBe(false); expect(shouldGuardQuoteLink(link(current.href), current)).toBe(false); });
});
