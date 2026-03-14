/**
 * Taxonomía centralizada de error codes.
 *
 * Estos valores son los que aparecen en:
 *  - el campo `code` del cuerpo HTTP de error (Problem Details)
 *  - el campo `errorCode` en logs estructurados
 *  - el campo `errorCode` de respuestas de API consumidas por clientes
 *
 * Reglas:
 *  - Los códigos son strings estables (no cambiar una vez publicados).
 *  - SCREAMING_SNAKE_CASE para errores de dominio.
 *  - Los genéricos de HTTP (BAD_REQUEST, NOT_FOUND, etc.) van en minúsculas opcionalmente
 *    pero se mantienen consistentes con el estándar del filter existente.
 *
 * Uso en exception filter, guards y use-cases:
 *   throw new ConflictException(ErrorCode.REVISION_CONFLICT);
 *   throw new NotFoundException(ErrorCode.USER_NOT_FOUND);
 */
export const ErrorCode = {
  // ── Conflict 409 ──
  REVISION_CONFLICT: 'REVISION_CONFLICT',
  MATCH_LOCKED: 'MATCH_LOCKED',
  MATCH_CANCELLED: 'MATCH_CANCELLED',
  IDEMPOTENCY_REPLAY: 'IDEMPOTENCY_KEY_REUSE', // alias semántico → mismo string wire
  SELF_INVITE: 'SELF_INVITE',
  ALREADY_PARTICIPANT: 'ALREADY_PARTICIPANT',
  CAPACITY_BELOW_CONFIRMED: 'CAPACITY_BELOW_CONFIRMED',

  // ── Forbidden 403 ──
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  ACCOUNT_SUSPENDED: 'account_suspended',
  USER_BANNED: 'USER_BANNED',
  FORBIDDEN: 'FORBIDDEN',

  // ── Unauthorized 401 ──
  REFRESH_REUSED: 'REFRESH_REUSED',
  SESSION_REVOKED: 'SESSION_REVOKED',
  REFRESH_EXPIRED: 'REFRESH_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',

  // ── Unprocessable 422 ──
  CREATOR_WITHDRAW_REQUIRES_ADMIN: 'CREATOR_WITHDRAW_REQUIRES_ADMIN',
  CREATOR_TRANSFER_REQUIRED: 'CREATOR_TRANSFER_REQUIRED',
  CANNOT_DEMOTE_CREATOR: 'CANNOT_DEMOTE_CREATOR',
  NOT_PARTICIPANT: 'NOT_PARTICIPANT',
  TERMS_NOT_ACCEPTED: 'TERMS_NOT_ACCEPTED',
  INVALID_CONTENT_TYPE: 'invalid_content_type',
  FILE_TOO_LARGE: 'file_too_large',
  INVALID_AVATAR_KEY: 'invalid_avatar_key',
  VALIDATION_ERROR: 'VALIDATION_ERROR',

  // ── Not Found 404 ──
  NOT_FOUND: 'NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',

  // ── HTTP genéricos ──
  BAD_REQUEST: 'BAD_REQUEST',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',

  // ── Catch-all ──
  UNEXPECTED_ERROR: 'INTERNAL',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];
