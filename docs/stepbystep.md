# Fuchibol App — Step by Step

Registro cronologico del desarrollo. Cada seccion documenta que se hizo, archivos clave, decisiones y convenciones.

---

## Indice

1. [Setup del monorepo + Infraestructura](#1-setup-del-monorepo--infraestructura)
2. [API core: esqueleto NestJS + Prisma](#2-api-core-esqueleto-nestjs--prisma)
3. [CI/CD: GitHub Actions](#3-cicd-github-actions)
4. [Shared: paquete de enums](#4-shared-paquete-de-enums)
5. [API: Matches (create + get)](#5-api-matches-create--get)
6. [API: Identity & Access (auth MVP)](#6-api-identity--access-auth-mvp)
7. [API: Match Participation + Idempotencia v1](#7-api-match-participation--idempotencia-v1)
8. [API: Match Updates + Lock/Unlock](#8-api-match-updates--lockunlock)
9. [API: Home List + Paginacion](#9-api-home-list--paginacion)
10. [Infra mobile: LAN bind + pnpm workspaces + health endpoint](#10-infra-mobile-lan-bind--pnpm-workspaces--health-endpoint)
11. [Mobile Slice 1: Login → Home → Detail → Acciones](#11-mobile-slice-1-login--home--detail--acciones)
12. [RNF: Observabilidad + Rate Limiting + Idempotencia v2 + Concurrencia + DB](#12-rnf-observabilidad--rate-limiting--idempotencia-v2--concurrencia--db)
13. [Cambios Mayores: Reconfirmacion robusta](#13-cambios-mayores-reconfirmacion-robusta)
14. [Usernames + Invite por identifier](#14-usernames--invite-por-identifier)
15. [MatchDetail: UI real + Cache UX + Lock/Unlock mobile](#15-matchdetail-ui-real--cache-ux--lockunlock-mobile)
16. [Cancel Match end-to-end](#16-cancel-match-end-to-end)
17. [Navegacion por Tabs](#17-navegacion-por-tabs)
18. [History view + matchStatus derivado](#18-history-view--matchstatus-derivado)
19. [Groups Feature (end-to-end)](#19-groups-feature-end-to-end)
20. [Match Admin + Leave Match + Creator Transfer + Capacity](#20-match-admin--leave-match--creator-transfer--capacity)
21. [Spectator Toggle + Eliminacion WITHDRAWN](#21-spectator-toggle--eliminacion-withdrawn)
22. [Fix: Lock no bloquea confirm para INVITED](#22-fix-lock-no-bloquea-confirm-para-invited)
23. [Realtime: WebSocket (Socket.IO) + Coalesce + Resync](#23-realtime-websocket-socketio--coalesce--resync)
24. [Match Audit Logs + Banners en MatchDetail](#24-match-audit-logs--banners-en-matchdetail)
25. [Push Notifications Step 1: plumbing + prueba e2e](#25-push-notifications-step-1-plumbing--prueba-e2e)
26. [Push Notifications Step 2: triggers de dominio + dedupe](#26-push-notifications-step-2-triggers-de-dominio--dedupe)
27. [Auth: Sessions + Refresh Rotation + Email Verification (Sprint 1)](#27-auth-sessions--refresh-rotation--email-verification-sprint-1)

---

## 1. Setup del monorepo + Infraestructura

### Que se hizo

Monorepo con **pnpm workspaces** (`node-linker=hoisted` para compatibilidad Metro/Expo) y tres workspaces: `apps/api`, `apps/mobile`, `packages/shared`. Docker Compose para PostgreSQL 16 y Redis 7 en desarrollo local.

### Estructura

```
fuchibol-app/
├── apps/api/       # NestJS backend
├── apps/mobile/    # Expo React Native
├── packages/shared/
└── infra/          # Docker Compose
```

### Decisiones

- PostgreSQL como fuente de verdad; Redis para presence y rate limiting (no como message broker).
- `node-linker=hoisted` + `metro.config.js` con `watchFolders`/`nodeModulesPaths` para que Metro resuelva correctamente desde el monorepo.
- Scripts root: `dev:api`, `dev:mobile`, `test`, `lint`.

---

## 2. API core: esqueleto NestJS + Prisma

### Que se hizo

App NestJS bajo `apps/api/` con:
- `PrismaService` singleton via `@prisma/adapter-pg` (connection pooling con `pg.Pool`). Se accede via `prismaService.client`.
- `ConfigModule` global para env vars.
- `ValidationPipe` global (whitelist, transform, 422 en errores).
- `DevAuthMiddleware` en dev: inyecta user fake via header `x-dev-user-id` (se omite si hay `Authorization`).
- Global prefix `/api/v1`.

### Archivos principales

| Archivo | Rol |
|---|---|
| `src/main.ts` | Bootstrap: prefix `api/v1`, ValidationPipe global |
| `src/infra/prisma/prisma.service.ts` | Singleton PrismaClient con lifecycle hooks |
| `src/infra/prisma/prisma-adapter.factory.ts` | Factory PrismaClient + PgAdapter |
| `src/infra/auth/dev-auth.middleware.ts` | Middleware dev: `req.user = { userId, role }` |

### Variables de entorno principales

`DATABASE_URL`, `DATABASE_URL_TEST`, `PORT` (3000), `NODE_ENV`, `TZ=UTC`.

---

## 3. CI/CD: GitHub Actions

Pipeline en `.github/workflows/ci.yml`: checkout → corepack → pnpm install → db:generate → lint → test → test:e2e → build. Servicios: postgres:16 y redis:7. Timeout 15 min, `cancel-in-progress: true`.

---

## 4. Shared: paquete de enums

`packages/shared/src/index.ts` exporta `MatchStatus` y `ParticipantStatus` como objetos `as const` con tipos derivados. Evita enums TypeScript para compatibilidad ESM/tree-shaking.

---

## 5. API: Matches (create + get)

### Que se hizo

Primer slice end-to-end. Endpoints `POST /api/v1/matches` y `GET /api/v1/matches/:id`. Modelos Prisma iniciales: `User` (id UUID, createdAt) y `Match` (id UUID, title, startsAt, capacity, status `MatchStatus`, revision=1, createdById).

### Reglas de negocio

- `capacity > 0` (check constraint DB).
- `startsAt >= 1 minuto en el futuro`.
- Status inicial: `scheduled`, revision inicial: `1`.

### Archivos

| Archivo | Rol |
|---|---|
| `src/matches/application/create-match.use-case.ts` | Crea match con validaciones |
| `src/matches/application/get-match.use-case.ts` | Consulta match, 404 si no existe |
| `src/matches/api/dto/*.dto.ts` | CreateMatchDto, MatchSnapshotDto |

---

## 6. API: Identity & Access (auth MVP)

### Que se hizo

Registro + login con JWT, guards, endpoint `/me`. Dependencias: `@nestjs/jwt`, `passport-jwt`, `argon2` (passwords, nunca bcrypt).

### Migracion

`User` ampliado con: `email` (unique), `passwordHash`, `role` (enum `Role`: USER/ADMIN), `updatedAt`. `Match.createdById` pasa de TEXT a UUID.

### Endpoints

| Metodo | Ruta | Auth | Descripcion |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Publico | Crea user, devuelve `{ accessToken, user }` |
| POST | `/api/v1/auth/login` | Publico | Verifica credenciales, devuelve token |
| GET | `/api/v1/me` | JWT | Devuelve `{ id, email, role, createdAt }` |

### Archivos

| Archivo | Rol |
|---|---|
| `src/auth/guards/jwt-auth.guard.ts` | `AuthGuard('jwt')` |
| `src/auth/guards/roles.guard.ts` | Verifica `@Roles(...)` metadata |
| `src/auth/decorators/actor.decorator.ts` | `@Actor()` → `ActorPayload { userId, role }` |
| `src/auth/infra/jwt.strategy.ts` | Passport JWT: Bearer → `{ userId, role }` |

### Convenciones

- `JWT_SECRET` requerido; `JWT_EXPIRES_IN` default `7d` (tipado con `StringValue` de `ms`).
- Email normalizado `toLowerCase().trim()` en DTOs via `@Transform`.
- `passwordHash` nunca se devuelve en respuestas.
- Error generico en login: no revela si el email existe.
- `pnpm.onlyBuiltDependencies` en root `package.json` incluye `argon2`.
- `req.user` shape: `{ userId: string, role: string }` (`ActorPayload`).

---

## 7. API: Match Participation + Idempotencia v1

### Que se hizo

Sistema completo de participacion con confirm/decline/withdraw/invite. Waitlist FIFO, optimistic locking, idempotencia obligatoria.

### Modelos nuevos

`MatchParticipant` (id, matchId, userId, status `MatchParticipantStatus`, waitlistPosition, confirmedAt) con unique `(matchId, userId)`. `IdempotencyRecord` (key, actorId, route, matchId, responseJson) con unique `(key, actorId, route, matchId)`.

### Endpoints

| Metodo | Ruta | Headers requeridos |
|---|---|---|
| POST | `/api/v1/matches/:id/confirm` | `Idempotency-Key` |
| POST | `/api/v1/matches/:id/decline` | `Idempotency-Key` |
| POST | `/api/v1/matches/:id/withdraw` | `Idempotency-Key` |
| POST | `/api/v1/matches/:id/invite` | `Idempotency-Key` |

### Reglas de negocio

- **Confirm**: cupo libre → CONFIRMED con `confirmedAt`; lleno → WAITLISTED con `waitlistPosition` incremental.
- **Withdraw CONFIRMED**: promueve primer WAITLISTED (MIN `waitlistPosition`) a CONFIRMED.
- **Decline**: solo desde INVITED o WAITLISTED; desde CONFIRMED requiere withdraw primero.
- **Invite**: solo el `createdById` puede invitar; idempotente para re-invite de INVITED.
- **Optimistic locking**: `expectedRevision` en body; si mismatch → 409 `REVISION_CONFLICT`.
- **Waitlist FIFO**: posiciones no se compactan; snapshot normaliza a 1, 2, 3...

### MatchSnapshot

Respuesta enriquecida: `{ id, title, startsAt, capacity, status, revision, confirmedCount, participants[], waitlist[], myStatus, actionsAllowed[], createdAt, updatedAt }`.

### Archivos

| Archivo | Rol |
|---|---|
| `src/matches/application/build-match-snapshot.ts` | Builder compartido del snapshot |
| `src/matches/application/confirm-participation.use-case.ts` | Confirm con waitlist |
| `src/matches/application/decline-participation.use-case.ts` | Decline |
| `src/matches/application/withdraw-participation.use-case.ts` | Withdraw + promueve waitlist |
| `src/matches/application/invite-participation.use-case.ts` | Invite (admin only) |
| `src/common/idempotency/idempotency.service.ts` | Servicio de idempotencia |

---

## 8. API: Match Updates + Lock/Unlock

### Que se hizo

PATCH match con optimistic locking, deteccion de cambios mayores (startsAt/location/capacity → fuerza reconfirmacion), y lock/unlock de matches que bloquea acciones de participacion.

### Migracion

Nuevos campos en `Match`: `location` (nullable), `isLocked` (bool, default false), `lockedAt` (nullable DateTime), `lockedBy` (nullable UUID).

### Endpoints

| Metodo | Ruta | Solo | Descripcion |
|---|---|---|---|
| PATCH | `/api/v1/matches/:id` | Creator | Actualiza match, detecta cambios mayores |
| POST | `/api/v1/matches/:id/lock` | Admin | Setea `isLocked=true`, incrementa revision |
| POST | `/api/v1/matches/:id/unlock` | Admin | Setea `isLocked=false`, incrementa revision |

### Reglas

- **Cambio mayor** (startsAt, location, capacity): todos los CONFIRMED → INVITED; WAITLISTED no se toca.
- Cambiar solo `title` NO es cambio mayor.
- Lock bloquea confirm, decline, invite. Withdraw siempre permitido.
- PATCH en match locked → 409 `MATCH_LOCKED`.
- Lock/unlock son idempotentes si ya estan en el estado solicitado.

### Archivos

| Archivo | Rol |
|---|---|
| `src/matches/application/update-match.use-case.ts` | PATCH + major change detection |
| `src/matches/application/lock-match.use-case.ts` | Lock |
| `src/matches/application/unlock-match.use-case.ts` | Unlock |

---

## 9. API: Home List + Paginacion

### Que se hizo

Endpoint `GET /api/v1/matches` con paginacion, filtros de fecha y scope `mine`. Sin N+1: 4 queries fijas (count, matches, confirmedCount groupBy, myStatus findMany).

### Parametros de query

`page` (default 1), `pageSize` (default 20, max 50), `from`, `to`, `view` (`upcoming`|`history`).

### Migracion

Indices: `(startsAt)` en Match, `(userId, matchId)` y `(matchId, createdAt)` en MatchParticipant.

### Archivos

| Archivo | Rol |
|---|---|
| `src/matches/application/list-matches.query.ts` | Query paginada con scope mine |
| `src/matches/api/dto/list-matches-query.dto.ts` | DTO con validaciones |

---

## 10. Infra mobile: LAN bind + pnpm workspaces + health endpoint

### Que se hizo

- `GET /api/v1/health` publico para smoke tests.
- CORS en `main.ts`: `origin: true` en dev, `ALLOWED_ORIGINS` en prod. Expone `X-Request-Id` y `Retry-After`.
- Bind a `HOST` env var (default `0.0.0.0`) para acceso desde iPhone por LAN.
- `apps/mobile/src/config/env.ts` exporta `apiBaseUrl` desde `EXPO_PUBLIC_API_BASE_URL` (requerido; obtener IP con `ipconfig getifaddr en0`).
- `apps/mobile/src/lib/api.ts`: `fetchJson<T>()` con timeout 12s, `AbortController`, lanza `ApiError`.

### Archivos

| Archivo | Rol |
|---|---|
| `src/app.controller.ts` | Health endpoint |
| `apps/mobile/src/config/env.ts` | `apiBaseUrl` validado |
| `apps/mobile/src/lib/api.ts` | `fetchJson`, `buildUrl`, `ApiError` |
| `apps/mobile/src/lib/token-store.ts` | SecureStore (native) / localStorage (web) |

---

## 11. Mobile Slice 1: Login → Home → Detail → Acciones

### Que se hizo

Flujo E2E completo en mobile: login JWT, lista de matches, detalle, acciones de participacion (confirm/decline/withdraw). Dependencias: `@tanstack/react-query`, `@react-navigation/native-stack`, `expo-secure-store`, `expo-crypto`.

### Archivos

| Archivo | Rol |
|---|---|
| `src/contexts/AuthContext.tsx` | Bootstrap token + GET /me + login/logout |
| `src/features/auth/authClient.ts` | `postLogin`, `getMe` |
| `src/features/matches/matchesClient.ts` | `getMatches`, `getMatch`, `postMatchAction`, etc. |
| `src/features/matches/useMatchAction.ts` | Mutation con retry en REVISION_CONFLICT |
| `src/screens/LoginScreen.tsx` | Form login |
| `src/screens/HomeScreen.tsx` | FlatList matches + pull-to-refresh |
| `src/screens/MatchDetailScreen.tsx` | Snapshot + acciones |

### Decisiones

- Token passing explicito en cada funcion cliente (no interceptores globales).
- Backend drives UI: botones segun `actionsAllowed` del snapshot.
- `useMatchAction`: en 409 REVISION_CONFLICT → refetch revision → retry con nuevo UUID (max 1).
- `onSuccess`: `setQueryData(['match', matchId], { match: data })` + `invalidateQueries(['matches'])`.
- `useLogoutOn401(query)`: si ApiError 401 → `logout()` automático.
- `keepPreviousData` en `useMatch` y `useMatches` para evitar parpadeos durante refetch.
- `lastDataRef` pattern (`displayData = data ?? lastDataRef.current`) para evitar pantalla en blanco cuando React freeze + invalidation race condition.
- Pull-to-refresh usa `isManualRefresh` local (no `isRefetching`) para evitar spinner stuck al volver de MatchDetail.
- Token web: `localStorage`; token native: `expo-secure-store`.

---

## 12. RNF: Observabilidad + Rate Limiting + Idempotencia v2 + Concurrencia + DB

### Que se hizo

**Observabilidad**: `X-Request-Id` end-to-end (middleware genera/extrae, header expuesto). Logging estructurado por request. Error envelope Problem Details: `{ type, title, status, code, detail, requestId }`. `code` estable (ej. `REVISION_CONFLICT`, `RATE_LIMITED`).

**Rate Limiting**: `@nestjs/throttler` con Redis storage (`REDIS_CLIENT` global via `ioredis`) + fallback in-memory. 3 perfiles: `login` (5/10min), `mutations` (30/1min), `reads` (120/1min). Key por actor (autenticado) o IP.

**Helmet + CORS por ambiente**: headers de seguridad, body limit 1mb.

**Idempotencia v2**: `requestHash` SHA-256 del body. TTL `expiresAt` (default 48h). Si misma key + hash distinto → 409 `IDEMPOTENCY_KEY_REUSE`. Registros expirados se re-ejecutan. Cleanup job cada hora. Constraint simplificado a `(key, actorId, route)`.

**SELECT FOR UPDATE**: se agrego `lockMatchRow(tx, matchId)` al inicio de todas las transacciones de mutacion de matches para adquirir exclusive row lock y garantizar que optimistic locking funcione bajo concurrencia real.

**DB Hygiene**: indices auditados. Agregados: `(userId, matchId)` covering index para home query, `(matchId, createdAt)` para snapshot ordering.

### Archivos clave

| Archivo | Rol |
|---|---|
| `src/common/filters/api-exception.filter.ts` | Problem Details global |
| `src/common/middleware/request-id.middleware.ts` | X-Request-Id |
| `src/common/interceptors/http-logging.interceptor.ts` | Log por request |
| `src/infra/redis/redis.module.ts` | RedisModule global (`REDIS_CLIENT`) |
| `src/infra/redis/redis-throttle-storage.ts` | ThrottlerStorage Redis + fallback |
| `src/common/throttle/throttle.module.ts` | AppThrottleModule (3 perfiles) |
| `src/common/idempotency/idempotency.service.ts` | Idempotencia con hash + TTL |
| `src/common/idempotency/idempotency-cleanup.service.ts` | Cleanup job (ScheduleModule) |
| `src/matches/application/lock-match-row.ts` | `SELECT ... FOR UPDATE` helper |

---

## 13. Cambios Mayores: Reconfirmacion robusta

### Que se hizo

Correccion de 3 bugs en la deteccion de cambios mayores en `UpdateMatchUseCase`:

1. **Deteccion por valor real** (no por presencia): solo dispara reconfirmacion si el valor enviado difiere del actual.
2. **Lock guard en PATCH**: si match esta locked → 409 `MATCH_LOCKED`.
3. **Capacity como campo mayor**: reducir capacity dispara reconfirmacion (CONFIRMED → INVITED), no overflow-to-waitlist. Check `CAPACITY_BELOW_CONFIRMED` eliminado como dead code.

### Archivos

| Archivo | Cambio |
|---|---|
| `src/matches/application/update-match.use-case.ts` | Fix deteccion, +isLocked check, removed dead code |
| `test/e2e/major-change-reconfirmation.e2e-spec.ts` | 7 e2e tests de reconfirmacion |

---

## 14. Usernames + Invite por identifier

### Que se hizo

**Usernames**: campo `username` unico agregado a `User`. Auto-generacion desde local part del email (3-20 chars, lowercase alphanum + underscore). Colisiones resueltas con sufijo numerico. Endpoint `GET /api/v1/users/lookup?query=` busca por username o email.

**Invite por identifier**: `POST /api/v1/matches/:id/invite` acepta `identifier` (username, `@username`, o email) ademas de `userId`. Nuevos error codes: `USER_NOT_FOUND` (404), `SELF_INVITE` (409), `ALREADY_PARTICIPANT` (409).

### Archivos

| Archivo | Rol |
|---|---|
| `src/users/api/users.controller.ts` | GET /users/lookup |
| `src/users/application/lookup-user.query.ts` | Busca por email o username, 404 si no existe |
| `src/auth/application/register.use-case.ts` | Auto-gen username, collision handling |
| `src/matches/application/invite-participation.use-case.ts` | Resolución identifier → userId |
| `src/common/helpers/resolve-user.helper.ts` | Helper compartido de resolución |

---

## 15. MatchDetail: UI real + Cache UX + Lock/Unlock mobile

### Que se hizo

Reescritura de `MatchDetailScreen` para mostrar estado real con participantes agrupados por seccion (Confirmed/Invited/Waitlist/Declined), contadores visuales, badges de estado, formato fecha/hora 24hs, y botones segun `actionsAllowed`. Enriched con `username` (incluido en `ParticipantView` via `include: { user: { select: { username: true } } }` en snapshot query).

**Lock/Unlock mobile**: hook `useLockMatch`/`useUnlockMatch` con patron identico a `useMatchAction` (retry REVISION_CONFLICT, logout 401, update cache). Banner "Match is locked" cuando `isLocked`. Acciones de participacion e invite ocultas cuando locked.

### Archivos

| Archivo | Cambio |
|---|---|
| `src/matches/application/build-match-snapshot.ts` | +username en ParticipantView |
| `apps/mobile/src/features/matches/useLockMatch.ts` | Hooks lock/unlock |
| `apps/mobile/src/screens/MatchDetailScreen.tsx` | UI completa: badges, grupos, lock banner |

---

## 16. Cancel Match end-to-end

### Que se hizo

Cancel match: solo el creator puede cancelar. Una vez cancelado, todas las acciones (confirm, decline, withdraw, invite, lock, unlock, update) responden 409 `MATCH_CANCELLED`. `actionsAllowed` vacia cuando cancelado.

Endpoint: `POST /api/v1/matches/:id/cancel` (requiere `Idempotency-Key`). Idempotente si ya esta cancelado. Cambia `match.status` a `canceled`.

### Archivos

| Archivo | Cambio |
|---|---|
| `src/matches/application/cancel-match.use-case.ts` | Nuevo |
| `src/matches/application/build-match-snapshot.ts` | actionsAllowed vacío cuando canceled |
| 7 use-cases de mutacion | Guard `MATCH_CANCELLED` antes de otros checks |
| `apps/mobile/src/features/matches/useCancelMatch.ts` | Nuevo hook |
| `apps/mobile/src/screens/MatchDetailScreen.tsx` | Banner cancelled, boton Cancel con Alert |

---

## 17. Navegacion por Tabs

### Que se hizo

Reestructuracion de navegacion de flat NativeStack a Bottom Tabs + Root Stack. 5 tabs: Home, Groups, Create (interceptado para abrir CreateMatch como modal), Profile, Settings. `navigationRef` (`createNavigationContainerRef`) exportado para navegacion imperativa (necesario para deep links desde notificaciones).

### Tipos

`TabParamList` (HomeTab, GroupsTab, CreateTab, ProfileTab, SettingsTab) y `RootStackParamList` (MainTabs, CreateMatch, MatchDetail, EditMatch, MatchHistory, CreateGroup, GroupDetail). `AppStackParamList` mantenido como alias backwards-compat.

---

## 18. History view + matchStatus derivado

### Que se hizo

**History view**: parametro `view` en `GET /api/v1/matches`: `upcoming` (default, excluye canceled y played), `history` (canceled OR startsAt <= now - 1h). Pantalla `MatchHistoryScreen` en mobile, accesible desde Profile.

**matchStatus derivado** (`computeMatchStatusView`): campo calculado (no persistido) `UPCOMING` | `PLAYED` | `CANCELLED`. Regla: `canceled` → CANCELLED; `startsAt + 1h <= now` → PLAYED; else → UPCOMING. Incluido en `MatchHomeItem` y `MatchSnapshot`. HomeScreen usa `matchStatus` como badge principal.

### Archivos

| Archivo | Cambio |
|---|---|
| `src/matches/domain/compute-match-status-view.ts` | Funcion pura + tipo |
| `src/matches/application/list-matches.query.ts` | Filtro por view, `matchStatus` en items |
| `src/matches/application/build-match-snapshot.ts` | `matchStatus` en snapshot |
| `apps/mobile/src/screens/MatchHistoryScreen.tsx` | Nuevo: historial con badge PLAYED/CANCELLED |

---

## 19. Groups Feature (end-to-end)

### Que se hizo

Feature completa de grupos: CRUD backend + pantallas mobile + "Invite from Group" en MatchDetail.

### Modelos

`Group` (id, name, ownerId, timestamps) con `@@index([ownerId])`. `GroupMember` (groupId, userId, createdAt) con composite PK `@@id([groupId, userId])` y `@@index([userId])`. Cascade delete en Group → GroupMember.

### Endpoints

| Metodo | Ruta | Accion |
|---|---|---|
| POST | `/api/v1/groups` | Crear grupo (auto-agrega owner como miembro) |
| GET | `/api/v1/groups` | Listar: `{ owned[], memberOf[] }` con `memberCount` |
| GET | `/api/v1/groups/:id` | Detalle + members (solo si eres miembro, 403 si no) |
| POST | `/api/v1/groups/:id/members` | Agrega miembro por identifier |
| DELETE | `/api/v1/groups/:id/members/:userId` | Owner remueve a cualquiera; user se saca solo; owner no puede salirse (409 `OWNER_CANNOT_LEAVE`) |

### Mobile

Pantallas `GroupsScreen` (dos secciones), `CreateGroupScreen`, `GroupDetailScreen` (add member owner-only, remove/leave con Alert). Batch invite: `useBatchInviteFromGroup` loop secuencial con retry en REVISION_CONFLICT.

### Archivos

| Archivo | Rol |
|---|---|
| `src/groups/groups.module.ts` + controller + 5 use-cases | Modulo completo |
| `src/common/helpers/resolve-user.helper.ts` | Resolucion identifier → user (compartido con invite) |
| `apps/mobile/src/features/groups/` | Client + 5 hooks |
| `apps/mobile/src/screens/GroupsScreen.tsx` | Reescrito |
| `apps/mobile/src/screens/CreateGroupScreen.tsx` | Nuevo |
| `apps/mobile/src/screens/GroupDetailScreen.tsx` | Nuevo |
| `apps/mobile/src/features/matches/useBatchInviteFromGroup.ts` | Batch invite hook |

---

## 20. Match Admin + Leave Match + Creator Transfer + Capacity

### Que se hizo

**Match Admin**: rol delegable en `MatchParticipant` (`isMatchAdmin Boolean`, `adminGrantedAt DateTime?`). matchAdmin puede: invite, lock, unlock. Solo creator puede: patch, cancel, promote/demote admins.

**Reconfirmacion respeta creator**: en cambios mayores, CONFIRMED → INVITED EXCEPTO el creator que permanece CONFIRMED.

**Endpoints admin**: `POST /api/v1/matches/:id/admins` (promote, body `{ userId, expectedRevision }`) y `DELETE /api/v1/matches/:id/admins/:userId` (demote). Error codes: `NOT_PARTICIPANT` (422), `CANNOT_DEMOTE_CREATOR` (422).

**Leave Match**: `POST /api/v1/matches/:id/leave` — hard delete de la fila `MatchParticipant` (a diferencia de withdraw que seteaba WITHDRAWN). Si era CONFIRMED → promueve primer WAITLISTED. Creator leave requiere al menos un admin activo; transfiere `createdById` al primer admin por `adminGrantedAt ASC` (422 `CREATOR_TRANSFER_REQUIRED` si no hay). Idempotente si no era participante. Re-invite funciona naturalmente (crea nueva fila).

**Capacity overflow/reconfirm**: cambiar capacity es cambio mayor (CONFIRMED → INVITED excepto creator). No existe overflow-to-waitlist.

### Archivos

| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` | +isMatchAdmin, +adminGrantedAt en MatchParticipant |
| `src/matches/application/match-permissions.ts` | Helper `isCreatorOrMatchAdmin()` |
| `src/matches/application/promote-admin.use-case.ts` | Nuevo |
| `src/matches/application/demote-admin.use-case.ts` | Nuevo |
| `src/matches/application/leave-match.use-case.ts` | Nuevo: hard delete + creator transfer + late-leave penalty |
| `src/matches/application/update-match.use-case.ts` | Reconfirm excluye creator |
| `src/matches/application/withdraw-participation.use-case.ts` | Creator transfer (eliminado en step 21) |
| `src/common/filters/api-exception.filter.ts` | `DOMAIN_UNPROCESSABLE_CODES` (422) |
| `apps/mobile/src/screens/EditMatchScreen.tsx` | Nuevo: form prellenado + PATCH |
| `apps/mobile/src/screens/MatchDetailScreen.tsx` | Leave, Edit, Promote/Demote, Creator/Admin badges |

---

## 21. Spectator Toggle + Eliminacion WITHDRAWN

### Que se hizo

**Spectator Toggle**: nuevo endpoint `POST /api/v1/matches/:id/spectator`. Comportamiento: sin row → SPECTATOR; SPECTATOR → INVITED; CONFIRMED → SPECTATOR + promueve WAITLISTED; cualquier otro estado → SPECTATOR. No ocupa cupo, no aparece en `participants[]` del snapshot (tiene sección propia `spectators[]`). Requiere `Idempotency-Key`.

**Late-leave penalty**: en `leave-match.use-case.ts`, si `startsAt - now() <= 1h` → `user.lateLeaveCount += 1`.

**Eliminacion WITHDRAWN**: se elimino el valor `WITHDRAWN` del enum `MatchParticipantStatus` y el `WithdrawParticipationUseCase`. Migracion de datos: `UPDATE ... SET status = 'SPECTATOR' WHERE status = 'WITHDRAWN'`. Endpoint `/withdraw` removido. Invite a SPECTATOR: ahora setea a INVITED (en lugar de 409 ALREADY_PARTICIPANT).

### Archivos

| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` | +SPECTATOR en enum, -WITHDRAWN, +lateLeaveCount en User |
| `prisma/migrations/..._migrate_withdrawn_to_spectator/migration.sql` | Data migration |
| `src/matches/application/toggle-spectator.use-case.ts` | Nuevo |
| `src/matches/application/withdraw-participation.use-case.ts` | Eliminado |
| `src/matches/application/build-match-snapshot.ts` | +spectators[], -WITHDRAWN de filtros |
| `src/matches/application/leave-match.use-case.ts` | +lateLeaveCount penalty, -WITHDRAWN de notIn |
| `apps/mobile/src/screens/MatchDetailScreen.tsx` | +seccion Spectators, +boton toggle Spectator/Participate |

---

## 22. Fix: Lock no bloquea confirm para INVITED

### Que se hizo

Regla corregida: `locked` bloquea invite y nuevas confirmaciones de usuarios sin status, pero NO bloquea confirm de usuarios ya INVITED. Fix en `confirm-participation.use-case.ts`: check `if (match.isLocked && existing?.status !== 'INVITED')`. Fix en `build-match-snapshot.ts`: cuando locked, si `myStatus === 'INVITED'` → `'confirm'` incluido en `actionsAllowed`.

### Archivos

- `src/matches/application/confirm-participation.use-case.ts`
- `src/matches/application/build-match-snapshot.ts`

---

## 23. Realtime: WebSocket (Socket.IO) + Coalesce + Resync

### Que se hizo

Realtime best-effort: servidor emite `{ matchId, revision }` y el cliente refetchea el snapshot via HTTP si `revision > localRevision`.

**Arquitectura**:
1. Cliente abre MatchDetail → HTTP GET snapshot (incluye `revision`)
2. Cliente conecta WS al namespace `/matches` con JWT en `auth.token`
3. Cliente emite `match.subscribe { matchId }` → servidor une al room `match:{matchId}`
4. Mutacion exitosa → servidor emite `match.updated { matchId, revision }` al room
5. Cliente compara revision → `invalidateQueries(['match', matchId])` → React Query refetchea

**Coalesce**: previene N GETs seguidos en rafagas. Usando refs (`isFetchingRef`, `pendingRefetchRef`, `latestSeenRevisionRef`): rafaga de 10 eventos → maximo 2 GETs.

**Resync al reconectar**: en evento `connect` (primera conexion y reconexiones): re-emite `match.subscribe { matchId, lastKnownRevision }` + fuerza GET.

**wsConnected state**: expuesto por `useMatchRealtime` para banner "reconnecting" en UI.

### Archivos

| Archivo | Rol |
|---|---|
| `src/matches/realtime/match.gateway.ts` | Gateway Socket.IO namespace `/matches` |
| `src/matches/realtime/match-realtime.publisher.ts` | `notifyMatchUpdated(matchId, revision)` |
| `src/matches/realtime/match-realtime.module.ts` | Modulo realtime |
| `src/matches/api/matches.controller.ts` | Llama `notifyMatchUpdated` tras cada mutacion |
| `apps/mobile/src/lib/socket.ts` | Singleton socket.io-client |
| `apps/mobile/src/features/matches/useMatchRealtime.ts` | Subscribe + coalesce + reconnect |

---

## 24. Match Audit Logs + Banners en MatchDetail

### Que se hizo

**Audit Logs**: historial append-only de actividad por partido. Modelo `MatchAuditLog` (id, matchId, actorId, type `String`, metadata `Json`, createdAt) con `@@index([matchId, createdAt(sort: Desc)])`. `type` es String (no enum Prisma) para evitar migraciones al agregar eventos.

`MatchAuditService.log(tx, matchId, actorId, type, metadata)` inserta DENTRO de la transaccion existente. Los logs cubren: `participant.confirmed`, `participant.declined`, `participant.left`, `participant.spectator_on/off`, `waitlist.promoted`, `match.locked/unlocked/canceled/updated_major`, `invite.sent`, `admin.promoted/demoted`.

Endpoint: `GET /api/v1/matches/:id/audit-logs?page=1&pageSize=20`. Responde `{ items[], pageInfo }` con actor `{ id, username }`.

Mobile: sección "Actividad" colapsable en MatchDetail con `useMatchAuditLogs` (infinite query, lazy). Formateador `formatAuditLog(entry)` en español.

**Banners en MatchDetail**: Hook `useMatchUxSignals` detecta banner de mayor prioridad. Componente `MatchBanner` (View persistente con boton ✕ solo en banner promovido).

| Prioridad | Tipo | Condicion |
|---|---|---|
| 1 | `canceled` | `match.status === 'canceled'` |
| 2 | `reconfirm` | `myStatus === 'INVITED'` + `'confirm' in actionsAllowed` |
| 3 | `promoted` | Transicion WAITLISTED→CONFIRMED (una vez por sesion, via `useRef`) |
| 4 | `reconnecting` | `wsConnected === false` + match cargado |

### Archivos

| Archivo | Rol |
|---|---|
| `prisma/schema.prisma` | +MatchAuditLog + relaciones |
| `src/matches/application/match-audit.service.ts` | Servicio + constantes `AuditLogType` |
| `src/matches/application/get-match-audit-logs.query.ts` | Query paginada |
| 11 use-cases de mutacion | Inyeccion `MatchAuditService` + llamadas `audit.log()` |
| `apps/mobile/src/features/matches/useMatchAuditLogs.ts` | Hook infinite query |
| `apps/mobile/src/features/matches/useMatchUxSignals.ts` | Hook logica de banners |
| `apps/mobile/src/components/MatchBanner.tsx` | Componente banner |

---

## 25. Push Notifications Step 1: plumbing + prueba e2e

### Que se hizo

Plumbing completo de push notifications (Expo) sin conectar aún a eventos de dominio. Objetivo: token registrado en DB + notificación de prueba llegando al iPhone real.

### Backend

**Nuevo modelo `PushDevice`**: id (UUID), userId (FK), expoPushToken (unique), platform, deviceName (nullable), createdAt, lastSeenAt, disabledAt (nullable). `@@index([userId])`.

**Endpoints**:

| Metodo | Ruta | Auth | Descripcion |
|---|---|---|---|
| POST | `/api/v1/push/devices/register` | JWT | Upsert por `expoPushToken`. Actualiza userId, platform, deviceName, lastSeenAt, limpia disabledAt. |
| POST | `/api/v1/push/test` | JWT (solo dev o ADMIN) | Envia push a todos los dispositivos activos del actor. Body: `{ title, body, matchId? }`. Retorna `{ sent, total, errors }`. |

`PushService.sendExpoPush()` llama a `https://exp.host/--/api/v2/push/send` via `fetch`. Si Expo responde `DeviceNotRegistered` → marca device con `disabledAt = now()`. `PushService` es exportado por `PushModule` para uso futuro en triggers de dominio.

Validacion de token: `@Matches(/^Expo(nent)?PushToken\[.+\]$/)` en `RegisterDeviceDto` → 422 si invalido.

### Mobile

Dependencias: `expo-notifications`, `expo-device`. Plugin en `app.json`: `["expo-notifications", { "iosDisplayInForeground": true }]`.

`App.tsx`: `setNotificationHandler` (foreground), `addNotificationReceivedListener` (log DEV), `addNotificationResponseReceivedListener` (tap → navega a `MatchDetail` si `data.matchId`), `getLastNotificationResponseAsync` (cold start).

`usePushNotifications`: pide permisos, obtiene token con `getExpoPushTokenAsync`, registra en backend, persiste `push_token` / `push_enabled` en SecureStore. `SettingsScreen`: boton con estados idle/requesting/registered/denied/error. Muestra token parcial en DEV. Deshabilitado en web.

### Gotchas

- Requiere **dispositivo fisico** (no funciona en simulador).
- En Expo Go, `getExpoPushTokenAsync` usa el projectId del Expo account dev automaticamente. Para builds de produccion se necesita `extra.eas.projectId` en `app.json`.
- Token Expo puede **rotar** entre reinstalaciones; el upsert por token lo maneja.

### Archivos

| Archivo | Cambio |
|---|---|
| `apps/api/prisma/schema.prisma` | +PushDevice model, +pushDevices relation en User |
| `apps/api/src/push/push.module.ts` | Modulo nuevo |
| `apps/api/src/push/api/push.controller.ts` | Endpoints register + test |
| `apps/api/src/push/api/dto/register-device.dto.ts` | DTO con @Matches token |
| `apps/api/src/push/api/dto/test-push.dto.ts` | DTO test push |
| `apps/api/src/push/application/register-device.use-case.ts` | Upsert use-case |
| `apps/api/src/push/application/push.service.ts` | Expo HTTP push + disable on DeviceNotRegistered |
| `apps/api/src/app.module.ts` | +PushModule |
| `apps/mobile/app.json` | +plugin expo-notifications |
| `apps/mobile/App.tsx` | +notification handlers, +navigationRef |
| `apps/mobile/src/navigation/AppNavigator.tsx` | +navigationRef export |
| `apps/mobile/src/features/push/pushClient.ts` | `registerPushDevice()` |
| `apps/mobile/src/features/push/usePushNotifications.ts` | Hook permisos + registro |
| `apps/mobile/src/screens/SettingsScreen.tsx` | Boton activacion notificaciones |

### Checklist de prueba manual (iPhone real, Expo Go)

1. Settings → "Enable notifications" → confirmar popup iOS → boton verde "Notifications enabled ✓".
2. `POST /api/v1/push/test` con `{ "title": "Test", "body": "Hola!", "matchId": "<uuid>" }` → notificacion llega.
3. Al tocar: app abre MatchDetail del matchId indicado.

---

## 26. Push Notifications Step 2: triggers de dominio + dedupe

### Que se hizo

Integración push notifications con eventos de dominio para 4 triggers: invited, promoted, reconfirm_required, canceled. Fire-and-forget post-commit con dedupe por ventana de tiempo.

### Arquitectura

**Abstracción de proveedor**: `NotificationProvider` interface (`sendToUser(userId, payload)`). `ExpoNotificationProvider` implementa la interface usando `PushService`. Token DI: `NOTIFICATION_PROVIDER`. Permite swapear a FCM/APNs sin tocar dominio.

**Tabla dedupe**: `NotificationDelivery` (id, userId, matchId, type, createdAt). Índice en `(userId, matchId, type, createdAt)`. Ventanas de cooldown configuradas en `MatchNotificationService`:

| Tipo | Ventana |
|---|---|
| `invited` | 30 min |
| `promoted` | 5 min |
| `reconfirm_required` | 60 min |
| `canceled` | 60 min |

**`MatchNotificationService`**: en `matches/application/`. Métodos: `onInvited`, `onPromoted`, `onReconfirmRequired`, `onCanceled`. Cada método: chequea `shouldSend` (query por cooldown), llama `provider.sendToUser`, inserta `NotificationDelivery`.

### Triggers y dónde se disparan

| Trigger | Use-case | Qué notifica |
|---|---|---|
| `invited` | `invite-participation.use-case.ts` | Al `targetUserId` post-commit |
| `promoted` | `leave-match.use-case.ts` + `toggle-spectator.use-case.ts` | Al `promotedUserId` si hay promoción |
| `reconfirm_required` | `update-match.use-case.ts` | A todos los confirmed→invited por cambio mayor |
| `canceled` | `cancel-match.use-case.ts` | A CONFIRMED+WAITLISTED+INVITED+SPECTATOR (no actor) |

**Patrón fire-and-forget**: `void service.onX(...).catch(err => logger.warn(...))`. La transacción ya committed cuando se ejecuta la notificación. No se bloquea el response del comando principal.

**Captura de datos**: `leave-match` y `toggle-spectator` cambiaron su `run()` para retornar `{ snapshot, promotedUserId }`. `update-match` captura `reconfirmUserIds` antes del `updateMany` via `findMany`. `cancel-match` consulta participantes post-commit (participants no cambian de status al cancelar).

### Payload deep-link

Todos los payloads incluyen `data: { type, matchId }` para que el handler de tap en mobile pueda navegar a `MatchDetail`.

### Gotchas

- **No BullMQ por ahora**: fire-and-forget. Si el proceso muere entre commit y envío, la notificación se pierde. Aceptable para MVP.
- **No notifica al actor**: en `onCanceled` se filtra `actorId` de los destinatarios.
- **Dedupe no es idempotency**: la idempotency del use-case y la dedupe de notificaciones son independientes. La dedupe protege ante replays de idempotency que dispararían la misma notificación.
- **Capacity reduce no dispara reconfirm**: ya decidido anteriormente; `update-match` solo dispara reconfirm por cambios en startsAt, location, o reducción de capacidad que fuerce waitlist. La lógica de qué es "major change" está en el use-case.

### Archivos

| Archivo | Cambio |
|---|---|
| `apps/api/prisma/schema.prisma` | +NotificationDelivery model |
| `apps/api/src/push/notification-provider.interface.ts` | Interface NotificationProvider + token DI |
| `apps/api/src/push/expo-notification.provider.ts` | Implementación Expo |
| `apps/api/src/push/push.module.ts` | +ExpoNotificationProvider, exporta NOTIFICATION_PROVIDER |
| `apps/api/src/matches/application/match-notification.service.ts` | Servicio dedupe + 4 triggers |
| `apps/api/src/matches/matches.module.ts` | +PushModule import, +MatchNotificationService |
| `invite-participation.use-case.ts` | +onInvited post-commit |
| `leave-match.use-case.ts` | run() retorna { snapshot, promotedUserId }, +onPromoted |
| `toggle-spectator.use-case.ts` | run() retorna { snapshot, promotedUserId }, +onPromoted |
| `update-match.use-case.ts` | captura reconfirmUserIds antes del updateMany, +onReconfirmRequired |
| `cancel-match.use-case.ts` | +notifyCanceled() post-commit |

### Extensión futura

- **FCM/APNs**: implementar nueva clase `FcmNotificationProvider implements NotificationProvider`, cambiar el `useClass` en `PushModule`. Cero cambios en dominio.

---

## 27. Auth: Sessions + Refresh Rotation + Email Verification (Sprint 1)

### Que se hizo

Upgrade del módulo auth a autenticación production-quality:
- Access tokens de 15 minutos (antes 7 días)
- Refresh tokens opacos con rotación y reuse-detection
- Sesiones multi-dispositivo persistidas en DB (`AuthSession`)
- Verificación de email obligatoria antes del primer login
- Login por email **o** username (campo `identifier`)

### Migración

`20260226225341_auth_sessions_email_verify`

```sql
-- User: +emailVerifiedAt DateTime?
-- New: AuthSession (id, userId, refreshTokenHash, expiresAt, revokedAt, device info, ...)
-- New: EmailVerificationToken (id, userId, tokenHash, expiresAt, usedAt)
```

### Formato del refresh token

```
refreshToken = "${sessionId}.${secret}"
```

- `sessionId`: UUID — lookup directo sin scan
- `secret`: `crypto.randomBytes(32).toString('base64url')` — validado contra argon2 hash
- DB guarda: `refreshTokenHash = argon2.hash(secret)` (rotate: update en la misma session)

Email verification token: `crypto.randomBytes(32).toString('hex')`, DB guarda `sha256(token)` (determinístico → lookup by hash).

### Reuse detection

Si `argon2.verify(hash, secret) === false` en un refresh válido: se revocan **todas** las sesiones del usuario y se responde `401 REFRESH_REUSED`.

### Archivos nuevos/modificados

| Archivo | Acción |
|---------|--------|
| `prisma/schema.prisma` | +emailVerifiedAt en User, +AuthSession, +EmailVerificationToken |
| `auth/infra/token.service.ts` | nuevo — genera/parsea/hashea refresh y email tokens |
| `auth/infra/email.service.ts` | nuevo — abstract EmailService + DevEmailService (logs to console) |
| `auth/infra/jwt.strategy.ts` | +sid claim en validate() |
| `auth/interfaces/actor-payload.interface.ts` | +sessionId?: string |
| `auth/@types/express/index.d.ts` | +sessionId?: string en req.user |
| `auth/application/register.use-case.ts` | no retorna JWT; crea emailToken; llama EmailService |
| `auth/application/login.use-case.ts` | identifier (email/username); check emailVerifiedAt; crea AuthSession; retorna accessToken + refreshToken |
| `auth/application/refresh.use-case.ts` | nuevo — valida sesión, rotate, reuse detection |
| `auth/application/logout.use-case.ts` | nuevo — revoca sesión actual por sid |
| `auth/application/logout-all.use-case.ts` | nuevo — revoca todas las sesiones del usuario |
| `auth/application/list-sessions.query.ts` | nuevo — lista sesiones activas |
| `auth/application/revoke-session.command.ts` | nuevo — revoca sesión específica con ownership check |
| `auth/application/request-email-verify.use-case.ts` | nuevo — invalida tokens anteriores, crea nuevo, envía email |
| `auth/application/confirm-email-verify.use-case.ts` | nuevo — valida hash, marca usedAt, setea emailVerifiedAt |
| `auth/api/auth.controller.ts` | +/refresh, /logout, /logout-all |
| `auth/api/sessions.controller.ts` | nuevo — GET /auth/sessions, DELETE /auth/sessions/:id |
| `auth/api/email-verify.controller.ts` | nuevo — POST /auth/email/verify/request y /confirm |
| `auth/api/dto/login.dto.ts` | email → identifier (sin @IsEmail); +device opcional |
| `auth/api/dto/refresh.dto.ts` | nuevo |
| `auth/api/dto/request-email-verify.dto.ts` | nuevo |
| `auth/api/dto/confirm-email-verify.dto.ts` | nuevo |
| `auth/auth.module.ts` | registra todos los nuevos providers y controllers; JWT default 15m |
| `common/filters/api-exception.filter.ts` | +EMAIL_NOT_VERIFIED (403), +REFRESH_REUSED/SESSION_REVOKED/REFRESH_EXPIRED (401) |
| `common/guards/app-throttle.guard.ts` | email → identifier en login tracker |
| `.env.example` | JWT_EXPIRES_IN="15m" + REFRESH_TOKEN_TTL_DAYS=30 |

### Nuevos endpoints

| Endpoint | Auth | Throttle |
|----------|------|----------|
| `POST /auth/register` | — | mutations |
| `POST /auth/login` | — | login |
| `POST /auth/refresh` | — | login |
| `POST /auth/logout` | JWT | — |
| `POST /auth/logout-all` | JWT | — |
| `GET /auth/sessions` | JWT | — |
| `DELETE /auth/sessions/:id` | JWT | — |
| `POST /auth/email/verify/request` | — | login |
| `POST /auth/email/verify/confirm` | — | — |
- **Job queue (BullMQ)**: si se necesita garantía de entrega, envolver los `void service.onX()` en jobs de Redis. El `MatchNotificationService` queda igual, solo cambia quién lo invoca (worker vs use-case).
