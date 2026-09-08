import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
if (url !== 'http://127.0.0.1:54321')
    throw new Error('Only local CRM allowed');
const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const version = process.argv[2];
const { data: artifact, error } = await db.from('crm_proposal_pdf_artifacts').select('sha256,customer_files(storage_path)').eq('version_id', version).single();
if (error)
    throw error;
const directory = mkdtempSync(path.join(os.tmpdir(), 'crm-pdf-verification-'));
for (let i = 0; i < 2; i++) {
    const { data, error } = await db.storage.from(process.env.SUPABASE_STORAGE_BUCKET || 'crm-files').download(artifact.customer_files.storage_path);
    if (error)
        throw error;
    const bytes = Buffer.from(await data.arrayBuffer());
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (hash !== artifact.sha256 || bytes.subarray(0, 5).toString() !== '%PDF-')
        throw new Error('Original PDF hash mismatch');
    if (i === 0)
        writeFileSync(path.join(directory, 'formal.pdf'), bytes);
    console.log(`Download ${i + 1}: ${bytes.length} bytes, sha256 ${hash}`);
}
console.log(path.join(directory, 'formal.pdf'));
