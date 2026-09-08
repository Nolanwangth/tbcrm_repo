import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { QuoteVersionPrint } from "@/components/quote-version-print";
import type { QuoteV2Snapshot } from "@/lib/quote-v2";
export default async function QuotePrintPage({ params }: {
    params: Promise<{
        versionId: string;
    }>;
}) {
    if (!await getCurrentUser())
        redirect('/login');
    const { versionId } = await params;
    const { data } = await getSupabaseAdmin().from('customer_proposal_versions').select('snapshot').eq('id', versionId).single();
    if (!data || data.snapshot?.schemaVersion !== 2)
        notFound();
    return <QuoteVersionPrint snapshot={data.snapshot as QuoteV2Snapshot}/>;
}
