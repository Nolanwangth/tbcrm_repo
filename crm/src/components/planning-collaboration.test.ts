import { describe, expect, it } from "vitest";
import { buildCollaborationThreads } from "@/lib/collaboration-threads";
import type { CollaborationMessage } from "@/lib/types";
function message(id: string, parentMessageId: string | null, createdAt: string): CollaborationMessage {
    return { id, parentMessageId, authorId: id, authorName: id, topic: "itinerary", body: `留言${id}`, createdAt, updatedAt: createdAt };
}
describe("折叠留言讨论串", () => {
    it("多层回复归入同一顶层讨论串并保持时间顺序", () => {
        const threads = buildCollaborationThreads([
            message("reply-2", "reply-1", "2026-08-18T03:00:00.000Z"),
            message("root", null, "2026-08-18T01:00:00.000Z"),
            message("reply-1", "root", "2026-08-18T02:00:00.000Z"),
        ]);
        expect(threads).toHaveLength(1);
        expect(threads[0].root.id).toBe("root");
        expect(threads[0].replies.map((entry) => entry.id)).toEqual(["reply-1", "reply-2"]);
    });
    it("找不到父留言时作为独立顶层讨论串展示", () => {
        const threads = buildCollaborationThreads([message("orphan", "missing", "2026-08-18T01:00:00.000Z")]);
        expect(threads[0].root.id).toBe("orphan");
        expect(threads[0].replies).toHaveLength(0);
    });
});
