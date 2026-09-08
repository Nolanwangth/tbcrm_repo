const PROD_COOKIE = "crm_session";
const DEV_COOKIE = "crm_session_dev";
export function sessionCookieName() {
    const configured = process.env.CRM_SESSION_COOKIE_NAME?.trim();
    if (configured)
        return configured;
    return process.env.NODE_ENV === "production" ? PROD_COOKIE : DEV_COOKIE;
}
export function sessionCookieSecure() {
    return process.env.CRM_SESSION_COOKIE_SECURE?.trim().toLowerCase() === "true";
}
