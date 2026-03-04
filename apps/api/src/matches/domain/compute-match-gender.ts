export type MatchGender = 'SIN_DEFINIR' | 'MASCULINO' | 'FEMENINO' | 'MIXTO';

/**
 * Derives matchGender from the genders of CONFIRMED participants.
 * Spectators, waitlisted, and invited do not count.
 */
export function computeMatchGender(confirmedGenders: string[]): MatchGender {
  if (confirmedGenders.length === 0) return 'SIN_DEFINIR';
  if (confirmedGenders.every((g) => g === 'MALE')) return 'MASCULINO';
  if (confirmedGenders.every((g) => g === 'FEMALE')) return 'FEMENINO';
  return 'MIXTO';
}
