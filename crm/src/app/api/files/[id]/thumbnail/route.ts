import { getCurrentUser } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { renderPdfThumbnail } from '@/lib/document-renderer';
import sharp from 'sharp';
export const runtime = 'nodejs';
const cache = new Map<string, {
    png: Buffer;
    expires: number;
}>();
const pending = new Map<string, Promise<Buffer>>();
async function thumbnail(key: string, path: string, mime: string) {
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now())
        return hit.png;
    const { data, error } = await getSupabaseAdmin().storage.from(process.env.SUPABASE_STORAGE_BUCKET || 'crm-files').download(path);
    if (error || !data)
        throw new Error('原件暂时无法读取');
    if (data.size > 20 * 1024 * 1024)
        throw new Error('原件超过缩略图处理大小限制');
    const bytes = Buffer.from(await data.arrayBuffer());
    const png = mime === 'application/pdf' ? await renderPdfThumbnail(bytes) : await sharp(bytes, { limitInputPixels: 40000000 }).resize(360, 360, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
    cache.delete(key);
    cache.set(key, { png, expires: Date.now() + 300000 });
    let size = [...cache.values()].reduce((n, v) => n + v.png.length, 0);
    while (cache.size > 32 || size > 16 * 1024 * 1024) {
        const oldest = cache.keys().next().value!;
        size -= cache.get(oldest)!.png.length;
        cache.delete(oldest);
    }
    return png;
}
export async function GET(_request: Request, { params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    if (!await getCurrentUser())
        return Response.json({ error: '请先登录' }, { status: 401 });
    const { id } = await params;
    if (!/^[a-f0-9-]{36}$/i.test(id))
        return Response.json({ error: '文件无效' }, { status: 400 });
    const { data: file } = await getSupabaseAdmin().from('customer_files').select('storage_path,mime_type,size_bytes').eq('id', id).maybeSingle();
    if (!file)
        return Response.json({ error: '文件不存在' }, { status: 404 });
    if (!/^(application\/pdf|image\/(png|jpeg|webp|gif))$/.test(file.mime_type ?? '') || file.size_bytes > 20 * 1024 * 1024)
        return Response.json({ error: '文件不支持缩略图' }, { status: 415 });
    const key = id + ':' + file.storage_path;
    let task = pending.get(key);
    try {
        if (!task) {
            if (pending.size >= 8)
                return Response.json({ error: '预览繁忙，请重试' }, { status: 503 });
            task = thumbnail(key, file.storage_path, file.mime_type);
            pending.set(key, task);
        }
        return new Response(new Uint8Array(await task), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
    }
    catch {
        return Response.json({ error: '缩略图暂时无法生成，请预览或下载原件' }, { status: 503 });
    }
    finally {
        if (pending.get(key) === task)
            pending.delete(key);
    }
}
