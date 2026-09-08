import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { LegacyProposalPreview } from "@/components/legacy-proposal-preview";
import type { ProposalDraftInput } from "@/lib/proposals";
export default async function LegacyProposalPage({ params }: {
    params: Promise<{
        versionId: string;
    }>;
}) {
    if (!await getCurrentUser())
        redirect('/login');
    const { versionId } = await params;
    const { data } = await getSupabaseAdmin().from('customer_proposal_versions').select('snapshot').eq('id', versionId).single();
    if (!data || data.snapshot?.schemaVersion === 2)
        notFound();
    const snapshot = data.snapshot as ProposalDraftInput;
    return <div className="space-y-5"><Link href={`/customers/${snapshot.customerId}`} className="text-sm underline">← 返回客户档案</Link><h1 className="text-2xl font-semibold">旧版正式方案</h1><LegacyProposalPreview snapshot={snapshot}/></div>;
}
