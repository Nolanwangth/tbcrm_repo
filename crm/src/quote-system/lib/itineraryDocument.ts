export interface ItineraryDocumentDraft {
    clientName: string;
    adults: number;
    children: number;
    seniors: number;
    itineraryText: string;
}
export interface ItinerarySection {
    title: string;
    body: string;
}
export interface ParsedItineraryDay {
    dayNumber: number;
    date: string;
    city: string;
    transfer: string;
    guide: string;
    start: string;
    fullDay: ItinerarySection;
    morning: ItinerarySection;
    afternoon: ItinerarySection;
    evening: ItinerarySection;
    remarks: ItinerarySection;
}
export interface ParsedItineraryDocument {
    clientName: string;
    adults: number;
    children: number;
    seniors: number;
    days: ParsedItineraryDay[];
}
export class ItineraryDocumentParseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ItineraryDocumentParseError";
    }
}
function section(): ItinerarySection {
    return { title: "", body: "" };
}
function createDay(dayNumber: number, date: string, city: string): ParsedItineraryDay {
    return {
        dayNumber, date, city, transfer: "", guide: "", start: "",
        fullDay: section(), morning: section(), afternoon: section(), evening: section(), remarks: section(),
    };
}
type SectionKey = "fullDay" | "morning" | "afternoon" | "evening" | "remarks";
type DayPeriod = Exclude<SectionKey, "fullDay" | "remarks">;
function parseEnglishItinerary(text: string): ParsedItineraryDay[] {
    const days: ParsedItineraryDay[] = [];
    let current: ParsedItineraryDay | undefined;
    let currentSection: SectionKey | undefined;
    for (const rawLine of text.replace(/\r\n/g, "\n").split("\n")) {
        const line = rawLine.trim();
        if (!line)
            continue;
        const header = line.match(/^Day\s*(\d+)\s*[｜|]\s*(.*?)\s*[｜|]\s*(.+?)\s*$/i);
        const headerWithoutDate = header ? null : line.match(/^Day\s*(\d+)\s*[｜|]\s*(.+?)\s*$/i);
        if (header || headerWithoutDate) {
            const match = header ?? headerWithoutDate!;
            current = createDay(Number(match[1]), header ? match[2].trim() : "", header ? match[3].trim() : match[2].trim());
            days.push(current);
            currentSection = undefined;
            continue;
        }
        if (!current)
            continue;
        if (/^Private Transfer\s*:/i.test(line)) {
            current.transfer = line;
            currentSection = undefined;
            continue;
        }
        if (/^Guide\s*:/i.test(line)) {
            current.guide = line;
            currentSection = undefined;
            continue;
        }
        if (/^Tour starts/i.test(line)) {
            current.start = line;
            currentSection = undefined;
            continue;
        }
        const fullDayColon = line.match(/^Full[\s-]*Day\s*[:：]\s*(.+?)\s*$/i);
        if (fullDayColon) {
            currentSection = "fullDay";
            current.fullDay = { title: "Full Day", body: fullDayColon[1].trim() };
            continue;
        }
        const dayPartColon = line.match(/^(Morning|Afternoon|Evening)\s*[:：]\s*(.+?)\s*$/i);
        if (dayPartColon) {
            currentSection = dayPartColon[1].toLowerCase() as DayPeriod;
            current[currentSection] = { title: dayPartColon[1][0].toUpperCase() + dayPartColon[1].slice(1).toLowerCase(), body: dayPartColon[2].trim() };
            continue;
        }
        const part = line.match(/^(Full\s*Day|Morning|Afternoon|Evening)\s*(?:[｜|]\s*(.+?))?\s*$/i);
        if (part) {
            currentSection = /^full[\s-]*day$/i.test(part[1]) ? "fullDay" : part[1].toLowerCase() as DayPeriod;
            const label = currentSection === "fullDay" ? "Full Day" : part[1][0].toUpperCase() + part[1].slice(1).toLowerCase();
            current[currentSection].title = part[2]?.trim() ? `${label} ｜ ${part[2].trim()}` : label;
            continue;
        }
        const remarksColon = line.match(/^(Remarks?|Notes?|备注)\s*[:：]\s*(.*?)\s*$/i);
        if (remarksColon) {
            currentSection = "remarks";
            current.remarks = { title: "Remarks", body: remarksColon[2].trim() };
            continue;
        }
        const remarksPart = line.match(/^(Remarks?|Notes?|备注)\s*[｜|]\s*(.+?)\s*$/i);
        if (remarksPart) {
            currentSection = "remarks";
            current.remarks = { title: `Remarks ｜ ${remarksPart[2].trim()}`, body: "" };
            continue;
        }
        if (currentSection)
            current[currentSection].body = `${current[currentSection].body} ${line}`.trim();
    }
    return days;
}
function count(value: number): number {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}
export function parseItineraryDocument(draft: ItineraryDocumentDraft): ParsedItineraryDocument {
    const days = parseEnglishItinerary(draft.itineraryText);
    if (days.length === 0)
        throw new ItineraryDocumentParseError("没有识别到英文行程，请检查 Day 1 ｜ Date ｜ City 格式");
    return { clientName: draft.clientName.trim() || "Client", adults: count(draft.adults), children: count(draft.children), seniors: count(draft.seniors), days };
}
export const ITINERARY_DOCUMENT_DRAFT_KEY = "qtp-itinerary-document-draft-v2";
export const DEFAULT_ITINERARY_DOCUMENT_DRAFT: ItineraryDocumentDraft = {
    clientName: "", adults: 0, children: 0, seniors: 0, itineraryText: "",
};
