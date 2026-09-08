import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
const directory = process.argv[2];
const manifest = JSON.parse(readFileSync(path.join(directory, 'checksums.json'), 'utf8'));
for (const file of manifest.files) {
    if (createHash('sha256').update(readFileSync(path.join(directory, file.name))).digest('hex') !== file.sha256)
        throw new Error(`Checksum mismatch: ${file.name}`);
}
const query = (db, sql) => execFileSync('docker', ['exec', 'supabase_db_tripbook-crm', 'psql', '-U', 'supabase_admin', '-d', db, '-Atc', sql], { encoding: 'utf8' }).trim();
const tables = query('postgres', "select quote_ident(schemaname)||'.'||quote_ident(tablename) from pg_tables where schemaname in ('public','storage','auth','supabase_migrations') order by 1").split('\n');
const checked = [];
for (const table of tables) {
    const sql = `select count(*) || ':' || coalesce(md5(string_agg(j, E'\\n' order by j)), 'empty') from (select row_to_json(t)::text j from ${table} t) s`;
    const source = query('postgres', sql);
    const restored = query('crm_restore_drill_20260907', sql);
    if (source !== restored)
        throw new Error(`Restored table differs: ${table}`);
    checked.push({ table, digest: source });
}
const unpacked = mkdtempSync(path.join(os.tmpdir(), 'crm-storage-restore-'));
execFileSync('tar', ['-xzf', path.join(directory, 'storage.tar.gz'), '-C', unpacked]);
const walk = p => readdirSync(p).flatMap(n => { const f = path.join(p, n); return statSync(f).isDirectory() ? walk(f) : [f]; });
const files = walk(unpacked).map(f => ({ path: path.relative(unpacked, f), sha256: createHash('sha256').update(readFileSync(f)).digest('hex') }));
writeFileSync(path.join(directory, 'restore-verification.json'), JSON.stringify({ verifiedAt: new Date().toISOString(), restoredDatabase: 'crm_restore_drill_20260907', tables: checked, restoredStorageDirectory: unpacked, storageFiles: files }, null, 2), { mode: 0o600 });
console.log(`Verified ${checked.length} tables byte-equivalent as canonical JSON; extracted ${files.length} Storage files. Source database untouched.`);
