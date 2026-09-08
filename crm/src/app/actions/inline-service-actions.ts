"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mutateOperation } from "@/lib/operation-mutations";
import { OPERATION_CATEGORIES } from "@/lib/operations";
const values = z.object({ route_text: z.string().max(5000), category: z.enum(OPERATION_CATEGORIES), title: z.string().trim().min(1).max(1000), details: z.string().max(20000), customer_unit_quote: z.number().finite().nonnegative().max(1e9).nullable(), invoice_unit_cost: z.number().finite().nonnegative().max(1e9).nullable(), service_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable() });
export async function saveInlineServiceAction(caseId: string, id: string, revision: number, input: z.infer<typeof values>) {
    const parsed = values.safeParse(input);
    if (!parsed.success)
        return { ok: false as const, error: "请检查服务名称、日期和金额，金额不能为负数" };
    const { data, error } = await mutateOperation('operation_service_items', caseId, id, revision, parsed.data);
    if (error)
        return { ok: false as const, error: error.message };
    revalidatePath(`/operations/${caseId}`);
    return { ok: true as const, revision: Number(data.revision) };
}
