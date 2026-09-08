import { notFound, redirect } from "next/navigation";
import { PageHeading } from "@/components/page-heading";
import { QuoteV2Workbench } from "@/components/quote-v2-workbench";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { getQuoteV2Bootstrap } from "@/lib/repositories/quote-v2";
import type { QuoteV2Customer } from "@/lib/quote-v2";
export default async function PlannerToolPage({ params, searchParams }: {
    params: Promise<{
        kind: string;
    }>;
    searchParams: Promise<{
        customerId?: string;
        versionId?: string;
        draftId?: string;
    }>;
}) {
    const { kind } = await params;
    if (kind !== "quotation" && kind !== "itinerary")
        notFound();
    const user = await getCurrentUser();
    if (!user)
        redirect('/login');
    const selected = await searchParams;
    if (selected.versionId) {
        const { data: version } = await getSupabaseAdmin().from('customer_proposal_versions').select('schema_version:snapshot->>schemaVersion').eq('id', selected.versionId).maybeSingle();
        if (!version)
            notFound();
        if (Number(version.schema_version) !== 2)
            redirect(`/planner/legacy/${selected.versionId}`);
    }
    const [customerRows, travelers, cases] = await Promise.all([getSupabaseAdmin().from('customers').select('id,name,status,travel_needs(traveler_count,expected_start_date,expected_end_date)').order('updated_at', { ascending: false }), getSupabaseAdmin().from('operation_travelers').select('traveler_type,case_id'), getSupabaseAdmin().from('operation_cases').select('id,customer_id').in('record_status', ['draft', 'active']).order('created_at', { ascending: false })]);
    if (customerRows.error)
        throw new Error(customerRows.error.message);
    if (travelers.error)
        throw new Error(travelers.error.message);
    if (cases.error)
        throw new Error(cases.error.message);
    const choices: QuoteV2Customer[] = (customerRows.data ?? []).map(c => {
        const travel = Array.isArray(c.travel_needs) ? c.travel_needs[0] : c.travel_needs;
        const currentCase = cases.data?.find(row => row.customer_id === c.id);
        const members = (travelers.data ?? []).filter(t => t.case_id === currentCase?.id);
        return { id: c.id, name: c.name, status: c.status, travelerCount: travel?.traveler_count ?? null, startDate: travel?.expected_start_date ?? null, endDate: travel?.expected_end_date ?? null, party: members.length ? { adults: members.filter(t => t.traveler_type === 'adult').length, children: members.filter(t => t.traveler_type === 'child').length, seniors: members.filter(t => t.traveler_type === 'senior').length } : null };
    });
    const customer = choices.find(c => c.id === selected.customerId);
    if (selected.customerId && !customer)
        notFound();
    const data = customer ? await getQuoteV2Bootstrap(customer, kind, selected) : undefined;
    return <><PageHeading title={kind === 'quotation' ? '报价制作' : '行程制作'} description="基于 Quick Tour Proposal 新版 2.0，使用 CRM 本地价格库、模板、草稿和不可变正式版本。"/><QuoteV2Workbench customers={choices} data={data} kind={kind} initialVersionId={selected.versionId} userId={user.id}/></>;
}
