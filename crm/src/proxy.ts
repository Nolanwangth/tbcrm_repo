import { NextResponse, type NextRequest } from "next/server";
import { sessionCookieName } from "@/lib/auth-cookie";
async function sha256(value: string) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function sessionIsValid(request: NextRequest) {
    const token = request.cookies.get(sessionCookieName())?.value;
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!token || !url || !key)
        return false;
    const tokenHash = await sha256(token);
    const query = new URLSearchParams({
        select: "token_hash,crm_users!inner(active,must_change_password)",
        token_hash: `eq.${tokenHash}`,
        expires_at: `gt.${new Date().toISOString()}`,
        "crm_users.active": "eq.true",
    });
    const response = await fetch(`${url}/rest/v1/crm_auth_sessions?${query}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok)
        throw new Error("SESSION_SERVICE_UNAVAILABLE");
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0)
        return false;
    return { mustChangePassword: Boolean(rows[0].crm_users.must_change_password) };
}
export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const isLogin = pathname === "/login";
    let hasSession: false | {
        mustChangePassword: boolean;
    };
    try {
        hasSession = await sessionIsValid(request);
    }
    catch {
        return NextResponse.json({ error: "登录服务暂时不可用，请稍后重试；当前会话未被清除。" }, { status: 503, headers: { "Retry-After": "5" } });
    }
    if (hasSession && hasSession.mustChangePassword && !["/change-password", "/login"].includes(pathname)) {
        if (pathname.startsWith("/api/"))
            return NextResponse.json({ error: "请先修改临时密码" }, { status: 403 });
        return NextResponse.redirect(new URL("/change-password", request.url));
    }
    if (!hasSession && !isLogin && !pathname.startsWith("/_next") && pathname !== "/favicon.ico") {
        if (pathname.startsWith("/api/")) {
            return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
        }
        const response = NextResponse.redirect(new URL(`/login?returnTo=${encodeURIComponent(pathname + request.nextUrl.search)}`, request.url));
        response.cookies.delete(sessionCookieName());
        return response;
    }
    return NextResponse.next();
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
