import type { AMOUNT_RANGES, BUSINESS_STAGES, CLARITY_LEVELS, COMMUNICATION_EFFECTIVENESS, COMMUNICATION_STATUSES, CUSTOMER_LEVELS, CUSTOMER_STATUSES, DOMESTIC_TRANSPORT_STATUSES, FLIGHT_STATUSES, FOLDER_REVIEW_STATUSES, FOLDER_STATUSES, HOTEL_STATUSES, ITINERARY_STATUSES, PLANNING_REQUEST_TYPES, PRIORITIES, PROFILES, QUOTATION_STATUSES, SERVICE_ASSIGNMENT_MODES, SERVICE_TYPES, SERVICE_WORKBENCHES, SOURCES, WHATSAPP_STATUSES, } from "@/lib/constants";
export type Level = (typeof CUSTOMER_LEVELS)[number];
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];
export type BusinessStage = (typeof BUSINESS_STAGES)[number];
export type ItineraryStatus = (typeof ITINERARY_STATUSES)[number];
export type QuotationStatus = (typeof QUOTATION_STATUSES)[number];
export type PlanningRequestType = (typeof PLANNING_REQUEST_TYPES)[number];
export type FolderStatus = (typeof FOLDER_STATUSES)[number];
export type FolderReviewStatus = (typeof FOLDER_REVIEW_STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type CommunicationStatus = (typeof COMMUNICATION_STATUSES)[number];
export type Source = (typeof SOURCES)[number];
export type WhatsappStatus = (typeof WHATSAPP_STATUSES)[number];
export type CustomerProfile = (typeof PROFILES)[number];
export type AmountRange = (typeof AMOUNT_RANGES)[number];
export type FlightStatus = (typeof FLIGHT_STATUSES)[number];
export type HotelStatus = (typeof HOTEL_STATUSES)[number];
export type ServiceType = (typeof SERVICE_TYPES)[number];
export type DomesticTransportStatus = (typeof DOMESTIC_TRANSPORT_STATUSES)[number];
export type Clarity = (typeof CLARITY_LEVELS)[number];
export type CommunicationEffectiveness = (typeof COMMUNICATION_EFFECTIVENESS)[number];
export type ServiceWorkbench = (typeof SERVICE_WORKBENCHES)[number];
export type PlannerWorkbench = ServiceWorkbench;
export type ServiceAssignmentMode = (typeof SERVICE_ASSIGNMENT_MODES)[number];
export const CRM_USER_ROLES = ["planner", "operations", "admin"] as const;
export type CrmUserRole = (typeof CRM_USER_ROLES)[number];
export interface CrmUserSummary {
    id: string;
    username: string;
    displayName: string;
    role: CrmUserRole;
    active: boolean;
}
export interface ServiceAssignmentEvent {
    id: string;
    action: "auto_assigned" | "exclusive_assigned" | "manually_assigned" | "reassigned" | "exclusive_unlocked" | "assignment_failed";
    assignmentMode?: ServiceAssignmentMode | null;
    fromWorkbench?: ServiceWorkbench | null;
    toWorkbench?: ServiceWorkbench | null;
    actorName?: string | null;
    reason?: string | null;
    createdAt: string;
}
export interface TravelNeed {
    id?: string;
    expectedStartDate?: string | null;
    expectedEndDate?: string | null;
    fuzzyTravelTime?: string | null;
    travelerCount?: string | null;
    travelDays?: string | null;
    destinations?: string | null;
    flightStatus?: FlightStatus | null;
    hotelStatus?: HotelStatus | null;
    serviceType?: ServiceType | null;
    domesticTransportStatus?: DomesticTransportStatus | null;
    specialRequirements?: string | null;
    timeClarity?: Clarity | null;
    peopleClarity?: Clarity | null;
    destinationClarity?: Clarity | null;
    daysClarity?: Clarity | null;
}
export interface ScoreBreakdown {
    travelReadiness: number | null;
    communication: number | null;
    demandClarity: number | null;
    profile: number | null;
    amount: number | null;
}
export interface InitialScore {
    totalScore: number;
    suggestedLevel: Level;
    confirmedLevel: Level;
    filledItemCount: number;
    totalItemCount: number;
    calculableRatio: number;
    breakdown: ScoreBreakdown;
    scoringVersion: string;
    sEligible: boolean;
    sEligibilityReasons: string[];
}
export interface FollowUp {
    id: string;
    summary: string;
    communicationStatus: CommunicationStatus;
    createdAt: string;
    updatedAt: string;
    previousInterval?: string | null;
    nextCallbackAt?: string | null;
    callbackNotRequired: boolean;
    callbackSkipReason?: string | null;
}
export interface CollaborationMessage {
    id: string;
    parentMessageId?: string | null;
    authorId?: string | null;
    topic?: "itinerary" | "quotation" | "general" | null;
    authorName: string;
    body: string;
    createdAt: string;
    updatedAt: string;
}
export interface AuditLog {
    id: string;
    fieldName: string;
    oldValue: string | null;
    newValue: string | null;
    actorName?: string | null;
    actorRole?: CrmUserRole | "service" | null;
    changedAt: string;
}
export interface ServiceHandoff {
    id: string;
    serviceWorkbench?: ServiceWorkbench | null;
    serviceOwnerUserId?: string | null;
    triggeredAt: string;
    readAt?: string | null;
    completedAt?: string | null;
    completedByName?: string | null;
}
export interface LevelChange {
    id: string;
    fromLevel: Level | null;
    toLevel: Level;
    changedAt: string;
}
export interface CustomerFile {
    id: string;
    name: string;
    folderId: string | null;
    storagePath: string;
    sizeBytes: number;
    mimeType: string | null;
    createdAt: string;
}
export interface CustomerFolder {
    id: string;
    name: string;
    parentId: string | null;
    workflowStatusEnabled?: boolean;
    status: FolderStatus;
    reviewStatus: FolderReviewStatus;
    statusHistory: CustomerFolderStatusHistory[];
    createdAt: string;
}
export interface CustomerFolderStatusHistory {
    id: string;
    oldStatus: FolderStatus;
    newStatus: FolderStatus;
    changedAt: string;
}
export interface PlanningRequest {
    id: string;
    requestType: PlanningRequestType;
    status: ItineraryStatus | QuotationStatus;
    content: string;
    createdAt: string;
}
export interface Customer {
    id: string;
    name: string;
    source: Source;
    sourceDetail?: string | null;
    referrerName?: string | null;
    partnerName?: string | null;
    firstInquiryAt: string;
    nationality?: string | null;
    contact?: string | null;
    whatsappStatus: WhatsappStatus;
    profile: CustomerProfile;
    amountRange?: AmountRange | null;
    expectedAmount?: number | null;
    assignee?: string | null;
    assigneeUserId?: string | null;
    serviceWorkbench?: ServiceWorkbench | null;
    serviceAssignmentMode?: ServiceAssignmentMode | null;
    serviceOwnerUserId?: string | null;
    serviceAssignedAt?: string | null;
    currentCallbackAt?: string | null;
    callbackNotRequired: boolean;
    callbackSkipReason?: string | null;
    serviceAssignmentEvents: ServiceAssignmentEvent[];
    serviceHandoffs: ServiceHandoff[];
    level: Level;
    systemSuggestedLevel: Level;
    priority: Priority;
    communicationStatus: CommunicationStatus;
    status: CustomerStatus;
    businessStage: BusinessStage;
    itineraryStatus: ItineraryStatus;
    quotationStatus: QuotationStatus;
    itineraryStatusUpdatedAt: string;
    quotationStatusUpdatedAt: string;
    planningRequests: PlanningRequest[];
    score: InitialScore;
    travelNeed: TravelNeed;
    followUps: FollowUp[];
    collaborationMessages: CollaborationMessage[];
    auditLogs: AuditLog[];
    levelChanges: LevelChange[];
    folders?: CustomerFolder[];
    files?: CustomerFile[];
    documentStatus?: {
        contract: boolean;
        proformaInvoice: boolean;
    };
    latestFollowUpAt?: string | null;
    latestFollowUpSummary?: string | null;
    wonAt?: string | null;
    wonAmount?: number | null;
    closedAt?: string | null;
    closeReason?: string | null;
    updatedAt: string;
    createdAt: string;
}
