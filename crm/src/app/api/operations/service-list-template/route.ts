import JSZip from "jszip";
const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cell = (value: string, bold = false) => `<w:tc><w:p><w:r>${bold ? "<w:rPr><w:b/></w:rPr>" : ""}<w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r></w:p></w:tc>`;
const row = (values: string[], bold = false) => `<w:tr>${values.map((value) => cell(value, bold)).join("")}</w:tr>`;
const table = (rows: string[]) => `<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders></w:tblPr>${rows.join("")}</w:tbl>`;
export async function GET() {
    const headers = ["行标识", "行号", "Day", "开始日期", "结束日期", "城市", "服务类型", "项目名称", "数量", "单位", "供应商", "成本单价", "客户报价单价", "出发地", "目的地", "班次/确认号", "时间", "房型", "间数", "备注"];
    const metadata = table([
        row(["模板代码", "TRIPBOOK_OPERATIONS_SERVICE_LIST", "模板版本", "1"]),
        row(["客户/团名", "", "人数", ""]), row(["开始日期", "", "结束日期", ""]),
        row(["规划师", "", "路线", ""]), row(["特殊需求", "", "填写说明", "可新增或删除明细行；请勿修改表头、列顺序或合并明细单元格。"]),
    ]);
    const example = row(["example-001", "1", "1", "2026-08-20", "2026-08-20", "成都", "车辆", "7座市区用车", "1", "项", "", "0", "0", "", "", "", "09:00", "", "", "示例行；正式填写时请替换全部内容"]);
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t>Tripbook 计调服务清单 v1</w:t></w:r></w:p><w:p><w:r><w:t>服务类型仅限：酒店、航班、高铁、其他大交通、车辆、导游、门票、餐饮、保险、其他。</w:t></w:r></w:p>${metadata}<w:p/><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>服务明细</w:t></w:r></w:p>${table([row(headers, true), example])}<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/></w:sectPr></w:body></w:document>`;
    const zip = new JSZip();
    zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
    zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
    zip.file("word/document.xml", xml);
    const body = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    return new Response(body as BodyInit, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("Tripbook 计调服务清单 v1.docx")}`, "Cache-Control": "no-store" } });
}
