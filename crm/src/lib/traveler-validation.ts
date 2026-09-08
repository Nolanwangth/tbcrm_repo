export function validateTravelerDetails(type: string, age: number | null, height: number | null) {
    if (!['adult', 'child', 'senior'].includes(type))
        return '请选择有效的旅客类型';
    if (age !== null && (!Number.isInteger(age) || age < 0 || age > 120))
        return '年龄须为 0–120 的整数';
    if (height !== null && (!Number.isInteger(height) || height < 30 || height > 250))
        return '身高须为 30–250 cm 的整数';
    if (type === 'child' && (age === null || height === null))
        return '儿童必须填写年龄和身高';
    if (type === 'senior' && age === null)
        return '老人必须填写年龄';
    return null;
}
