import { calculateAge } from './calculate-age';

describe('calculateAge', () => {
  const today = new Date();

  it('returns null when birthDate is null', () => {
    expect(calculateAge(null)).toBeNull();
  });

  it('returns correct age when birthday already happened this year', () => {
    // Born on Jan 1 of (currentYear - 25): birthday already passed
    const birth = new Date(Date.UTC(today.getUTCFullYear() - 25, 0, 1));
    expect(calculateAge(birth)).toBe(25);
  });

  it('returns age minus 1 when birthday has not happened yet this year', () => {
    // Born on Dec 31 of (currentYear - 25): birthday hasn't happened yet (unless today is Dec 31)
    // Use a month guaranteed to be in the future relative to any reasonable test date
    const birth = new Date(Date.UTC(today.getUTCFullYear() - 25, 11, 31));
    const expectedAge =
      today.getUTCMonth() === 11 && today.getUTCDate() >= 31 ? 25 : 24;
    expect(calculateAge(birth)).toBe(expectedAge);
  });

  it('returns 0 when born this year', () => {
    const birth = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
    expect(calculateAge(birth)).toBe(0);
  });
});
