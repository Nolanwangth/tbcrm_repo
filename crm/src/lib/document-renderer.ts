import 'server-only';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildItineraryDocx } from '@/quote-v2/lib/docxGenerator';
import { parseItineraryDocument } from '@/quote-v2/lib/itineraryDocument';
import type { QuoteV2Snapshot } from '@/lib/quote-v2';
const exec = promisify(execFile);
let active = 0;
const waiting: {
    resolve: () => void;
    reject: (e: Error) => void;
    timer: ReturnType<typeof setTimeout>;
}[] = [];
export async function withDocumentWorker<T>(job: () => Promise<T>): Promise<T> {
    if (active >= 1) {
        if (waiting.length >= 8)
            throw new Error('文档任务较多，请稍后重试，业务资料已保留');
        await new Promise<void>((resolve, reject) => { const entry = { resolve, reject, timer: setTimeout(() => { const index = waiting.indexOf(entry); if (index >= 0)
                waiting.splice(index, 1); reject(new Error('文档任务等待超时，请重试')); }, 60000) }; waiting.push(entry); });
    }
    else
        active++;
    try {
        return await job();
    }
    finally {
        const next = waiting.shift();
        if (next) {
            clearTimeout(next.timer);
            next.resolve();
        }
        else
            active--;
    }
}
function binary(name: 'CRM_SOFFICE_BIN' | 'CRM_PDFTOPPM_BIN') {
    const value = process.env[name];
    if (!value || !path.isAbsolute(value))
        throw new Error(`本机文档组件未配置：${name}`);
    return value;
}
async function temporary<T>(job: (directory: string) => Promise<T>) {
    const directory = await mkdtemp(path.join(tmpdir(), 'crm-document-'));
    try {
        return await job(directory);
    }
    finally {
        await rm(directory, { recursive: true, force: true });
    }
}
export async function renderBrandedItinerary(snapshot: QuoteV2Snapshot) {
    return withDocumentWorker(() => temporary(async (directory) => {
        const template = await readFile(path.join(process.cwd(), 'public/quote-v2/templates/tripbook-itinerary-template.docx'));
        const docx = await buildItineraryDocx(template, parseItineraryDocument(snapshot.itinerary));
        const input = path.join(directory, 'itinerary.docx');
        await writeFile(input, docx, { mode: 0o600 });
        await exec(binary('CRM_SOFFICE_BIN'), [`-env:UserInstallation=${pathToFileURL(path.join(directory, 'profile')).href}`, '--headless', '--convert-to', 'pdf:writer_pdf_Export', '--outdir', directory, input], { timeout: 60000, maxBuffer: 1024 * 1024 });
        const pdf = await readFile(path.join(directory, 'itinerary.pdf'));
        if (!pdf.subarray(0, 5).equals(Buffer.from('%PDF-')))
            throw new Error('品牌 PDF 转换失败');
        return pdf;
    }));
}
export async function renderPdfThumbnail(pdf: Buffer) {
    if (pdf.length > 20 * 1024 * 1024)
        throw new Error('预览文件不能超过 20 MB');
    return withDocumentWorker(() => temporary(async (directory) => {
        const input = path.join(directory, 'source.pdf'), output = path.join(directory, 'page');
        await writeFile(input, pdf, { mode: 0o600 });
        await exec(binary('CRM_PDFTOPPM_BIN'), ['-f', '1', '-singlefile', '-scale-to', '360', '-png', input, output], { timeout: 20000, maxBuffer: 1024 * 1024 });
        return readFile(output + '.png');
    }));
}
