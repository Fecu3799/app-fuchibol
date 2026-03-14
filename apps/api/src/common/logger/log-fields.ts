/**
 * Convención de campos de log estructurado.
 *
 * Usar estas claves al loguear objetos estructurados para mantener
 * consistencia entre módulos y facilitar queries en log aggregators.
 *
 * Campos globales (añadidos automáticamente por AppLogger en prod):
 *   level, ts, service, env, source
 *
 * Campos HTTP (usados por HttpLoggingInterceptor y ApiExceptionFilter):
 *   method, path, status, ms, rid, actorUserId, errorCode
 *
 * Campos de dominio (usar en use-cases, jobs, services):
 *   msg, op, matchId, userId, groupId, conversationId
 *
 * Ejemplo:
 *   this.logger.log({
 *     [F.OP]: 'cancelMatch',
 *     [F.MSG]: 'Match canceled by admin',
 *     [F.MATCH_ID]: matchId,
 *     [F.ACTOR_USER_ID]: actorId,
 *   });
 */
export const F = {
  // HTTP / request
  METHOD: 'method',
  PATH: 'path',
  STATUS: 'status',
  MS: 'ms',
  RID: 'rid',
  ACTOR_USER_ID: 'actorUserId',
  ERROR_CODE: 'errorCode',

  // Log metadata
  SOURCE: 'source',
  OP: 'op',

  // Dominio
  MSG: 'msg',
  MATCH_ID: 'matchId',
  USER_ID: 'userId',
  GROUP_ID: 'groupId',
  CONVERSATION_ID: 'conversationId',
} as const;

export type LogField = (typeof F)[keyof typeof F];
