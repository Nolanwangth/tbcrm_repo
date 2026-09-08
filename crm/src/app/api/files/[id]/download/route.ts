import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
const bucket = () => process.env.SUPABASE_STORAGE_BUCKET || "crm-files";
export async function GET(request: Request, { params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    if (!await getCurrentUser())
        return NextResponse.json({ error: "请先登录" }, { status: 401 });
    const { id } = await params;
    const supabase = getSupabaseAdmin();
    const { data: file, error: fileError } = await supabase
        .from("customer_files")
        .select("name,storage_path,mime_type")
        .eq("id", id)
        .single();
    if (fileError || !file) {
        return NextResponse.json({ error: "文件不存在" }, { status: 404 });
    }
    const { data, error } = await supabase.storage.from(bucket()).download(file.storage_path);
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 502 });
    }
    const encodedName = encodeURIComponent(file.name);
    const safePreview = /^(application\/pdf|image\/(png|jpeg|webp|gif))$/.test(file.mime_type ?? "");
    const disposition = safePreview && new URL(request.url).searchParams.get("inline") === "1" ? "inline" : "attachment";
    return new Response(data, {
        headers: {
            "Content-Type": file.mime_type || data.type || "application/octet-stream",
            "Content-Disposition": `${disposition}; filename*=UTF-8''${encodedName}`,
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    });
}
