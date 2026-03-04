import { computeMatchGender } from './compute-match-gender';

describe('computeMatchGender', () => {
  it('returns SIN_DEFINIR when no confirmed participants', () => {
    expect(computeMatchGender([])).toBe('SIN_DEFINIR');
  });

  it('returns MASCULINO when all confirmed are MALE', () => {
    expect(computeMatchGender(['MALE', 'MALE', 'MALE'])).toBe('MASCULINO');
  });

  it('returns FEMENINO when all confirmed are FEMALE', () => {
    expect(computeMatchGender(['FEMALE', 'FEMALE'])).toBe('FEMENINO');
  });

  it('returns MIXTO when there is at least one of each', () => {
    expect(computeMatchGender(['MALE', 'FEMALE'])).toBe('MIXTO');
  });

  it('returns MIXTO when mix includes multiple MALE and one FEMALE', () => {
    expect(computeMatchGender(['MALE', 'MALE', 'FEMALE'])).toBe('MIXTO');
  });

  it('returns MASCULINO for a single MALE confirmed', () => {
    expect(computeMatchGender(['MALE'])).toBe('MASCULINO');
  });
});
