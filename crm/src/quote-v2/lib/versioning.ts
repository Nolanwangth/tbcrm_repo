import type { DirectQuote, ProposalPlan, SavedDirectQuote, SavedProposal } from "../types";
import { createId } from "./id";
import { deepClone } from "./deepClone";
type LegacySavedProposal = Omit<SavedProposal, "customerName" | "proposalName" | "version"> & {
    customerName?: string;
    proposalName?: string;
    version?: number;
};
const clean = (value: string) => value.trim().replace(/\s+/g, " ");
const groupKey = (customerName: string, proposalName: string) => `${clean(customerName).toLocaleLowerCase()}::${clean(proposalName).toLocaleLowerCase()}`;
export function normalizeSavedProposals(records: LegacySavedProposal[]): SavedProposal[] {
    const existingMax = new Map<string, number>();
    records.forEach((record) => {
        if (!record.customerName || !record.proposalName || !record.version)
            return;
        const key = groupKey(record.customerName, record.proposalName);
        existingMax.set(key, Math.max(existingMax.get(key) ?? 0, record.version));
    });
    const migratedVersions = new Map(existingMax);
    return records.map((record) => {
        const customerName = clean(record.customerName || "未分类客户");
        const proposalName = clean(record.proposalName || record.title || record.plan.title || "未命名方案");
        const key = groupKey(customerName, proposalName);
        const version = record.version && record.version > 0
            ? record.version
            : (migratedVersions.get(key) ?? 0) + 1;
        migratedVersions.set(key, Math.max(migratedVersions.get(key) ?? 0, version));
        return {
            ...record,
            customerName,
            proposalName,
            version,
            title: record.title || proposalName,
        };
    });
}
export function nextProposalVersion(records: SavedProposal[], customerName: string, proposalName: string): number {
    const key = groupKey(customerName, proposalName);
    return records
        .filter((record) => groupKey(record.customerName, record.proposalName) === key)
        .reduce((highest, record) => Math.max(highest, record.version), 0) + 1;
}
export function createSavedVersion(input: {
    customerName: string;
    proposalName: string;
    versionNote?: string;
    plan: ProposalPlan;
    savedProposals: SavedProposal[];
}): SavedProposal {
    const inputCustomerName = clean(input.customerName);
    const inputProposalName = clean(input.proposalName);
    const existingGroup = input.savedProposals.find((record) => groupKey(record.customerName, record.proposalName) === groupKey(inputCustomerName, inputProposalName));
    const customerName = existingGroup?.customerName ?? inputCustomerName;
    const proposalName = existingGroup?.proposalName ?? inputProposalName;
    const version = nextProposalVersion(input.savedProposals, customerName, proposalName);
    const plan = { ...input.plan, title: proposalName, updatedAt: new Date().toISOString() };
    return {
        id: createId(),
        title: proposalName,
        customerName,
        proposalName,
        version,
        versionNote: clean(input.versionNote || "") || undefined,
        savedAt: new Date().toISOString(),
        plan,
    };
}
export function addSavedVersion(records: SavedProposal[], saved: SavedProposal, maxPerProposal = 30): SavedProposal[] {
    const key = groupKey(saved.customerName, saved.proposalName);
    const sameGroup = [saved, ...records.filter((record) => groupKey(record.customerName, record.proposalName) === key)]
        .sort((a, b) => b.version - a.version)
        .slice(0, maxPerProposal);
    const otherGroups = records.filter((record) => groupKey(record.customerName, record.proposalName) !== key);
    return [...sameGroup, ...otherGroups].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}
export function duplicateSavedVersion(records: SavedProposal[], source: SavedProposal): SavedProposal {
    return createSavedVersion({
        customerName: source.customerName,
        proposalName: source.proposalName,
        versionNote: `复制自 V${source.version}${source.versionNote ? ` · ${source.versionNote}` : ""}`,
        plan: deepClone(source.plan),
        savedProposals: records,
    });
}
export function normalizeSavedDirectQuotes(records: SavedDirectQuote[]): SavedDirectQuote[] {
    return records.map((record) => ({
        ...record,
        customerName: clean(record.customerName || "未分类客户"),
        proposalName: clean(record.proposalName || record.title || "未命名直接报价"),
        title: record.title || record.proposalName || "未命名直接报价",
        version: Math.max(1, record.version || 1),
        costsHidden: Boolean(record.costsHidden),
    }));
}
export function nextDirectQuoteVersion(records: SavedDirectQuote[], customerName: string, proposalName: string): number {
    const key = groupKey(customerName, proposalName);
    return records
        .filter((record) => groupKey(record.customerName, record.proposalName) === key)
        .reduce((highest, record) => Math.max(highest, record.version), 0) + 1;
}
export function createSavedDirectQuoteVersion(input: {
    customerName: string;
    proposalName: string;
    versionNote?: string;
    groupId?: string;
    quote: DirectQuote;
    costsHidden: boolean;
    savedDirectQuotes: SavedDirectQuote[];
}): SavedDirectQuote {
    const inputCustomerName = clean(input.customerName);
    const inputProposalName = clean(input.proposalName);
    const existingGroup = input.savedDirectQuotes.find((record) => groupKey(record.customerName, record.proposalName) === groupKey(inputCustomerName, inputProposalName));
    const customerName = existingGroup?.customerName ?? inputCustomerName;
    const proposalName = existingGroup?.proposalName ?? inputProposalName;
    const version = nextDirectQuoteVersion(input.savedDirectQuotes, customerName, proposalName);
    const quote = { ...deepClone(input.quote), updatedAt: new Date().toISOString() };
    return {
        id: createId(),
        title: proposalName,
        customerName,
        proposalName,
        version,
        versionNote: clean(input.versionNote || "") || undefined,
        savedAt: new Date().toISOString(),
        quote,
        costsHidden: input.costsHidden,
        groupId: input.groupId,
    };
}
export function addSavedDirectQuoteVersion(records: SavedDirectQuote[], saved: SavedDirectQuote, maxPerProposal = 30): SavedDirectQuote[] {
    const key = groupKey(saved.customerName, saved.proposalName);
    const sameGroup = [saved, ...records.filter((record) => groupKey(record.customerName, record.proposalName) === key)]
        .sort((a, b) => b.version - a.version)
        .slice(0, maxPerProposal);
    const otherGroups = records.filter((record) => groupKey(record.customerName, record.proposalName) !== key);
    return [...sameGroup, ...otherGroups].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}
export function duplicateSavedDirectQuoteVersion(records: SavedDirectQuote[], source: SavedDirectQuote): SavedDirectQuote {
    return createSavedDirectQuoteVersion({
        customerName: source.customerName,
        proposalName: source.proposalName,
        versionNote: `复制自 V${source.version}${source.versionNote ? ` · ${source.versionNote}` : ""}`,
        quote: source.quote,
        costsHidden: source.costsHidden,
        groupId: source.groupId,
        savedDirectQuotes: records,
    });
}
