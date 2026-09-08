import { readFile } from "node:fs/promises";
import { DOMParser } from "@xmldom/xmldom";
import JSZip from "jszip";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildItineraryDocx, generateItineraryDocx, resetItineraryTemplateCacheForTests } from "./docxGenerator";
import type { ParsedItineraryDocument } from "./itineraryDocument";
const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const templatePath = new URL("../../../public/quote-v2/templates/tripbook-itinerary-template.docx", import.meta.url);
function elementText(element: Element): string {
    return Array.from(element.getElementsByTagNameNS(W, "t")).map((node) => node.textContent ?? "").join("");
}
function directChildren(element: Element): Element[] {
    const result: Element[] = [];
    for (let index = 0; index < element.childNodes.length; index += 1) {
        const node = element.childNodes.item(index);
        if (node?.nodeType === 1)
            result.push(node as Element);
    }
    return result;
}
describe("English itinerary Word generation", () => {
    afterEach(() => {
        resetItineraryTemplateCacheForTests();
        vi.restoreAllMocks();
    });
    it("keeps the current reference layout and clones its Day typography", async () => {
        const data: ParsedItineraryDocument = {
            clientName: "Nathalie",
            adults: 2,
            children: 0,
            seniors: 1,
            days: [
                {
                    dayNumber: 1,
                    date: "October 28",
                    city: "Beijing",
                    transfer: "Private Transfer: Yes (Airport pick-up)",
                    guide: "Guide: No",
                    start: "Tour starts at 06:00 A.M.",
                    fullDay: { title: "", body: "" },
                    morning: { title: "Morning ｜ Arrival", body: "Arrive in Beijing and meet your driver." },
                    afternoon: { title: "Afternoon ｜ Hotel Check-in", body: "Transfer to the hotel and rest." },
                    evening: { title: "Evening ｜ Free Time", body: "Enjoy a relaxed evening." },
                    remarks: { title: "", body: "" },
                },
                {
                    dayNumber: 2,
                    date: "October 29",
                    city: "Beijing",
                    transfer: "Private Transfer: Yes (Full-day private vehicle)",
                    guide: "Guide: Yes",
                    start: "",
                    fullDay: { title: "", body: "" },
                    morning: { title: "Morning ｜ Mutianyu Great Wall", body: "Visit Mutianyu Great Wall." },
                    afternoon: { title: "", body: "" },
                    evening: { title: "", body: "" },
                    remarks: { title: "", body: "" },
                },
            ],
        };
        const generated = await buildItineraryDocx(await readFile(templatePath), data);
        const zip = await JSZip.loadAsync(generated);
        const xml = await zip.file("word/document.xml")!.async("string");
        const documentXml = new DOMParser().parseFromString(xml, "application/xml");
        const body = documentXml.getElementsByTagNameNS(W, "body")[0];
        const elements = directChildren(body);
        const text = elementText(body);
        expect(text).toContain("Nathalie’s China Discovery Journey");
        expect(text).toContain("* Number of travelers: 3 travelers (2 adults, 1 senior)");
        expect(text).toContain("* Travel dates: October 28 - October 29");
        expect(text).toContain("*Destination: Beijing");
        expect(text).not.toContain("*Destination: Beijing, Beijing");
        expect(text).toContain("What happens next");
        expect(text).not.toContain("About us");
        expect(text).not.toContain("Pablo Steinman");
        const dayHeading = elements.find((element) => elementText(element).trim().startsWith("Day 1 ｜"))!;
        const startLine = elements.find((element) => elementText(element).trim() === "Tour starts at 06:00 A.M.")!;
        const description = elements.find((element) => elementText(element).trim() === "Arrive in Beijing and meet your driver.")!;
        const headingRun = dayHeading.getElementsByTagNameNS(W, "r")[0];
        const startRun = startLine.getElementsByTagNameNS(W, "r")[0];
        const descriptionRun = description.getElementsByTagNameNS(W, "r")[0];
        expect(headingRun.getElementsByTagNameNS(W, "b").length).toBeGreaterThan(0);
        expect(headingRun.getElementsByTagNameNS(W, "sz")[0]?.getAttributeNS(W, "val")).toBe("24");
        expect(startRun.getElementsByTagNameNS(W, "b").length).toBeGreaterThan(0);
        expect(startRun.getElementsByTagNameNS(W, "sz")[0]?.getAttributeNS(W, "val")).toBe("21");
        expect(descriptionRun.getElementsByTagNameNS(W, "b")[0]?.getAttributeNS(W, "val")).toBe("0");
        expect(descriptionRun.getElementsByTagNameNS(W, "rFonts")[0]?.getAttributeNS(W, "ascii")).toBe("Times New Roman");
        expect(descriptionRun.getElementsByTagNameNS(W, "sz")[0]?.getAttributeNS(W, "val")).toBe("21");
        expect(elements.filter((element) => /^Day\s+\d+/i.test(elementText(element).trim())).map(elementText)).toEqual([
            "Day 1 ｜ October 28 ｜ Beijing",
            "Day 2 ｜ October 29 ｜ Beijing",
        ]);
    });
    it("finishes when new client and destination values extend template text", async () => {
        const data: ParsedItineraryDocument = {
            clientName: "Pablo Steinman Family",
            adults: 2,
            children: 0,
            seniors: 0,
            days: [
                {
                    dayNumber: 1,
                    date: "September 14",
                    city: "Shanghai → Xi'an → Zhangjiajie → Beijing",
                    transfer: "Private Transfer: Yes",
                    guide: "Guide: Yes",
                    start: "",
                    fullDay: { title: "", body: "" },
                    morning: { title: "Morning ｜ Arrival", body: "Arrive in Shanghai." },
                    afternoon: { title: "Afternoon ｜ City Visit", body: "Continue the city visit." },
                    evening: { title: "Evening ｜ Hotel Rest", body: "Rest at the hotel." },
                    remarks: { title: "", body: "" },
                },
            ],
        };
        const generated = await buildItineraryDocx(await readFile(templatePath), data);
        const zip = await JSZip.loadAsync(generated);
        const xml = await zip.file("word/document.xml")!.async("string");
        const documentXml = new DOMParser().parseFromString(xml, "application/xml");
        const text = elementText(documentXml.documentElement);
        expect(text).toContain("Pablo Steinman Family’s China Discovery Journey");
        expect(text).toContain("*Destination: Shanghai, Xi'an, Zhangjiajie, Beijing");
        expect(text).not.toContain("Beijing, Beijing");
    }, 3000);
    it("reuses one downloaded template across consecutive exports", async () => {
        const template = await readFile(templatePath);
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(template, { status: 200 }));
        const data: ParsedItineraryDocument = {
            clientName: "Morgan Zhou",
            adults: 3,
            children: 0,
            seniors: 0,
            days: [{
                    dayNumber: 1,
                    date: "November 5",
                    city: "Shanghai",
                    transfer: "Private Transfer: Yes (Airport pick-up)",
                    guide: "Guide: No",
                    start: "",
                    fullDay: { title: "", body: "" },
                    morning: { title: "Morning ｜ Arrival", body: "Arrive in Shanghai and transfer to the hotel." },
                    afternoon: { title: "Afternoon ｜ No activity", body: "No activity." },
                    evening: { title: "Evening ｜ No activity", body: "No activity." },
                    remarks: { title: "", body: "" },
                }],
        };
        const first = await generateItineraryDocx(data);
        const second = await generateItineraryDocx(data);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(first.blob.size).toBeGreaterThan(0);
        expect(second.blob.size).toBe(first.blob.size);
    });
});
