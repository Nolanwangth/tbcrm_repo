import { expect, it } from 'vitest';
import { validateTravelerDetails } from './traveler-validation';
it('requires child age and height, including zero-year infants', () => {
    expect(validateTravelerDetails('child', null, 100)).toBeTruthy();
    expect(validateTravelerDetails('child', 4, null)).toBeTruthy();
    expect(validateTravelerDetails('child', 0, 55)).toBeNull();
});
it('requires senior age but not adult age', () => {
    expect(validateTravelerDetails('senior', null, null)).toBeTruthy();
    expect(validateTravelerDetails('senior', 70, null)).toBeNull();
    expect(validateTravelerDetails('adult', null, null)).toBeNull();
});
it('rejects malformed and out of range values', () => {
    for (const age of [NaN, -1, 121, 1.5])
        expect(validateTravelerDetails('child', age, 100)).toBeTruthy();
    expect(validateTravelerDetails('child', 7, 0)).toBeTruthy();
});
