import { describe, expect, it } from 'vitest';
import { operationSummary } from './operation-summary';
import { bookingProgress, operationFinancials, operationPhase, reminderTiming, type OperationCase } from './operations';
describe('operation summary projection', () => {
    it('preserves totals, phase, booking and reminder timing without sending detail-only data', () => {
        const full = {
            id: 'case', tourCode: 'TB-2026-00001', tourName: '测试团', customerName: '测试客户', priority: '高',
            arrivalDate: '2026-09-08', departureDate: '2026-09-10', ownerName: '规划师', serviceListStatus: 'uploaded', recordStatus: 'active', updatedAt: '2026-09-08',
            notes: 'not needed on list', files: [{ name: 'private.pdf' }], days: [{ id: 'day' }], contacts: [{ name: 'contact' }],
            items: [{ id: 'item', title: '导游', category: 'guide', bookingStatus: 'confirmed', quantity: 2, invoiceUnitCost: 500, customerUnitQuote: 800, finalSupplierSettlement: 950, finalCustomerSettlement: 1600, notes: 'large detail' }],
            reminders: [{ id: 'reminder', serviceItemId: 'item', title: '确认', dueDate: '2026-09-08', status: 'pending', assigneeName: '计调', notes: 'detail' }],
        } as unknown as OperationCase;
        const slim = operationSummary(full);
        expect(operationFinancials(slim.items)).toEqual(operationFinancials(full.items));
        expect(bookingProgress(slim.items)).toEqual(bookingProgress(full.items));
        expect(operationPhase(slim, '2026-09-08')).toEqual(operationPhase(full, '2026-09-08'));
        expect(reminderTiming(slim.reminders[0], '2026-09-08')).toBe('today');
        expect(slim).not.toHaveProperty('files');
        expect(slim).not.toHaveProperty('notes');
        expect(slim.items[0]).not.toHaveProperty('notes');
        expect(JSON.stringify(slim).length).toBeLessThan(JSON.stringify(full).length);
    });
});
