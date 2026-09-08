import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { withDocumentWorker } from './document-renderer';
describe('bounded document worker', () => {
    it('serializes heavy jobs while yielding the event loop', async () => {
        let active = 0, peak = 0;
        const jobs = Array.from({ length: 5 }, (_, i) => withDocumentWorker(async () => {
            active++;
            peak = Math.max(peak, active);
            await new Promise(resolve => setTimeout(resolve, 2));
            active--;
            return i;
        }));
        expect(await Promise.all(jobs)).toEqual([0, 1, 2, 3, 4]);
        expect(peak).toBe(1);
    });
    it('releases the worker after a conversion failure', async () => {
        await expect(withDocumentWorker(async () => { throw new Error('conversion failed'); })).rejects.toThrow('conversion failed');
        await expect(withDocumentWorker(async () => 42)).resolves.toBe(42);
    });
    it('rejects excess work instead of creating an unbounded queue', async () => {
        let release!: () => void;
        const first = withDocumentWorker(() => new Promise<void>(resolve => { release = resolve; }));
        const waiting = Array.from({ length: 8 }, () => withDocumentWorker(async () => true));
        await expect(withDocumentWorker(async () => false)).rejects.toThrow('文档任务较多');
        release();
        await first;
        expect(await Promise.all(waiting)).toHaveLength(8);
    });
});
