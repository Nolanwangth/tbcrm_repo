import type { CollaborationMessage } from "@/lib/types";
export function buildCollaborationThreads(messages: CollaborationMessage[]) {
    const byId = new Map(messages.map((message) => [message.id, message]));
    const rootId = (message: CollaborationMessage) => {
        let current = message;
        const visited = new Set<string>();
        while (current.parentMessageId && byId.has(current.parentMessageId) && !visited.has(current.id)) {
            visited.add(current.id);
            current = byId.get(current.parentMessageId)!;
        }
        return current.id;
    };
    const groups = new Map<string, CollaborationMessage[]>();
    for (const message of messages) {
        const id = rootId(message);
        groups.set(id, [...(groups.get(id) ?? []), message]);
    }
    return [...groups.entries()].map(([id, entries]) => ({
        root: byId.get(id) ?? entries[0],
        replies: entries.filter((entry) => entry.id !== id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    })).sort((a, b) => b.root.createdAt.localeCompare(a.root.createdAt));
}
