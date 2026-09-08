import { existsSync, readFileSync } from "node:fs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { CostSheetParseError, parseOperationCostSheet, parseOperationServiceList } from "@/lib/operation-cost-sheet";
const escapeXml = (value: string) => value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const cell = (value: string) => `<w:tc><w:p><w:r><w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r></w:p></w:tc>`;
const row = (values: string[]) => `<w:tr>${values.map(cell).join("")}</w:tr>`;
const table = (rows: string[][]) => `<w:tbl>${rows.map(row).join("")}</w:tbl>`;
async function fixtureDocx(withCity = false) {
    const headers = [
        "日期",
        ...(withCity ? ["城市"] : []),
        "分类",
        "中文项目名",
        "数量",
        "成本单价",
        "报价单价",
        "成本小计",
        "报价小计",
        "毛利",
        "毛利率",
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        ${table([
        ["客户 / Client", "测试客户", "行程日期 / Travel Dates", "2026/08/06 – 2026/08/07"],
        ["生成日期 / Issue Date", "2026-07-30", "项目数量 / Items", "3"],
    ])}
        ${table([
        ["行程概览", "成都 - 重庆"],
    ])}
        ${table([
        headers,
        ["2026-08-06", ...(withCity ? ["成都"] : []), "市区用车", "5座用车", "1", "100", "200", "100", "200", "100", "50.0%"],
        ["", ...(withCity ? [""] : []), "酒店", "成都测试酒店", "1", "500", "525", "500", "525", "25", "4.8%"],
        ["2026-08-07", ...(withCity ? ["重庆"] : []), "机票", "北京-成都机票", "1", "1,000", "0", "1,000", "0", "-1,000", "—"],
        ["合计 / TOTAL", "1,600", "725", "-875", "-120.7%"],
    ])}
      </w:body>
    </w:document>`;
    const zip = new JSZip();
    zip.file("word/document.xml", xml);
    zip.file("[Content_Types].xml", "<Types />");
    return zip.generateAsync({ type: "uint8array" });
}
const operationsHeaders = ["行标识", "行号", "Day", "开始日期", "结束日期", "城市", "服务类型", "项目名称", "数量", "单位", "供应商", "成本单价", "客户报价单价", "出发地", "目的地", "班次/确认号", "时间", "房型", "间数", "备注"];
const hotelRow = ["stable-hotel", "1", "1", "2026-08-20", "2026-08-22", "成都", "酒店", "成都酒店", "2", "间", "酒店供应商", "500.25", "650.5", "", "", "ABC123", "", "双床", "2", "含早"];
async function operationsTemplateDocx(headers = operationsHeaders, detailRows = [hotelRow]) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
    ${table([["模板代码", "TRIPBOOK_OPERATIONS_SERVICE_LIST", "模板版本", "1"], ["客户/团名", "测试客户", "人数", "3"], ["开始日期", "2026-08-20", "结束日期", "2026-08-22"]])}
    ${table([headers, ...detailRows])}
  </w:body></w:document>`;
    const zip = new JSZip();
    zip.file("word/document.xml", xml);
    zip.file("[Content_Types].xml", "<Types />");
    return zip.generateAsync({ type: "uint8array" });
}
describe("parseOperationCostSheet", () => {
    it("按固定表格结构无损解析 Tripbook 计调服务清单 v1", async () => {
        const preview = await parseOperationCostSheet(await operationsTemplateDocx());
        expect(preview).toMatchObject({ template: "tripbook-operations-service-list-v1", format: "structured", templateVersion: "1", clientLabel: "测试客户" });
        expect(preview.items[0]).toMatchObject({ rowKey: "stable-hotel", category: "hotel", serviceDate: "2026-08-20", checkOutDate: "2026-08-22", supplierName: "酒店供应商", quantity: 2, invoiceUnitCost: 500.25, customerUnitQuote: 650.5, confidence: "high" });
        expect(preview.totals).toEqual({ cost: 1000.5, quote: 1301, grossProfit: 300.5 });
    });
    it("固定模板表头损坏、合并列或重复行标识时明确拒绝且不降级猜测", async () => {
        const renamed = operationsHeaders.map((header) => header === "项目名称" ? "服务名称" : header);
        await expect(parseOperationServiceList(await operationsTemplateDocx(renamed), "renamed.docx")).rejects.toThrow("表头已被修改");
        await expect(parseOperationServiceList(await operationsTemplateDocx(operationsHeaders, [hotelRow.slice(0, -1)]), "merged.docx")).rejects.toThrow("列数异常");
        await expect(parseOperationServiceList(await operationsTemplateDocx(operationsHeaders, [hotelRow, hotelRow]), "duplicate.docx")).rejects.toThrow("重复行标识");
    });
    it("拒绝非法日期、逆向酒店日期和小数间数", async () => {
        const invalidDate = hotelRow.map((value, index) => index === 3 ? "2026-02-31" : value);
        const reversed = hotelRow.map((value, index) => index === 4 ? "2026-08-19" : value);
        const fractionalRooms = hotelRow.map((value, index) => index === 18 ? "1.5" : value);
        await expect(parseOperationCostSheet(await operationsTemplateDocx(operationsHeaders, [invalidDate]))).rejects.toThrow("不是有效日期");
        await expect(parseOperationCostSheet(await operationsTemplateDocx(operationsHeaders, [reversed]))).rejects.toThrow("结束日期早于开始日期");
        await expect(parseOperationCostSheet(await operationsTemplateDocx(operationsHeaders, [fractionalRooms]))).rejects.toThrow("间数必须是正整数");
    });
    it("解析固定成本表并映射到每日服务、酒店和大交通", async () => {
        const preview = await parseOperationCostSheet(await fixtureDocx());
        expect(preview.clientLabel).toBe("测试客户");
        expect(preview.travelStartDate).toBe("2026-08-06");
        expect(preview.travelEndDate).toBe("2026-08-07");
        expect(preview.days).toHaveLength(2);
        expect(preview.days.map((day) => day.city)).toEqual([null, null]);
        expect(preview.counts).toEqual({ daily: 1, hotel: 1, transport: 1 });
        expect(preview.totals).toEqual({ cost: 1600, quote: 725, grossProfit: -875 });
        expect(preview.items.map((item) => item.category)).toEqual(["driver", "hotel", "flight"]);
        expect(preview.items[2]).toMatchObject({
            origin: "北京",
            destination: "成都",
            transportType: "国内航班",
        });
    });
    it("解析新版城市列并继承同一日期的合并城市单元格", async () => {
        const preview = await parseOperationCostSheet(await fixtureDocx(true));
        expect(preview.days).toEqual([
            { dayNumber: 1, serviceDate: "2026-08-06", city: "成都" },
            { dayNumber: 2, serviceDate: "2026-08-07", city: "重庆" },
        ]);
        expect(preview.items.map((item) => item.city)).toEqual(["成都", "成都", "重庆"]);
        expect(preview.warnings).not.toContain("原文件未提供城市列；Day 和服务城市需在导入后补充。");
    });
    it("拒绝不是 DOCX 的输入", async () => {
        await expect(parseOperationCostSheet(new TextEncoder().encode("not-a-docx"))).rejects.toBeInstanceOf(CostSheetParseError);
    });
    it("兼容解析自由格式 TXT 并保留未匹配内容和置信度", async () => {
        const text = "2026年8月20日 成都 7座包车 成本500 报价800\n需要安静房间\n8月21日-8月23日 成都酒店 1000 1200";
        const preview = await parseOperationServiceList(new TextEncoder().encode(text), "legacy.txt");
        expect(preview.template).toBe("legacy-freeform-v1");
        expect(preview.items).toHaveLength(2);
        expect(preview.items.map((item) => item.category)).toEqual(["driver", "hotel"]);
        expect(preview.items.every((item) => item.sourceText && item.confidence)).toBe(true);
        expect(preview.items[1].checkOutDate).toBe("2026-08-23");
        expect(preview.unmatchedLines).toContain("需要安静房间");
    });
    const localFixture = process.env.COST_SHEET_FIXTURE;
    it.skipIf(!localFixture || !existsSync(localFixture))("解析用户提供的完整 14 项成本表", async () => {
        const preview = await parseOperationCostSheet(readFileSync(localFixture!));
        expect(preview.days).toHaveLength(3);
        expect(preview.items).toHaveLength(14);
        expect(preview.counts).toEqual({ daily: 11, hotel: 2, transport: 1 });
        expect(preview.totals).toEqual({ cost: 4345, quote: 3285, grossProfit: -1060 });
        expect(preview.days.map((day) => day.city)).toEqual(["成都", "成都", "重庆"]);
        expect(new Set(preview.items.map((item) => item.city))).toEqual(new Set(["成都", "重庆"]));
    });
});
