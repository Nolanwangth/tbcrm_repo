import { createClient } from '@supabase/supabase-js';
import { randomBytes, createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const base = 'http://127.0.0.1:3001';
if ((process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) !== 'http://127.0.0.1:54321')
    throw new Error('Local CRM only');
const db = createClient('http://127.0.0.1:54321', process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: user, error } = await db.from('crm_users').select('id,password_hash').eq('username', 'admin').eq('active', true).single();
if (error)
    throw error;
const token = randomBytes(32).toString('hex'), hash = createHash('sha256').update(token).digest('hex');
const created = await db.rpc('crm_create_auth_session', { p_token_hash: hash, p_user: user.id, p_password_hash: user.password_hash, p_expires: new Date(Date.now() + 600000).toISOString() });
if (created.error)
    throw created.error;
const cookieName = process.env.CRM_SESSION_COOKIE_NAME || (process.env.NODE_ENV === 'production' ? 'crm_session' : 'crm_session_dev');
const routes = ['/planner', '/customers', '/won', '/operations', '/customers/a0000000-0000-4000-8000-000000000023?tab=archive', '/planner/tools/quotation?customerId=a0000000-0000-4000-8000-000000000023', '/operations/db949bed-a4bf-4caf-809a-22ca865c1be7'];
if (process.argv.includes('--extended'))
    routes.push('/dashboard', '/closed', '/planner/A', '/planner/D', '/planner/E', '/finance', '/feedback', '/accounts', '/planner/tools/itinerary?customerId=a0000000-0000-4000-8000-000000000023');
const results = [];
try {
    for (const route of routes) {
        const samples = [];
        for (let i = 0; i < 3; i++) {
            const start = performance.now();
            const response = await fetch(base + route, { headers: { Cookie: cookieName + '=' + token }, redirect: 'manual' });
            const headersMs = performance.now() - start;
            const body = await response.arrayBuffer();
            if (response.status !== 200)
                throw new Error(route + ' HTTP ' + response.status);
            samples.push({ totalMs: Math.round(performance.now() - start), headersMs: Math.round(headersMs), bytes: body.byteLength });
        }
        const result = { route, first: samples[0], warm: samples.slice(1) };
        results.push(result);
        console.log(JSON.stringify(result));
    }
    const concurrent = [];
    if (process.argv.includes('--extended')) {
        for (let batch = 0; batch < 5; batch++)
            concurrent.push(...await Promise.all(routes.slice(0, 8).map(async (route) => {
                const start = performance.now(), response = await fetch(base + route, { headers: { Cookie: cookieName + '=' + token }, redirect: 'manual' });
                await response.arrayBuffer();
                if (response.status !== 200)
                    throw new Error('Concurrent ' + route + ' HTTP ' + response.status);
                return Math.round(performance.now() - start);
            })));
    }
    const report = { measuredAt: new Date().toISOString(), mode: process.argv[3] || 'dev', base, notes: 'Actual authenticated HTTP full responses. First means first request in this run, not a guaranteed cold compiler. Warm samples repeat the same route. No browser timing claim.', results, concurrent8: concurrent.length ? { samples: concurrent, requests: concurrent.length, maxMs: Math.max(...concurrent), medianMs: [...concurrent].sort((a, b) => a - b)[Math.floor(concurrent.length / 2)] } : null };
    if (process.argv[2])
        writeFileSync(process.argv[2], JSON.stringify(report, null, 2));
}
finally {
    const deleted = await db.from('crm_auth_sessions').delete().eq('token_hash', hash);
    if (deleted.error)
        throw deleted.error;
}
