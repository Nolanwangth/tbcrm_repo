import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
const templates: Record<string, string> = {
    "proforma-invoice": "proforma_invoice_template.docx",
    "internal-cost-sheet": "internal_cost_sheet_template.docx",
};
export async function GET(_request: Request, { params }: {
    params: Promise<{
        name: string;
    }>;
}) {
    if (!await getCurrentUser())
        return NextResponse.json({ error: "未登录" }, { status: 401 });
    const { name } = await params;
    const filename = templates[name];
    if (!filename)
        return NextResponse.json({ error: "模板不存在" }, { status: 404 });
    const data = await readFile(path.join(process.cwd(), "public", "templates", filename));
    return new NextResponse(data, {
        headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "Cache-Control": "private, no-store",
        },
    });
}
