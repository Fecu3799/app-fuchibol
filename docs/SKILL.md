# SKILL.md — Workflow de implementación

Playbook de desarrollo para trabajar con alta integridad en este repo.
Leer antes de escribir código. Ver reglas de dominio en [`CLAUDE.md`](../CLAUDE.md).

---

## Pre-flight checklist (antes de tocar código)

- [ ] Identificar archivos exactos a modificar. Listarlos.
- [ ] Verificar que no existe módulo/patrón equivalente (no duplicar).
- [ ] Confirmar si requiere migración DB (y si ya hay una pendiente que la cubra).
- [ ] Definir criterios de éxito en bullets (ver template abajo).
- [ ] Identificar tests existentes relevantes: ¿pasan hoy? ¿cuáles tocaré?

---

## Implementation checklist (durante)

### API

- [ ] Prefix `/api/v1` en todos los endpoints.
- [ ] Actor inyectado via guard (`req.user.userId`, `req.user.sessionId`).
- [ ] Errores como Problem Details: 401 / 403 / 404 / 409 / 422 con `errorCode`.
- [ ] `Idempotency-Key` header en toda acción mutable sensible.
- [ ] `expectedRevision` en mutations que modifiquen el Match.
- [ ] DTOs validados con `class-validator` (422 automático via `ValidationPipe`).
- [ ] Logs estructurados con `matchId`/`userId` donde aplique.

### DB

- [ ] Una feature = una migración. Nunca duplicar.
- [ ] Índices/constraints donde aporten invariantes o perf real.
- [ ] Data migrations dentro del SQL de migración.
- [ ] `type String` (no enum Prisma) para audit log types.

### Realtime

- [ ] El servidor emite solo `{ matchId, revision }` — nunca estado ni diffs.
- [ ] Llamar `notifyMatchUpdated(matchId, revision)` tras cada mutación exitosa.
- [ ] El cliente refetcha snapshot; no reconstruye estado desde eventos WS.

### Domain

- [ ] `WITHDRAWN` no existe — no referenciar, no usar, no restaurar.
- [ ] `locked` no bloquea confirm de INVITED — verificar lógica.
- [ ] `spectator` no ocupa cupo — verificar conteo.
- [ ] Audit log dentro de la transacción: `audit.log(tx, ...)`.
- [ ] Push notifications: fire-and-forget post-commit (`void service.onX(...).catch(...)`).

### Mobile

- [ ] No toasts — usar banners persistentes.
- [ ] React Query para server state; no duplicar en estado local.
- [ ] SecureStore para tokens sensibles.
- [ ] WS: re-subscribe + resync en reconexión.

---

## Post-flight checklist (diff review)

- [ ] ¿Creé endpoints redundantes con uno existente?
- [ ] ¿Rompí contratos de response (campos renombrados, removidos, tipados distinto)?
- [ ] ¿La migración está duplicada o es innecesaria?
- [ ] ¿Tests en verde? (`pnpm -C apps/api test`)
- [ ] ¿Toqué archivos que no necesitaba tocar?
- [ ] ¿El `actionsAllowed` del snapshot refleja las nuevas reglas?
- [ ] ¿Actualicé `docs/stepbystep.md` si es feature nueva? (No si es fix.)

---

## Acceptance criteria template

```
## Criterios de éxito — [nombre feature]

### API
- [ ] `POST /api/v1/matches/:id/X` responde 200 con { ... }
- [ ] Idempotente: segundo request con mismo Idempotency-Key responde igual
- [ ] 409 REVISION_CONFLICT si expectedRevision no coincide
- [ ] 403 si actor no tiene permisos

### DB
- [ ] Migración aplicada sin errores
- [ ] Constraint X previene duplicado Y

### Realtime
- [ ] WS emite { matchId, revision } después de la mutación
- [ ] Cliente refetcha snapshot y UI se actualiza

### Mobile
- [ ] Flujo feliz funciona en iPhone físico
- [ ] Error handling: 409 muestra banner / reintenta con nuevo revision
- [ ] Sin toasts

### Tests
- [ ] Use-case test: regla X cubierta
- [ ] Test: error code correcto en caso borde Y
```

---

## API endpoint checklist

```
- [ ] Ruta: METHOD /api/v1/...
- [ ] Auth guard activo (JwtAuthGuard o DevAuthGuard)
- [ ] DTO de input con class-validator
- [ ] Use-case en application/ (no lógica en controller)
- [ ] Response DTO (no exponer entidad Prisma directa)
- [ ] Idempotency-Key si es acción mutable
- [ ] expectedRevision si muta el Match
- [ ] notifyMatchUpdated() si corresponde
- [ ] audit.log() dentro de tx si corresponde
- [ ] Push notification fire-and-forget si corresponde
- [ ] Test: happy path + al menos un error code relevante
```

---

## DB migration checklist

```
- [ ] Nombre descriptivo: YYYYMMDDHHMMSS_<descripcion>
- [ ] Una sola migración por feature
- [ ] Incluye data migration si hay cambio de schema con datos existentes
- [ ] Índices añadidos donde hay queries frecuentes o invariantes
- [ ] Constraints UNIQUE donde se requiere idempotencia
- [ ] Rollback considerado (o documentado si es irreversible)
- [ ] `pnpm -C apps/api prisma migrate dev` sin errores
- [ ] `pnpm -C apps/api prisma generate` tras schema change
```

---

## Realtime checklist

```
- [ ] El servidor emite solo { matchId, revision } (no payload de estado)
- [ ] notifyMatchUpdated() llamado post-mutación exitosa en el controller
- [ ] Cliente: useMatchRealtime maneja el evento correctamente
- [ ] Coalesce activo (no N GETs por N eventos en ráfaga)
- [ ] Resync en reconexión: re-subscribe + GET forzado
- [ ] Tolera duplicados y out-of-order (revision guard)
```

---

## PR checklist

```
- [ ] Migración y constraints (si aplica)
- [ ] Seeds/fixtures actualizadas (si aplica)
- [ ] Use-case + tests (regla cubierta)
- [ ] DTOs validados
- [ ] Errores consistentes (401/403/409/422 con errorCode)
- [ ] Logs estructurados con matchId/userId
- [ ] docs/stepbystep.md actualizado (solo si es feature nueva)
- [ ] Diff revisado: mínimo de archivos, sin contratos rotos
```

---

## Patrones frecuentes

### Idempotency check (use-case)

```typescript
const existing = await this.idempotencyRepo.find(userId, matchId, action, idempotencyKey);
if (existing) return existing.result;
// ... lógica ...
await this.idempotencyRepo.save(userId, matchId, action, idempotencyKey, result);
return result;
```

### Optimistic locking (use-case)

```typescript
if (match.revision !== expectedRevision) {
  throw new DomainException('REVISION_CONFLICT', 409);
}
// ... update con revision + 1 ...
```

### Fire-and-forget push (controller / use-case post-commit)

```typescript
void this.matchNotificationService.onX(matchId, userId, ...).catch(err =>
  this.logger.warn('push notification failed', { err, matchId })
);
```

### Audit log dentro de tx

```typescript
await this.prisma.client.$transaction(async (tx) => {
  // ... mutación ...
  await this.auditService.log(tx, matchId, actorId, AuditLogType.X, { ... });
});
```

### Notify realtime (controller)

```typescript
const result = await this.useCase.run(...);
this.realtimePublisher.notifyMatchUpdated(matchId, result.snapshot.revision);
return result.snapshot;
```
