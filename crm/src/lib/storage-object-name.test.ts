import { describe, expect, it } from "vitest";
import { buildStorageObjectName } from "@/lib/storage-object-name";
describe("上传文件存储对象名", () => {
    it("中文文件名不会进入对象路径，并保留安全扩展名", () => {
        expect(buildStorageObjectName("客户 行程单.pdf", "upload-id")).toBe("upload-id.pdf");
    });
    it("无扩展名文件仅使用上传 ID", () => {
        expect(buildStorageObjectName("客户资料", "upload-id")).toBe("upload-id");
    });
    it("过滤异常扩展名并限制长度", () => {
        expect(buildStorageObjectName("报价单.PD!F", "upload-id")).toBe("upload-id.pdf");
        expect(buildStorageObjectName("资料.abcdefghijklmnopq", "upload-id")).toBe("upload-id.abcdefghijklmnop");
    });
    it("隐藏文件名不被误判为扩展名", () => {
        expect(buildStorageObjectName(".env", "upload-id")).toBe("upload-id");
    });
});
