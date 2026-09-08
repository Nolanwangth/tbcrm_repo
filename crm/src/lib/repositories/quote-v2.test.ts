import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const { from, calls, snapshots, state } = vi.hoisted(() => ({ state: { status: 'draft' }, from: vi.fn(), calls: [] as {
        table: string;
        select: string;
        filters: Record<string, unknown>;
    }[], snapshots: { draft: { schemaVersion: 2, title: "draft" }, version: { schemaVersion: 2, title: "frozen" } } }));
vi.mock("@/lib/supabase/admin", () => ({ getSupabaseAdmin: () => ({ from }) }));
import { getQuoteV2Bootstrap } from "./quote-v2";
const customer = { id: "customer", name: "Test", status: "已成交", travelerCount: null, startDate: null, endDate: null, party: null };
beforeEach(() => {
    calls.length = 0;
    state.status = 'draft';
    from.mockImplementation((table: string) => {
        const call = { table, select: "", filters: {} as Record<string, unknown> };
        calls.push(call);
        const result = () => ({ error: null, data: table === 'crm_quote_v2_catalog' ? [] : table === 'crm_quote_v2_groups' ? [] : call.select === 'snapshot' ? { snapshot: snapshots.version } : call.select === 'snapshot:editor_snapshot' ? { snapshot: snapshots.draft } : [{ id: 'draft', title: 'Test', status: state.status, editor_schema: 2, group_id: 'group', edit_revision: 3, updated_at: '2026-09-08', customer_proposal_versions: [{ id: 'version', version_number: 1, version_note: 'Frozen', schema_version: '2', group_id: 'group', published_at: '2026-09-07' }] }] });
        const query = { select: (s: string) => { call.select = s; return query; }, eq: (key: string, value: unknown) => { call.filters[key] = value; return query; }, order: () => query, single: async () => result(), then: (resolve: (v: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve) };
        return query;
    });
});
it('loads only the latest draft snapshot and keeps history lightweight', async () => {
    const data = await getQuoteV2Bootstrap(customer, 'quotation');
    expect(data.drafts[0].snapshot).toEqual(snapshots.draft);
    expect(data.versions[0].snapshot).toBeUndefined();
    expect(data.versions[0]).toMatchObject({ schemaVersion: 2, groupId: 'group' });
    expect(calls.filter(c => c.select === 'snapshot:editor_snapshot')).toHaveLength(1);
    expect(calls.find(c => c.table === 'customer_proposals')?.select).not.toContain(',editor_snapshot,');
});
it('loads the selected frozen version, not other draft payloads', async () => {
    const data = await getQuoteV2Bootstrap(customer, 'quotation', { versionId: 'version' });
    expect(data.versions[0].snapshot).toEqual(snapshots.version);
    expect(data.drafts[0].snapshot).toBeUndefined();
    expect(calls.at(-1)?.filters).toEqual({ id: 'version', proposal_id: 'draft' });
});
it('rejects a version outside the customer/tool list without fetching it', async () => {
    await expect(getQuoteV2Bootstrap(customer, 'quotation', { versionId: 'other' })).rejects.toThrow('不属于');
    expect(calls.some(c => c.select === 'snapshot')).toBe(false);
});
it('rejects a missing draft instead of silently opening a different one', async () => {
    await expect(getQuoteV2Bootstrap(customer, 'itinerary', { draftId: 'missing' })).rejects.toThrow('不属于');
});
it('opens the frozen version when refreshing a draft URL after publishing', async () => {
    state.status = 'published';
    const data = await getQuoteV2Bootstrap(customer, 'quotation', { draftId: 'draft' });
    expect(data.drafts).toHaveLength(0);
    expect(data.versions[0].snapshot).toEqual(snapshots.version);
});
