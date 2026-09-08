import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
let client: SupabaseClient | null = null;
function getSupabaseUrl() {
    return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
}
export function isSupabaseConfigured() {
    return Boolean(getSupabaseUrl() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
export function requireSupabaseConfigured() {
    if (!isSupabaseConfigured()) {
        throw new Error("尚未配置 Supabase。请在本地 .env.local 中填写项目凭证。");
    }
}
export function getSupabaseAdmin() {
    if (client)
        return client;
    requireSupabaseConfigured();
    const url = getSupabaseUrl()!;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    client = createClient(url, serviceRole, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    return client;
}
