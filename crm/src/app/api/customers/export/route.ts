import { NextResponse } from "next/server";
import { z } from "zod";
import { buildCustomerExport } from "@/lib/customer-export";
import { getCustomers } from "@/lib/repositories/customers";
export const runtime = "nodejs";
const exportSchema = z.object({
    customerIds: z.array(z.string().uuid()).min(1).max(5000),
});
export async function POST(request: Request) {
    const parsed = exportSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: "请选择需要导出的客户" }, { status: 400 });
    }
    const requestedIds = [...new Set(parsed.data.customerIds)];
    const { customers } = await getCustomers({ ids: requestedIds });
    const byId = new Map(customers.map((customer) => [customer.id, customer]));
    const orderedCustomers = requestedIds.flatMap((id) => {
        const customer = byId.get(id);
        return customer ? [customer] : [];
    });
    if (!orderedCustomers.length) {
        return NextResponse.json({ error: "没有找到可导出的客户" }, { status: 404 });
    }
    const bytes = await buildCustomerExport(orderedCustomers);
    const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    const filename = `tripbook-crm-customers-${date}.xlsx`;
    return new NextResponse(Buffer.from(bytes), {
        headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-store",
        },
    });
}
