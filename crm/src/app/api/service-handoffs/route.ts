import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
export async function GET() {
    const user = await getCurrentUser();
    if (!user)
        return NextResponse.json({ error: "未登录" }, { status: 401 });
    if (user.role !== "planner")
        return NextResponse.json({ handoffs: [] });
    const { data, error } = await getSupabaseAdmin().from("customer_service_handoffs")
        .select("id,customer_id,triggered_at,customers(name)")
        .eq("service_owner_user_id", user.id).is("completed_at", null).is("read_at", null)
        .order("triggered_at", { ascending: false });
    if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ handoffs: (data ?? []).map((item) => {
            const customer = item.customers as unknown as {
                name?: string;
            } | Array<{
                name?: string;
            }> | null;
            return { id: item.id, customerId: item.customer_id, customerName: Array.isArray(customer) ? customer[0]?.name : customer?.name, triggeredAt: item.triggered_at };
        }) });
}
export async function POST(request: Request) {
    const user = await getCurrentUser();
    if (!user || user.role !== "planner")
        return NextResponse.json({ error: "未授权" }, { status: 401 });
    const body = await request.json().catch(() => null);
    if (!body?.id)
        return NextResponse.json({ error: "缺少提醒编号" }, { status: 400 });
    const { error } = await getSupabaseAdmin().from("customer_service_handoffs")
        .update({ read_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", body.id).eq("service_owner_user_id", user.id).is("completed_at", null);
    if (error)
        return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
}
