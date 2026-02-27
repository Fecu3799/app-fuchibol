# CLAUDE.md — Reglas de trabajo (Monorepo: RN + NestJS + Postgres + Redis)

Monorepo pnpm con tres workspaces: `apps/api` (NestJS + Prisma), `apps/mobile` (Expo RN), `packages/shared` (enums/schemas Zod).
Arquitectura: monolito modular, DDD pragmático, Light CQRS. Match es el agregado principal. PostgreSQL es la fuente de verdad.

> Workflow de implementación detallado → @docs/SKILL.md
> Registro cronológico → `docs/stepbystep.md`
> Extensiones futuras → `docs/future-implementations.md`

---

## 0) Principios no negociables

1. **No inventar complejidad**: nada de microservicios, event buses externos, CQRS completo.
2. **Vertical slices**: cada feature funciona end-to-end (API + DB + UI mínima).
3. **DB es la fuente de verdad**. WebSocket es best-effort.
4. **Idempotencia obligatoria** en acciones sensibles (`Idempotency-Key` header).
5. **Optimistic locking** con `revision` para mutaciones del Match.
6. **Constraints primero**: unique keys, FKs, índices donde aporten invariantes/perf.
7. **Migrations + seeds** siempre que se agregue una entidad o regla.
8. **Mínimo de archivos tocados**: identificar archivos exactos antes de implementar; no crear carpetas nuevas si hay lugar lógico.

---

## 1) Stack

| Capa | Tecnología |
|---|---|
| API | NestJS (TypeScript), Prisma, pg pool |
| DB | PostgreSQL 16 |
| Cache/Presence | Redis 7 (rate limit + presence; BullMQ futuro) |
| Mobile | Expo React Native (TypeScript), target iPhone; web solo debug |
| Shared | `packages/shared` — enums/schemas Zod |
| Push | Expo Push (proveedor actual); abstracción `NotificationProvider` lista para FCM/APNs |

### Convenciones de código

- Código en inglés. Comentarios solo en bloques críticos (no describir lo obvio).
- `import type` obligatorio para tipos usados en decorated signatures (TS1272 con isolatedModules).
- `expiresIn` JWT tipado como `StringValue` de `ms`.
- Passwords con **argon2** (nunca bcrypt). Requiere `pnpm.onlyBuiltDependencies` en root `package.json`.
- `PrismaService` se accede via `.client` (no directamente).
- Global prefix API: `/api/v1`.

---

## 2) Arquitectura backend (NestJS)

### Módulos (bounded contexts)

`auth` · `users` · `groups` · `matches` (core) · `chat` · `notifications` · `push` · `infra`

### Capas por módulo (DDD pragmático)

```
domain/       → entidades, value objects, reglas puras
application/  → use-cases/commands/queries (lógica crítica aquí)
infra/        → repositorios, adapters, persistencia
api/          → controllers, DTOs, guards
```

Lógica de negocio crítica vive en `application/` y/o `domain/`, **nunca** en controllers.

### Light CQRS

- **Commands**: mutan estado, dentro de transacción.
- **Queries**: devuelven DTOs optimizados; nunca exponen entidades internas.

---

## 3) Reglas de dominio — Match

### Estados del match

```
scheduled → locked → played
         ↘ canceled
```

- `scheduled`: estado normal, acepta invites y confirmaciones.
- `locked`: **solo bloquea nuevas invitaciones** (crear invite / invite from group). NO bloquea confirmaciones de usuarios ya INVITED.
- `played` / `canceled`: inmutables; todas las mutaciones responden 409 `MATCH_CANCELLED`.

### Participant status

`invited` · `confirmed` · `declined` · `waitlist` · `kicked` · **`spectator`**

> ⚠️ **`WITHDRAWN` NO EXISTE.** Fue eliminado completamente (step 21). Cualquier vestigio en código debe ser removido. El endpoint `/withdraw` tampoco existe.

### Transiciones clave

| Acción | Resultado |
|---|---|
| Confirm (invited) | → `confirmed` si hay cupo; si no → `waitlist` |
| Confirm (invited, match locked) | Permitido — lock NO bloquea a ya-invitados |
| Toggle spectator (sin row / cualquier status) | → `spectator` |
| Toggle spectator (spectator) | → `invited` |
| Toggle spectator (confirmed) | → `spectator` + promueve primer `waitlisted` |
| Leave match | Hard delete de la fila (no cambia status). Si <1h antes del inicio → `user.lateLeaveCount += 1` |
| Leave (creator) | Requiere admin activo; transfiere `createdById` al primer admin (`adminGrantedAt ASC`). 422 `CREATOR_TRANSFER_REQUIRED` si no hay. |
| Decline | → `declined`. Solo admin puede reinvite (declined → invited). NO puede confirmar directo. |
| Cambio mayor (fecha/hora/lugar/capacidad) | Match → `scheduled`; confirmed → `invited` (excepto creator que queda `confirmed`); waitlist se mantiene |
| Baja de cupo | Últimos confirmados → waitlist (por `confirmedAt DESC`) |
| Invite a spectator | Setea a `invited` (no 409) |

### Spectator

- No ocupa cupo; tiene sección propia `spectators[]` en el snapshot (fuera de `participants[]`).
- Solo 1 status por (userId, matchId) — no hay filas duplicadas.

### Match Admin

- Rol delegable: `isMatchAdmin Boolean` + `adminGrantedAt DateTime?` en `MatchParticipant`.
- matchAdmin puede: invite, lock, unlock.
- Solo creator puede: patch, cancel, promote/demote admins.

### Idempotencia de acciones

- `confirm`, `decline`, `toggle-spectator`, `leave`, `cancel` → requieren `Idempotency-Key` header (UUID).
- Guardar `(userId, matchId, action, idempotencyKey)`; responder igual en retries.

### Optimistic locking

- `matches.revision` incrementa en cada mutación relevante.
- Mutations admin incluyen `expectedRevision` en body.
- Mismatch → 409 `REVISION_CONFLICT`.

---

## 4) API conventions

### Errores (Problem Details + X-Request-Id)

| Código HTTP | Cuándo |
|---|---|
| 401 | No autenticado / token inválido / `REFRESH_REUSED` / `SESSION_REVOKED` |
| 403 | Sin permisos / `EMAIL_NOT_VERIFIED` |
| 404 | Recurso no encontrado |
| 409 | Conflicto de estado (`REVISION_CONFLICT`, `MATCH_CANCELLED`, etc.) |
| 422 | Validación de dominio (`DOMAIN_UNPROCESSABLE_CODES`) |

Todos los errores incluyen `errorCode` string. Header `X-Request-Id` en toda respuesta.

### Auth y actor

- Login por `identifier` (email **o** username) + password.
- Access token: 15 min (`JWT_EXPIRES_IN`). Refresh token: opaco `"${sessionId}.${secret}"`, rotación en cada uso (`REFRESH_TOKEN_TTL_DAYS=30`).
- Reuse detection: hash no coincide → revocar todas las sesiones → 401 `REFRESH_REUSED`.
- Email verificado obligatorio antes del primer login.
- Sesiones multi-dispositivo persistidas en DB (`AuthSession`).
- `req.user` shape: `{ userId: string, role: string, sessionId?: string }` (ActorPayload).
- Mobile: SecureStore para tokens; single-flight refresh (si hay refresh en curso, encolar).

### Paginación

Page-based o cursor. Respuesta: `{ items[], pageInfo }`.

### Rate limiting + hardening

Throttle guards activos. Login tracker por `identifier`. Helmet + CORS + body limit configurados.

---

## 5) Realtime (WebSocket)

- Namespace `/matches`, JWT en `auth.token` al conectar.
- El servidor emite **solo** `{ matchId, revision }` — nunca estado parcial ni diffs.
- El cliente siempre refetcha el snapshot via HTTP si `revision > localRevision`.

**Flujo de entrada a sala:**
1. HTTP GET snapshot (incluye `revision`)
2. WS emit `match.subscribe { matchId }`
3. On `match.updated { matchId, revision }`: si `revision > local` → `invalidateQueries` → refetch

**Resync al reconectar:** re-subscribe + GET snapshot forzado.
**Coalesce:** rafaga de N eventos → máximo 2 GETs (usando refs: `isFetchingRef`, `pendingRefetchRef`).
**Presencia:** heartbeat 20-30s, TTL Redis 60s.

> WS nunca como fuente de verdad. Tolerar duplicados y out-of-order.
> Punto de extensión multi-instancia: Socket.IO Redis adapter → `docs/future-implementations.md`.

---

## 6) DB y migraciones

- Una feature = una migración. Nunca duplicar.
- `type String` (no enum Prisma) para tipos de audit log → evita migraciones al agregar eventos.
- Data migrations dentro del SQL de migración (no scripts separados).
- Constraints UNIQUE donde se requiera idempotencia (ej. `clientMsgId`).

### Chat dedupe

- Cliente envía `clientMsgId`.
- DB constraint `UNIQUE(scopeId, senderId, clientMsgId)`.
- Responder ACK con `serverMsgId`.

---

## 7) Mobile (React Native / Expo)

- Target principal: iPhone físico. Web solo debug (algunas APIs no disponibles).
- Estado: **React Query** (server state) antes que estado global. No Redux salvo necesidad real.
- **No toasts**. UX signals via **banners persistentes** (`MatchBanner`, `useMatchUxSignals`).
- Prioridad banners: `canceled` > `reconfirm` > `promoted` > `reconnecting`.
- Manejar reconexión WS: re-subscribe + resync snapshot.
- Pantallas mínimas primero (sin pixel-perfect).

---

## 8) Push notifications

- **Provider actual:** Expo Push (`https://exp.host/--/api/v2/push/send`).
- **Abstracción:** `NotificationProvider` interface, token DI `NOTIFICATION_PROVIDER`. Para migrar a FCM/APNs: nueva clase `FcmNotificationProvider`, cambiar `useClass` en `PushModule`. Cero cambios en dominio.
- **Registro:** `POST /api/v1/push/devices/register` (upsert por `expoPushToken`). Si Expo responde `DeviceNotRegistered` → marcar `disabledAt`.
- **Dedupe:** tabla `NotificationDelivery`. Ventanas por tipo: `invited` 30min, `promoted` 5min, `reconfirm_required` 60min, `canceled` 60min.
- **Fire-and-forget:** post-commit, void + catch warn. No bloquea response. Pérdidas aceptables en MVP.
- **EAS:** `extra.eas.projectId` en `apps/mobile/app.json` para builds de producción.
- Requiere dispositivo físico (no funciona en simulador).

---

## 9) Audit logs

- `MatchAuditLog`: append-only, `type String`, `metadata Json`. Nunca modificar registros.
- `MatchAuditService.log(tx, matchId, actorId, type, metadata)` — dentro de la transacción existente.
- Endpoint: `GET /api/v1/matches/:id/audit-logs?page=1&pageSize=20`.

---

## 10) Testing

Tests obligatorios por regla de negocio, no por cobertura:

- capacity reduce → últimos confirmados a waitlist
- cambio mayor → confirmed → invited (excepto creator)
- leave <1h → `lateLeaveCount++`
- leave con waitlist → promoción 1º FIFO
- revision conflict → 409
- lock → NO bloquea confirm de INVITED
- spectator → no ocupa cupo

Preferir tests de use-cases (application layer) + integración DB para invariantes.

Scripts: `pnpm test` (root) · `pnpm -C apps/api test` · `pnpm -C apps/api test:e2e`.

---

## 11) Documentación

- `docs/stepbystep.md`: registro cronológico. **Obligatorio** actualizar al agregar features, migraciones, cambios de arquitectura. Bug fixes NO se documentan. Mantener índice actualizado.
- `docs/future-implementations.md`: puntos de extensión planificados (no MVP).
- `docs/SKILL.md`: workflow y checklists de implementación → ver ahí antes de escribir código.

---

## 12) "No hacer"

- No mencionar, usar, ni restaurar `WITHDRAWN` / `/withdraw`. Están eliminados.
- No asumir que `locked` bloquea confirmaciones de INVITED — **no lo hace**.
- No meter lógica de negocio crítica en controllers.
- No introducir microservicios, event buses externos, CQRS completo.
- No Redux/estado global sin necesidad real.
- No "dejar para después" idempotencia/revision/constraints.
- No mockear backend por semanas: integrar temprano.
- No crear archivos/carpetas sin necesidad: mínimo sprawl.

---

## 13) Commits y ramas

- Commits pequeños, orientados a slice.
- Prefijos: `feat(api):` · `feat(mobile):` · `fix(core):` · `chore(infra):` · `test(core):`
- Rama principal: `main`. Features en `feat/<nombre>`.
