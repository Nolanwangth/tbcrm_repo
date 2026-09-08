import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionCookieName, sessionCookieSecure } from "@/lib/auth-cookie";
describe("session cookie configuration", () => {
    afterEach(() => vi.unstubAllEnvs());
    it("uses separate default names for production and development", () => {
        vi.stubEnv("NODE_ENV", "production");
        expect(sessionCookieName()).toBe("crm_session");
        vi.stubEnv("NODE_ENV", "development");
        expect(sessionCookieName()).toBe("crm_session_dev");
    });
    it("allows an explicit cookie name", () => {
        vi.stubEnv("CRM_SESSION_COOKIE_NAME", "crm_session_server_a");
        expect(sessionCookieName()).toBe("crm_session_server_a");
    });
    it("does not mark HTTP LAN cookies secure unless explicitly enabled", () => {
        vi.stubEnv("CRM_SESSION_COOKIE_SECURE", "false");
        expect(sessionCookieSecure()).toBe(false);
        vi.stubEnv("CRM_SESSION_COOKIE_SECURE", "true");
        expect(sessionCookieSecure()).toBe(true);
    });
});
