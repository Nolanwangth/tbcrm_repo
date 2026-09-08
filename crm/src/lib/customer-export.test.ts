import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildCustomerExport } from "@/lib/customer-export";
import { demoCustomers } from "@/lib/demo-data";
import type { Customer } from "@/lib/types";
describe("buildCustomerExport", () => {
    it("exports all customer business areas and planning modification requirements", async () => {
        const base = demoCustomers[0];
        const customer: Customer = {
            ...base,
            contact: "+86 138 0000 0000",
            planningRequests: [
                {
                    id: "00000000-0000-4000-8000-000000000099",
                    requestType: "itinerary",
                    status: "行程待修改",
                    content: "将上海住宿改为外滩附近，并补充高铁班次。",
                    createdAt: "2026-07-27T08:00:00.000Z",
                },
            ],
            folders: [
                {
                    id: "00000000-0000-4000-8000-000000000071",
                    name: "行程V1",
                    parentId: null,
                    status: "已发送",
                    reviewStatus: "已审核",
                    createdAt: "2026-07-27T08:00:00.000Z",
                    statusHistory: [
                        {
                            id: "00000000-0000-4000-8000-000000000072",
                            oldStatus: "待发送",
                            newStatus: "已发送",
                            changedAt: "2026-07-27T09:00:00.000Z",
                        },
                    ],
                },
            ],
        };
        const bytes = await buildCustomerExport([customer]);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(bytes);
        expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
            "客户概览",
            "旅行需求",
            "首次评分",
            "跟进记录",
            "行程报价记录",
            "资料修改历史",
            "等级变化历史",
            "文件与文件夹",
            "文件夹状态历史",
        ]);
        expect(workbook.getWorksheet("客户概览")?.getCell("H2").value).toBe("+86 138 0000 0000");
        expect(workbook.getWorksheet("客户概览")?.getCell("I2").value).toBe(customer.whatsappStatus);
        expect(workbook.getWorksheet("客户概览")?.getCell("K2").value).toEqual(new Date(new Date(customer.firstInquiryAt).getTime() + 8 * 60 * 60 * 1000));
        expect(workbook.getWorksheet("行程报价记录")?.getCell("F2").value).toBe("将上海住宿改为外滩附近，并补充高铁班次。");
        expect(workbook.getWorksheet("文件夹状态历史")?.getCell("F2").value).toBe("已发送");
    });
});
