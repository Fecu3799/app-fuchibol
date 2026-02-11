export const MatchStatus = {
  SCHEDULED: "scheduled",
  LOCKED: "locked",
  PLAYED: "played",
  CANCELED: "canceled",
} as const;

export type MatchStatus = (typeof MatchStatus)[keyof typeof MatchStatus];

export const ParticipantStatus = {
  INVITED: "invited",
  CONFIRMED: "confirmed",
  DECLINED: "declined",
  WAITLIST: "waitlist",
  KICKED: "kicked",
} as const;

export type ParticipantStatus =
  (typeof ParticipantStatus)[keyof typeof ParticipantStatus];
