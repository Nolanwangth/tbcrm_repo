import { NextResponse } from "next/server";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
export const dynamic = "force-dynamic";
export async function GET() {
    const checkedAt = new Date().toISOString();
    if (!isSupabaseConfigured()) {
        return NextResponse.json({ ok: false, service: "tripbook-crm", database: "not_configured", checkedAt }, { status: 503 });
    }
    try {
        const { error } = await getSupabaseAdmin().from("customers").select("id").limit(1);
        if (error)
            throw error;
        return NextResponse.json({ ok: true, service: "tripbook-crm", database: "ok", checkedAt });
    }
    catch {
        return NextResponse.json({ ok: false, service: "tripbook-crm", database: "unavailable", checkedAt }, { status: 503 });
    }
}
