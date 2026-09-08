import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import JSZip from "jszip";
import type { ParsedItineraryDocument, ItinerarySection } from "./itineraryDocument";
const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const TEMPLATE_URL = "/quote-v2/templates/tripbook-itinerary-template.docx?v=20260824-correct-reference-v2";
const TEMPLATE_FETCH_TIMEOUT_MS = 12000;
let templateBytesCache: Uint8Array | null = null;
let templateBytesRequest: Promise<Uint8Array> | null = null;
async function fetchTemplateBytes(attempt: number): Promise<Uint8Array> {
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), TEMPLATE_FETCH_TIMEOUT_MS);
    const retryUrl = attempt === 0 ? TEMPLATE_URL : `${TEMPLATE_URL}&retry=${Date.now()}`;
    try {
        const response = await fetch(retryUrl, { cache: "no-store", signal: controller.signal });
        if (!response.ok)
            throw new Error("无法读取英文行程模版");
        return new Uint8Array(await response.arrayBuffer());
    }
    finally {
        globalThis.clearTimeout(timeout);
    }
}
async function loadTemplateBytes(): Promise<Uint8Array> {
    if (templateBytesCache)
        return templateBytesCache.slice();
    if (!templateBytesRequest) {
        templateBytesRequest = (async () => {
            let lastError: unknown;
            for (let attempt = 0; attempt < 2; attempt += 1) {
                try {
                    const bytes = await fetchTemplateBytes(attempt);
                    templateBytesCache = bytes;
                    return bytes;
                }
                catch (error) {
                    lastError = error;
                }
            }
            if (lastError instanceof DOMException && lastError.name === "AbortError") {
                throw new Error("读取英文行程模版超时，请检查网络后重试");
            }
            throw lastError instanceof Error ? lastError : new Error("无法读取英文行程模版");
        })().finally(() => { templateBytesRequest = null; });
    }
    return (await templateBytesRequest).slice();
}
export function resetItineraryTemplateCacheForTests(): void {
    templateBytesCache = null;
    templateBytesRequest = null;
}
function localName(element: Element): string { return element.localName || element.nodeName.replace(/^.*:/, ""); }
function children(element: Element): Element[] {
    const result: Element[] = [];
    for (let index = 0; index < element.childNodes.length; index += 1) {
        const node = element.childNodes.item(index);
        if (node?.nodeType === 1)
            result.push(node as Element);
    }
    return result;
}
function textNodes(scope: Element): Element[] { return Array.from(scope.getElementsByTagNameNS(WORD_NS, "t")); }
function scopeText(scope: Element): string { return textNodes(scope).map((node) => node.textContent ?? "").join(""); }
function preserveWhitespace(node: Element): void {
    if (/^\s|\s$/.test(node.textContent ?? ""))
        node.setAttribute("xml:space", "preserve");
    else
        node.removeAttribute("xml:space");
}
function replaceText(scope: Element, search: string, replacement: string): void {
    if (!search || search === replacement)
        return;
    let searchFrom = 0;
    while (true) {
        const nodes = textNodes(scope);
        const values = nodes.map((node) => node.textContent ?? "");
        const combined = values.join("");
        const start = combined.indexOf(search, searchFrom);
        if (start < 0)
            return;
        const end = start + search.length;
        let cursor = 0;
        let startNode = -1;
        let endNode = -1;
        let startOffset = 0;
        let endOffset = 0;
        values.forEach((value, index) => {
            const next = cursor + value.length;
            if (startNode < 0 && start >= cursor && start < next) {
                startNode = index;
                startOffset = start - cursor;
            }
            if (endNode < 0 && end > cursor && end <= next) {
                endNode = index;
                endOffset = end - cursor;
            }
            cursor = next;
        });
        if (startNode < 0 || endNode < 0)
            return;
        nodes[startNode].textContent = values[startNode].slice(0, startOffset) + replacement + (startNode === endNode ? values[startNode].slice(endOffset) : "");
        preserveWhitespace(nodes[startNode]);
        for (let index = startNode + 1; index <= endNode; index += 1) {
            if (index === endNode)
                nodes[index].textContent = values[index].slice(endOffset);
            else
                nodes[index].textContent = "";
            preserveWhitespace(nodes[index]);
        }
        searchFrom = start + replacement.length;
    }
}
function setStyledText(scope: Element, text: string): void {
    const nodes = textNodes(scope);
    if (!nodes.length)
        throw new Error("英文行程模版样式段落缺少文本节点");
    nodes[0].textContent = text;
    preserveWhitespace(nodes[0]);
    nodes.slice(1).forEach((node) => {
        node.textContent = "";
        preserveWhitespace(node);
    });
}
function cloneWithText(template: Element, text: string): Element {
    const clone = template.cloneNode(true) as Element;
    setStyledText(clone, text);
    return clone;
}
function hasPageBreak(element: Element): boolean {
    return Array.from(element.getElementsByTagNameNS(WORD_NS, "br")).some((node) => node.getAttributeNS(WORD_NS, "type") === "page" || node.getAttribute("w:type") === "page");
}
function prefixedElement(body: Element, prefix: string): Element {
    const match = children(body).find((element) => scopeText(element).trim().startsWith(prefix));
    if (!match)
        throw new Error(`英文行程模版缺少“${prefix}”字段`);
    return match;
}
function styledDaySections(day: ParsedItineraryDocument["days"][number]): ItinerarySection[] {
    if (day.fullDay.title || day.fullDay.body)
        return [day.fullDay, day.remarks].filter((section) => section.title || section.body);
    return [day.morning, day.afternoon, day.evening, day.remarks].filter((section) => section.title || section.body);
}
function fillClientInformation(body: Element, data: ParsedItineraryDocument): void {
    const travelerLabel = (count: number, singular: string, plural: string) => count ? `${count} ${count === 1 ? singular : plural}` : "";
    const travelerParts = [
        travelerLabel(data.adults, "adult", "adults"),
        travelerLabel(data.children, "child", "children"),
        travelerLabel(data.seniors, "senior", "seniors"),
    ].filter(Boolean);
    const travelerText = `${data.adults + data.children + data.seniors} travelers${travelerParts.length ? ` (${travelerParts.join(", ")})` : ""}`;
    const dates = data.days.map((day) => day.date).filter(Boolean);
    const travelDates = dates.length > 1 ? `${dates[0]} - ${dates[dates.length - 1]}` : dates[0] ?? "";
    const duration = `${data.days.length} ${data.days.length === 1 ? "Day" : "Days"}`;
    const destinations = Array.from(new Set(data.days.flatMap((day) => day.city.split(/\s*(?:→|->)\s*/)).map((city) => city.trim()).filter(Boolean))).join(", ");
    const titleElement = children(body).find((element) => /China Discovery Journey/i.test(scopeText(element)) && scopeText(element).trim().length < 160);
    if (!titleElement)
        throw new Error("英文行程模版缺少客户行程标题");
    const previousTitle = scopeText(titleElement).trim();
    const previousNameElement = prefixedElement(body, "* Name:");
    const previousNameLine = scopeText(previousNameElement).trim();
    const previousName = previousNameLine.replace(/^\*\s*Name:\s*/i, "").trim();
    const previousTravelDatesLine = scopeText(prefixedElement(body, "* Travel dates:")).trim();
    const previousTravelDates = previousTravelDatesLine.replace(/^\*\s*Travel dates:\s*/i, "").trim();
    const previousDurationLine = scopeText(prefixedElement(body, "*Total Travel Duration:")).trim();
    const previousDuration = previousDurationLine.replace(/^\*Total Travel Duration:\s*/i, "").replace(/,\s*including.*$/i, "").trim();
    const inferredYear = data.days.map((day) => day.date.match(/\b20\d{2}\b/)?.[0]).find(Boolean) ?? String(new Date().getFullYear());
    replaceText(body, previousTitle, `${data.clientName}’s China Discovery Journey`);
    replaceText(body, previousNameLine, `* Name: ${data.clientName}`);
    replaceText(body, scopeText(prefixedElement(body, "* Number of travelers:")).trim(), `* Number of travelers: ${travelerText}`);
    replaceText(body, previousTravelDatesLine, `* Travel dates: ${travelDates}`);
    replaceText(body, previousDurationLine, `*Total Travel Duration: ${duration}, including arrival and departure dates`);
    replaceText(body, scopeText(prefixedElement(body, "*Destination:")).trim(), `*Destination: ${destinations}`);
    if (previousName)
        replaceText(body, `The ${previousName} Family China Journey 2026`, `The ${data.clientName} Family China Journey ${inferredYear}`);
    if (previousTravelDates)
        replaceText(body, `${previousTravelDates},2026`, `${travelDates},${inferredYear}`);
    if (previousDuration)
        replaceText(body, previousDuration, duration);
}
function replaceTemplateDays(body: Element, data: ParsedItineraryDocument): void {
    const bodyElements = children(body);
    const firstDay = bodyElements.find((element) => /^Day\s+\d+/i.test(scopeText(element).trim()));
    const sectionProperties = bodyElements.find((element) => localName(element) === "sectPr");
    if (!firstDay || !sectionProperties)
        throw new Error("英文行程模版中没有找到 Day 示例段落");
    const start = bodyElements.indexOf(firstDay);
    const end = bodyElements.indexOf(sectionProperties);
    const firstPageBreak = bodyElements.slice(start, end).find(hasPageBreak);
    if (!firstPageBreak)
        throw new Error("英文行程模版中没有找到 Day 分页样式");
    const firstPageBreakIndex = bodyElements.indexOf(firstPageBreak);
    const firstDayBlock = bodyElements.slice(start, firstPageBreakIndex);
    const headingTemplate = firstDay;
    const transferTemplate = firstDayBlock.find((element) => /^Private Transfer\s*:|^Driver\s*:/i.test(scopeText(element).trim()));
    const guideTemplate = firstDayBlock.find((element) => /^Guide\s*:/i.test(scopeText(element).trim()));
    const sectionTitleTemplate = firstDayBlock.find((element) => /^(Full\s*Day|Morning|Afternoon|Evening)\s*[｜|]/i.test(scopeText(element).trim()));
    const sectionTitleIndex = sectionTitleTemplate ? firstDayBlock.indexOf(sectionTitleTemplate) : -1;
    const sectionBodyTemplate = sectionTitleIndex >= 0 ? firstDayBlock.slice(sectionTitleIndex + 1).find((element) => scopeText(element).trim()) : undefined;
    const blankTemplate = firstDayBlock.find((element) => localName(element) === "p" && !scopeText(element).trim() && !hasPageBreak(element));
    if (!transferTemplate || !guideTemplate || !sectionTitleTemplate || !sectionBodyTemplate || !blankTemplate)
        throw new Error("英文行程模版的 Day 样式结构不完整");
    bodyElements.slice(start, end).forEach((element) => body.removeChild(element));
    for (const [index, day] of data.days.entries()) {
        const heading = [`Day ${day.dayNumber}`, day.date, day.city].filter(Boolean).join(" ｜ ");
        body.insertBefore(cloneWithText(headingTemplate, heading), sectionProperties);
        body.insertBefore(cloneWithText(transferTemplate, day.transfer || "Private Transfer: None"), sectionProperties);
        body.insertBefore(cloneWithText(guideTemplate, day.guide || "Guide: None"), sectionProperties);
        if (day.start)
            body.insertBefore(cloneWithText(guideTemplate, day.start), sectionProperties);
        body.insertBefore(blankTemplate.cloneNode(true), sectionProperties);
        for (const section of styledDaySections(day)) {
            if (section.title)
                body.insertBefore(cloneWithText(sectionTitleTemplate, section.title), sectionProperties);
            if (section.body)
                body.insertBefore(cloneWithText(sectionBodyTemplate, section.body), sectionProperties);
            body.insertBefore(blankTemplate.cloneNode(true), sectionProperties);
        }
        if (index < data.days.length - 1)
            body.insertBefore(firstPageBreak.cloneNode(true), sectionProperties);
    }
}
function filenamePart(value: string): string {
    return value.normalize("NFKD").replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 70) || "Client";
}
export async function buildItineraryDocx(template: ArrayBuffer | Uint8Array, data: ParsedItineraryDocument): Promise<Uint8Array> {
    const zip = await JSZip.loadAsync(template);
    const documentPart = zip.file("word/document.xml");
    if (!documentPart)
        throw new Error("英文行程模版缺少 document.xml");
    const documentXml = new DOMParser().parseFromString(await documentPart.async("string"), "application/xml");
    if (documentXml.getElementsByTagName("parsererror").length)
        throw new Error("英文行程模版 XML 无法解析");
    const body = documentXml.getElementsByTagNameNS(WORD_NS, "body")[0];
    if (!body)
        throw new Error("英文行程模版缺少正文");
    fillClientInformation(body, data);
    replaceTemplateDays(body, data);
    zip.file("word/document.xml", new XMLSerializer().serializeToString(documentXml));
    return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
export async function generateItineraryDocx(data: ParsedItineraryDocument): Promise<{
    blob: Blob;
    filename: string;
}> {
    const bytes = await buildItineraryDocx(await loadTemplateBytes(), data);
    const output = new Uint8Array(bytes.byteLength);
    output.set(bytes);
    const blob = new Blob([output.buffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    return { blob, filename: `Customized China Travel Itinerary for ${filenamePart(data.clientName)}.docx` };
}
export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
