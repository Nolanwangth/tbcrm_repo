import "server-only";
import { connection } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { Customer, FolderReviewStatus, FolderStatus, Level } from "@/lib/types";
type CustomerFilters = {
    level?: Level;
    status?: Customer["status"];
    id?: string;
    ids?: string[];
    summary?: boolean;
    workbench?: Customer["serviceWorkbench"] | "unassigned";
};
type DbCustomer = Record<string, unknown> & {
    travel_needs?: Record<string, unknown> | Record<string, unknown>[] | null;
    initial_scores?: Record<string, unknown> | Record<string, unknown>[] | null;
    follow_ups?: Record<string, unknown>[] | null;
    audit_logs?: Record<string, unknown>[] | null;
    level_changes?: Record<string, unknown>[] | null;
    customer_folders?: Record<string, unknown>[] | null;
    customer_files?: Record<string, unknown>[] | null;
    customer_document_links?: Record<string, unknown>[] | null;
    planning_requests?: Record<string, unknown>[] | null;
    customer_collaboration_messages?: Record<string, unknown>[] | null;
    service_assignment_events?: Record<string, unknown>[] | null;
    customer_service_handoffs?: Record<string, unknown>[] | null;
};
const one = (value: Record<string, unknown> | Record<string, unknown>[] | null | undefined) => Array.isArray(value) ? (value[0] ?? {}) : (value ?? {});
function mapCustomer(row: DbCustomer): Customer {
    const travel = one(row.travel_needs);
    const score = one(row.initial_scores);
    const followUps = (row.follow_ups ?? []).map((item) => ({
        id: String(item.id),
        summary: String(item.summary),
        communicationStatus: item.communication_status as Customer["communicationStatus"],
        createdAt: String(item.created_at),
        updatedAt: String(item.updated_at),
        previousInterval: item.previous_interval ? String(item.previous_interval) : null,
        nextCallbackAt: item.next_callback_at ? String(item.next_callback_at) : null,
        callbackNotRequired: Boolean(item.callback_not_required),
        callbackSkipReason: item.callback_skip_reason ? String(item.callback_skip_reason) : null,
    }));
    const latest = [...followUps].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    return {
        id: String(row.id),
        name: String(row.name),
        source: row.source as Customer["source"],
        sourceDetail: row.source_detail ? String(row.source_detail) : null,
        referrerName: row.referrer_name ? String(row.referrer_name) : null,
        partnerName: row.partner_name ? String(row.partner_name) : null,
        firstInquiryAt: String(row.first_inquiry_at),
        nationality: row.nationality ? String(row.nationality) : null,
        contact: row.contact ? String(row.contact) : null,
        whatsappStatus: row.whatsapp_status === "已添加"
            ? "已添加whatsapp"
            : ((row.whatsapp_status as Customer["whatsappStatus"]) ?? "未添加"),
        profile: row.profile as Customer["profile"],
        amountRange: (row.amount_range as Customer["amountRange"]) ?? null,
        expectedAmount: row.expected_amount == null ? null : Number(row.expected_amount),
        assignee: row.assignee ? String(row.assignee) : null,
        assigneeUserId: row.assignee_user_id ? String(row.assignee_user_id) : null,
        serviceWorkbench: (row.service_workbench as Customer["serviceWorkbench"]) ?? null,
        serviceAssignmentMode: (row.service_assignment_mode as Customer["serviceAssignmentMode"]) ?? null,
        serviceOwnerUserId: row.service_owner_user_id ? String(row.service_owner_user_id) : null,
        serviceAssignedAt: row.service_assigned_at ? String(row.service_assigned_at) : null,
        currentCallbackAt: row.current_callback_at ? String(row.current_callback_at) : null,
        callbackNotRequired: Boolean(row.callback_not_required),
        callbackSkipReason: row.callback_skip_reason ? String(row.callback_skip_reason) : null,
        serviceAssignmentEvents: (row.service_assignment_events ?? []).map((item) => ({
            id: String(item.id),
            action: item.action as Customer["serviceAssignmentEvents"][number]["action"],
            assignmentMode: (item.assignment_mode as Customer["serviceAssignmentMode"]) ?? null,
            fromWorkbench: (item.from_workbench as Customer["serviceWorkbench"]) ?? null,
            toWorkbench: (item.to_workbench as Customer["serviceWorkbench"]) ?? null,
            actorName: item.actor_name_snapshot ? String(item.actor_name_snapshot) : null,
            reason: item.reason ? String(item.reason) : null,
            createdAt: String(item.created_at),
        })).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        serviceHandoffs: (row.customer_service_handoffs ?? []).map((item) => ({
            id: String(item.id),
            serviceWorkbench: (item.service_workbench as Customer["serviceWorkbench"]) ?? null,
            serviceOwnerUserId: item.service_owner_user_id ? String(item.service_owner_user_id) : null,
            triggeredAt: String(item.triggered_at),
            readAt: item.read_at ? String(item.read_at) : null,
            completedAt: item.completed_at ? String(item.completed_at) : null,
            completedByName: item.completed_by_name_snapshot ? String(item.completed_by_name_snapshot) : null,
        })).sort((a, b) => b.triggeredAt.localeCompare(a.triggeredAt)),
        level: row.level as Customer["level"],
        systemSuggestedLevel: row.system_suggested_level as Customer["level"],
        priority: row.priority as Customer["priority"],
        communicationStatus: row.communication_status as Customer["communicationStatus"],
        status: row.status as Customer["status"],
        businessStage: row.business_stage as Customer["businessStage"],
        itineraryStatus: row.itinerary_status as Customer["itineraryStatus"],
        quotationStatus: row.quotation_status as Customer["quotationStatus"],
        itineraryStatusUpdatedAt: String(row.itinerary_status_updated_at),
        quotationStatusUpdatedAt: String(row.quotation_status_updated_at),
        planningRequests: (row.planning_requests ?? []).map((item) => ({
            id: String(item.id),
            requestType: item.request_type as Customer["planningRequests"][number]["requestType"],
            status: item.status as Customer["planningRequests"][number]["status"],
            content: String(item.content),
            createdAt: String(item.created_at),
        })),
        score: {
            totalScore: Number(score.total_score ?? 0),
            suggestedLevel: (score.suggested_level ?? row.system_suggested_level) as Customer["level"],
            confirmedLevel: (score.confirmed_level ?? row.level) as Customer["level"],
            filledItemCount: Number(score.filled_item_count ?? 0),
            totalItemCount: Number(score.total_item_count ?? 9),
            calculableRatio: Number(score.calculable_ratio ?? 0),
            breakdown: (score.breakdown ?? {}) as Customer["score"]["breakdown"],
            scoringVersion: String(score.scoring_version ?? "V1"),
            sEligible: Boolean(score.s_eligible),
            sEligibilityReasons: Array.isArray(score.s_eligibility_reasons)
                ? score.s_eligibility_reasons.map(String)
                : [],
        },
        travelNeed: {
            id: travel.id ? String(travel.id) : undefined,
            expectedStartDate: travel.expected_start_date ? String(travel.expected_start_date) : null,
            expectedEndDate: travel.expected_end_date ? String(travel.expected_end_date) : null,
            fuzzyTravelTime: travel.fuzzy_travel_time ? String(travel.fuzzy_travel_time) : null,
            travelerCount: travel.traveler_count ? String(travel.traveler_count) : null,
            travelDays: travel.travel_days ? String(travel.travel_days) : null,
            destinations: travel.destinations ? String(travel.destinations) : null,
            flightStatus: (travel.flight_status as Customer["travelNeed"]["flightStatus"]) ?? null,
            hotelStatus: (travel.hotel_status as Customer["travelNeed"]["hotelStatus"]) ?? null,
            serviceType: (travel.service_type as Customer["travelNeed"]["serviceType"]) ?? null,
            domesticTransportStatus: (travel.domestic_transport_status as Customer["travelNeed"]["domesticTransportStatus"]) ?? null,
            specialRequirements: travel.special_requirements ? String(travel.special_requirements) : null,
            timeClarity: (travel.time_clarity as Customer["travelNeed"]["timeClarity"]) ?? null,
            peopleClarity: (travel.people_clarity as Customer["travelNeed"]["peopleClarity"]) ?? null,
            destinationClarity: (travel.destination_clarity as Customer["travelNeed"]["destinationClarity"]) ?? null,
            daysClarity: (travel.days_clarity as Customer["travelNeed"]["daysClarity"]) ?? null,
        },
        followUps,
        collaborationMessages: (row.customer_collaboration_messages ?? []).map((item) => ({
            id: String(item.id),
            parentMessageId: item.parent_message_id ? String(item.parent_message_id) : null,
            authorId: item.author_id ? String(item.author_id) : null,
            topic: item.topic === "itinerary" || item.topic === "quotation" ? item.topic : "general",
            authorName: String(item.author_name ?? "规划师"),
            body: String(item.body),
            createdAt: String(item.created_at),
            updatedAt: String(item.updated_at ?? item.created_at),
        })),
        auditLogs: (row.audit_logs ?? []).map((item) => ({
            id: String(item.id),
            fieldName: String(item.field_name),
            oldValue: item.old_value == null ? null : String(item.old_value),
            newValue: item.new_value == null ? null : String(item.new_value),
            actorName: item.actor_name_snapshot ? String(item.actor_name_snapshot) : null,
            actorRole: (item.actor_role_snapshot as Customer["auditLogs"][number]["actorRole"]) ?? null,
            changedAt: String(item.changed_at),
        })),
        levelChanges: (row.level_changes ?? []).map((item) => ({
            id: String(item.id),
            fromLevel: (item.from_level as Customer["level"]) ?? null,
            toLevel: item.to_level as Customer["level"],
            changedAt: String(item.changed_at),
        })),
        folders: (row.customer_folders ?? []).map((item) => ({
            id: String(item.id),
            name: String(item.name),
            parentId: item.parent_id ? String(item.parent_id) : null,
            workflowStatusEnabled: item.workflow_status_enabled !== false,
            status: (item.status as FolderStatus) ?? "待发送",
            reviewStatus: (item.review_status as FolderReviewStatus) ?? "待审核",
            statusHistory: ((item.customer_folder_status_history as Record<string, unknown>[] | null) ?? [])
                .map((history) => ({
                id: String(history.id),
                oldStatus: history.old_status as FolderStatus,
                newStatus: history.new_status as FolderStatus,
                changedAt: String(history.changed_at),
            }))
                .sort((a, b) => b.changedAt.localeCompare(a.changedAt)),
            createdAt: String(item.created_at),
        })),
        files: (row.customer_files ?? []).map((item) => ({
            id: String(item.id),
            name: String(item.name),
            folderId: item.folder_id ? String(item.folder_id) : null,
            storagePath: String(item.storage_path),
            sizeBytes: Number(item.size_bytes),
            mimeType: item.mime_type ? String(item.mime_type) : null,
            createdAt: String(item.created_at),
        })),
        documentStatus: {
            contract: (row.customer_document_links ?? []).some((item) => item.document_type === "contract" && !item.replaced_at),
            proformaInvoice: (row.customer_document_links ?? []).some((item) => item.document_type === "proforma_invoice" && !item.replaced_at),
        },
        latestFollowUpAt: latest?.updatedAt ?? (row.latest_follow_up_at ? String(row.latest_follow_up_at) : null),
        latestFollowUpSummary: latest?.summary ?? null,
        wonAt: row.won_at ? String(row.won_at) : null,
        wonAmount: row.won_amount == null ? null : Number(row.won_amount),
        closedAt: row.closed_at ? String(row.closed_at) : null,
        closeReason: row.close_reason ? String(row.close_reason) : null,
        updatedAt: String(row.updated_at),
        createdAt: String(row.created_at),
    };
}
export async function getCustomers(filters: CustomerFilters = {}) {
    await connection();
    const supabase = getSupabaseAdmin();
    let query = supabase
        .from("customers")
        .select(filters.summary
        ? "*, travel_needs(*), follow_ups(summary,updated_at), customer_document_links(document_type,replaced_at)"
        : "*, travel_needs(*), initial_scores(*), follow_ups(*), audit_logs(*), level_changes(*), customer_folders(*, customer_folder_status_history(*)), customer_files(*), customer_document_links(document_type,replaced_at), planning_requests(*), customer_collaboration_messages(*), service_assignment_events(*), customer_service_handoffs(*)")
        .order("updated_at", { ascending: false });
    if (filters.id)
        query = query.eq("id", filters.id);
    if (filters.ids?.length)
        query = query.in("id", filters.ids);
    if (filters.level)
        query = query.eq("level", filters.level);
    if (filters.status)
        query = query.eq("status", filters.status);
    if (filters.workbench === "unassigned")
        query = query.is("service_workbench", null);
    else if (filters.workbench)
        query = query.eq("service_workbench", filters.workbench);
    query = query.order("updated_at", { referencedTable: "follow_ups", ascending: false });
    if (filters.summary)
        query = query.limit(1, { referencedTable: "follow_ups" });
    else
        query = query
            .order("changed_at", { referencedTable: "audit_logs", ascending: false })
            .order("changed_at", { referencedTable: "level_changes", ascending: false })
            .order("created_at", { referencedTable: "planning_requests", ascending: false });
    const { data, error } = await query;
    if (error)
        throw new Error(`读取客户失败：${error.message}`);
    return { customers: (data as unknown as DbCustomer[]).map(mapCustomer) };
}
export async function getExpectedAmountMetrics(start: Date, end: Date) {
    await connection();
    const supabase = getSupabaseAdmin();
    const pageSize = 1000;
    let offset = 0;
    let total = 0;
    let filled = 0;
    let missing = 0;
    while (true) {
        const { data, error } = await supabase
            .from("customers")
            .select("id,expected_amount")
            .eq("status", "跟进中")
            .gte("first_inquiry_at", start.toISOString())
            .lte("first_inquiry_at", end.toISOString())
            .order("id")
            .range(offset, offset + pageSize - 1);
        if (error)
            throw new Error(`读取预计金额统计失败：${error.message}`);
        for (const row of data ?? []) {
            const amount = Number(row.expected_amount ?? 0);
            if (amount > 0) {
                total += amount;
                filled += 1;
            }
            else {
                missing += 1;
            }
        }
        if (!data || data.length < pageSize)
            break;
        offset += pageSize;
    }
    return {
        total,
        filled,
        missing,
    };
}
export async function getCustomer(id: string) {
    const result = await getCustomers({ id });
    return { customer: result.customers[0] ?? null };
}
