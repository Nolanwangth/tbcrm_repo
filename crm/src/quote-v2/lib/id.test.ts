import { afterEach, describe, expect, it, vi } from "vitest";
import { createId } from "./id";
afterEach(() => {
    vi.unstubAllGlobals();
});
describe("createId", () => {
    it("works on an insecure LAN origin where crypto.randomUUID is unavailable", () => {
        let next = 0;
        vi.stubGlobal("crypto", {
            getRandomValues: (bytes: Uint8Array) => {
                bytes.forEach((_, index) => {
                    bytes[index] = next;
                    next += 1;
                });
                return bytes;
            },
        });
        expect(createId()).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
    });
});
