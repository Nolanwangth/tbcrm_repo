export function groupServicesByDay<D extends {
    id: string;
    serviceDate: string | null;
}, I extends {
    id: string;
    dayId: string | null;
    serviceDate: string | null;
}>(days: D[], items: I[]) {
    const firstDayByDate = new Map<string, string>();
    const grouped = new Map(days.map(day => [day.id, [] as I[]]));
    for (const day of days)
        if (day.serviceDate && !firstDayByDate.has(day.serviceDate))
            firstDayByDate.set(day.serviceDate, day.id);
    for (const item of items) {
        const dayId = item.serviceDate ? firstDayByDate.get(item.serviceDate) : item.dayId;
        if (dayId)
            grouped.get(dayId)?.push(item);
    }
    return grouped;
}
