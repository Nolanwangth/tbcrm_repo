import { expect, it } from 'vitest';
import { groupServicesByDay } from './service-day-groups';
it('keeps date precedence, first duplicate date, and undated day links', () => {
    const days = [{ id: 'a', serviceDate: '2026-09-08' }, { id: 'b', serviceDate: '2026-09-08' }];
    const items = [{ id: '1', dayId: 'b', serviceDate: '2026-09-08' }, { id: '2', dayId: 'b', serviceDate: null }, { id: '3', dayId: 'a', serviceDate: '2026-09-09' }];
    const result = groupServicesByDay(days, items);
    expect(result.get('a')).toEqual([items[0]]);
    expect(result.get('b')).toEqual([items[1]]);
});
it('matches the previous grouping for a large itinerary', () => {
    const days = Array.from({ length: 365 }, (_, i) => ({ id: String(i), serviceDate: String(i) }));
    const items = Array.from({ length: 10000 }, (_, i) => ({ id: String(i), dayId: String(i % 365), serviceDate: i % 7 ? String(i % 365) : null }));
    const groups = groupServicesByDay(days, items);
    for (const day of days)
        expect(groups.get(day.id)).toEqual(items.filter(item => item.serviceDate ? days.find(d => d.serviceDate === item.serviceDate)?.id === day.id : item.dayId === day.id));
});
