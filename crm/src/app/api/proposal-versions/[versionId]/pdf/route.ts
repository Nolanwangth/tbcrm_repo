import { cookies } from "next/headers";
import crypto from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { renderBrandedItinerary, withDocumentWorker } from "@/lib/document-renderer";
export const runtime = 'nodejs';
const pending = new Map<string, Promise<string>>();
async function ensurePdf(versionId: string, actorId: string, branded: boolean) {
    const db = getSupabaseAdmin(), bucket = process.env.SUPABASE_STORAGE_BUCKET || 'crm-files';
    const { data: existing } = await db.from(branded ? 'crm_proposal_branded_artifacts' : 'crm_proposal_pdf_artifacts').select('file_id').eq('version_id', versionId).maybeSingle();
    if (existing)
        return String(existing.file_id);
    const { data: version, error } = await db.from('customer_proposal_versions').select('id,snapshot,customer_proposals!customer_proposal_versions_proposal_id_fkey(customer_id)').eq('id', versionId).single();
    if (error || !version || version.snapshot?.schemaVersion !== 2)
        throw new Error('未找到 2.0 正式版本');
    const proposal = Array.isArray(version.customer_proposals) ? version.customer_proposals[0] : version.customer_proposals;
    const customerId = String(proposal?.customer_id);
    if (branded && version.snapshot.toolType !== 'itinerary')
        throw new Error('品牌行程 PDF 仅适用于行程版本');
    let pdf: Buffer;
    if (branded) {
        pdf = await renderBrandedItinerary(version.snapshot);
    }
    else {
        const origin = process.env.CRM_PDF_ORIGIN || 'http://127.0.0.1:3001';
        if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin))
            throw new Error('PDF 渲染仅允许本机 CRM');
        const jar = await cookies();
        pdf = await withDocumentWorker(async () => {
            const { chromium } = await import('playwright-core');
            const browser = await chromium.launch({ channel: 'chrome', headless: true });
            try {
                const context = await browser.newContext();
                await context.addCookies(jar.getAll().map(c => ({ name: c.name, value: c.value, url: origin, httpOnly: true, sameSite: 'Lax' as const })));
                const page = await context.newPage();
                await page.route('**/*', route => { const url = new URL(route.request().url()); return url.origin === origin || url.protocol === 'data:' ? route.continue() : route.abort(); });
                await page.goto(`${origin}/planner/print/${versionId}`, { waitUntil: 'networkidle', timeout: 60000 });
                await page.waitForSelector('[data-version-print-ready="true"]', { timeout: 30000 });
                await page.evaluate(() => document.fonts.ready);
                return await page.pdf({ format: 'A4', landscape: version.snapshot.toolType === 'quotation', printBackground: true, preferCSSPageSize: true });
            }
            finally {
                await browser.close();
            }
        });
    }
    const storagePath = `${customerId}/proposals/${versionId}${branded ? '-branded-v1' : ''}.pdf`;
    const { error: uploadError } = await db.storage.from(bucket).upload(storagePath, pdf!, { contentType: 'application/pdf', upsert: false });
    if (uploadError && !/already exists|duplicate/i.test(uploadError.message))
        throw new Error(uploadError.message);
    const { data: stored } = await db.storage.from(bucket).download(storagePath);
    if (!stored)
        throw new Error('正式 PDF 保存后无法读回');
    const sha256 = crypto.createHash('sha256').update(Buffer.from(await stored.arrayBuffer())).digest('hex');
    const { data: fileId, error: linkError } = await db.rpc(branded ? 'crm_register_branded_pdf' : 'crm_register_proposal_pdf', { p_actor: actorId, p_version: versionId, p_storage_path: storagePath, p_size: stored.size, p_sha256: sha256 });
    if (linkError)
        throw new Error(linkError.message);
    return String(fileId);
}
export async function GET(_request: Request, { params }: {
    params: Promise<{
        versionId: string;
    }>;
}) {
    const actor = await getCurrentUser();
    if (!actor)
        return Response.json({ error: '未登录' }, { status: 401 });
    const { versionId } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(versionId))
        return Response.json({ error: '版本无效' }, { status: 400 });
    const branded = new URL(_request.url).searchParams.get('format') === 'branded';
    const key = versionId + (branded ? ':branded' : '');
    let task = pending.get(key);
    try {
        if (!task) {
            if (pending.size >= 8)
                return Response.json({ error: '文档任务繁忙，请稍后重试' }, { status: 503 });
            task = ensurePdf(versionId, actor.id, branded);
            pending.set(key, task);
        }
        const fileId = await task;
        return new Response(null, { status: 303, headers: { Location: `/api/files/${fileId}/download` } });
    }
    catch (error) {
        console.error('CRM PDF archive failed:', error instanceof Error ? error.message : 'unknown');
        return Response.json({ error: error instanceof Error ? error.message : '正式 PDF 生成失败，可重试，版本不会重复创建' }, { status: 500 });
    }
    finally {
        if (pending.get(key) === task)
            pending.delete(key);
    }
}
