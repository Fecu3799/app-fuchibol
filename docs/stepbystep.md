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
28. [Auth Mobile Sprint 2: SecureStore + Bootstrap + Single-flight Refresh + Email Verify UX](#28-auth-mobile-sprint-2-securestore--bootstrap--single-flight-refresh--email-verify-ux)
29. [Auth Mobile Sprint 3: Register + Verify Email end-to-end](#29-auth-mobile-sprint-3-register--verify-email-end-to-end)
30. [Auth Sprint 4: Password Reset + Change Password](#30-auth-sprint-4-password-reset--change-password)
31. [Auth Sprint 5: Auth Audit Events + Session Management UI](#31-auth-sprint-5-auth-audit-events--session-management-ui)
32. [Push: Backend source of truth + deviceId + group_added notification](#32-push-backend-source-of-truth--deviceid--group_added-notification)
33. [MatchGender computed + Reject invite (reemplaza Decline)](#33-matchgender-computed--reject-invite-reemplaza-decline)
34. [Mobile PR 3: MatchDetail redesign (countdown, matchGender, Reject, OthersSection)](#34-mobile-pr-3-matchdetail-redesign-countdown-matchgender-reject-otherssection)
35. [Match Lifecycle: Scheduler + Freeze Edit + Missing-Players Alerts + Notification Bucket Dedup](#35-match-lifecycle-scheduler--freeze-edit--missing-players-alerts--notification-bucket-dedup)
36. [User Profile Fields + termsAcceptedAt](#36-user-profile-fields--termsacceptedat)
37. [Reliability Score + Suspension (Sprint 1)](#37-reliability-score--suspension-sprint-1)
39. [Venues + CreateMatch en 2 pasos](#39-venues--creatematch-en-2-pasos)
40. [Match Lifecycle: IN_PROGRESS + PLAYED DB-driven](#40-match-lifecycle-in_progress--played-db-driven)
41. [Team Assembly Sprint 3: Roster integration (slot sync automático)](#41-team-assembly-sprint-3-roster-integration-slot-sync-automático)
42. [Team Assembly Sprint 4: Auto-generación de equipos a T-30](#42-team-assembly-sprint-4-auto-generación-de-equipos-a-t-30)
43. [Chat Sprint 1: Infraestructura de chat + Match chat end-to-end](#43-chat-sprint-1-infraestructura-de-chat--match-chat-end-to-end)
44. [Chat Sprint 2: Home > Chats > Matches (lista de conversaciones)](#44-chat-sprint-2-home--chats--matches-lista-de-conversaciones)
45. [Chat Sprint 3: Group Chat end-to-end](#45-chat-sprint-3-group-chat-end-to-end)
46. [Chat Sprint 4: Direct Chat end-to-end](#46-chat-sprint-4-direct-chat-end-to-end)
47. [Chat Polish: Unread/listas en tiempo real, errores, lifecycle, robustez](#47-chat-polish-unreadlistas-en-tiempo-real-errores-lifecycle-robustez)
48. [Chat Push Notifications Sprint 1: fanout unificado por conversación](#48-chat-push-notifications-sprint-1-fanout-unificado-por-conversación)
49. [Chat Push Notifications Sprint 2: unread tracking, push suppression, deep link robusto](#49-chat-push-notifications-sprint-2-unread-tracking-push-suppression-deep-link-robusto)
50. [Chat UX: Unread badge en Home, tab por defecto, realtime FlatList fix](#50-chat-ux-unread-badge-en-home-tab-por-defecto-realtime-flatlist-fix)
51. [Refactor: reorganización de application/ en módulos auth y chat](#51-refactor-reorganización-de-application-en-módulos-auth-y-chat)
52. [Match Reminders: T-24h y T-2h para jugadores confirmados](#52-match-reminders-t-24h-y-t-2h-para-jugadores-confirmados)
53. [Admin Panel: módulo de moderación y operación de sistema](#53-admin-panel-módulo-de-moderación-y-operación-de-sistema)
54. [Admin Panel Frontend: web app Vite + React](#54-admin-panel-frontend-web-app-vite--react)

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

---

## 28. Auth Mobile Sprint 2: SecureStore + Bootstrap + Single-flight Refresh + Email Verify UX

### Que se hizo

Auth production-grade en el cliente mobile. Integra con los endpoints del Sprint 1 backend.

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/lib/token-store.ts` | Funciones para refresh token (SecureStore) + `getOrCreateDeviceId()` |
| `src/lib/api.ts` | In-memory access token + interceptor auth + single-flight refresh + 401 retry + 204 handling |
| `src/features/auth/authClient.ts` | `postLogin(identifier)`, `postRefresh`, `postLogout`, `postLogoutAll`, `getMe()` (sin token explícito), `postEmailVerifyRequest`, `postEmailVerifyConfirm` |
| `src/contexts/AuthContext.tsx` | Bootstrap via refresh token, `configureAuthInterceptor` on mount, `doRefresh` actualiza context state (para sockets), logout llama API |
| `src/types/api.ts` | `LoginResponse` con `refreshToken + sessionId`, `RefreshResponse` nuevo tipo |
| `src/screens/LoginScreen.tsx` | Campo `identifier` (email o username), manejo `EMAIL_NOT_VERIFIED` → navega a VerifyEmail |
| `src/screens/VerifyEmailScreen.tsx` | Pantalla nueva: request email + confirm token |
| `src/navigation/AppNavigator.tsx` | `VerifyEmail` en `AuthStackParamList` + `AuthNavigator` |
| `src/screens/SettingsScreen.tsx` | Sección "Account" con botón Log Out |

### Arquitectura: Auth Interceptor

```
fetchJson()
 ├── Auto-add Bearer (from in-memory _accessToken)
 └── On 401 (non-auth URL):
      ├── ensureFreshToken()  ← single-flight (concurrent requests join same promise)
      │    ├── doRefresh()    ← reads SecureStore, calls /auth/refresh, updates token
      │    └── on fail → _onAuthFailure() → clear tokens → navigate Login
      └── retry request once (_skipAuthRetry=true)
```

### Convenciones

- Refresh token en `SecureStore` (key `auth_refresh_token`); access token solo en memoria.
- `doRefresh` en `AuthContext` también actualiza `state.token` para que `getMatchSocket` use el token fresco al reconectar.
- `configureAuthInterceptor` se llama al montar `AuthProvider`; `clearAuthInterceptor` al desmontar y en logout.
- Login acepta `identifier` (email o username) + campo `device` con `deviceId`, `platform`, `deviceName`, `appVersion`.
- `postEmailVerifyRequest` y `postEmailVerifyConfirm` son endpoints públicos (no Bearer) — el interceptor de 401 no aplica porque tienen URL `/api/v1/auth/`.

---

## 29. Auth Mobile Sprint 3: Register + Verify Email end-to-end

### Que se hizo

Flujo completo de alta de usuario en mobile: registro → verificación de email → login.

### Archivos modificados/creados

| Archivo | Cambio |
|---|---|
| `src/types/api.ts` | `RegisterResponse` nuevo tipo |
| `src/features/auth/authClient.ts` | `postRegister(email, password, username?)` |
| `src/screens/RegisterScreen.tsx` | Pantalla nueva: email, username (opcional), password, confirmPassword, validación cliente, mapeo errores 409/422 |
| `src/screens/VerifyEmailScreen.tsx` | Param renombrado `identifier`→`email`, subtítulo con email, estado `verified` con vista de éxito |
| `src/screens/LoginScreen.tsx` | Link "Create an account" → Register; soporte param `prefillEmail` |
| `src/navigation/AppNavigator.tsx` | `Register` en `AuthStackParamList`, `Login` acepta `prefillEmail?`, `VerifyEmail` acepta `email?` |

### Flujo feliz

```
Login → "Create account" → Register (email+pass+username?)
  → éxito → VerifyEmail(email)
  → "Send verification email" → resend OK
  → pegar token → Confirm OK → vista éxito
  → "Go to Login" (email prellenado) → login OK
```

### Errores mapeados (RegisterScreen)

| Scenario | HTTP | Mensaje usuario |
|---|---|---|
| Email duplicado | 409 | "That email is already registered." |
| Username duplicado/inválido | 409 | "That username is already taken." |
| Validación DTO | 422 | "Check the form — some fields are invalid." |
| Login sin verificar | 403 EMAIL_NOT_VERIFIED | Navega a VerifyEmail |

### Validaciones cliente (RegisterScreen)

- email: formato válido
- password: ≥ 8 chars
- confirmPassword: debe coincidir
- username (si se provee): `^[a-z0-9][a-z0-9_]{2,19}$` (misma regex que backend)

---

## 30. Auth Sprint 4: Password Reset + Change Password

### Que se hizo

Password reset via email (forgot password) y change password autenticado.

### Archivos modificados/creados

**Backend (apps/api)**

| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` | Nuevo modelo `PasswordResetToken` (id, userId, tokenHash, expiresAt, usedAt, requestIp, requestUserAgent) |
| `prisma/migrations/…add_password_reset_token` | Migración aplicada |
| `src/auth/infra/email.service.ts` | `sendPasswordReset(to, token)` abstracto + `DevEmailService` impl (logs consola) |
| `src/auth/api/dto/request-password-reset.dto.ts` | DTO con `@IsEmail()` |
| `src/auth/api/dto/confirm-password-reset.dto.ts` | DTO con `token`, `newPassword` |
| `src/auth/api/dto/change-password.dto.ts` | DTO con `currentPassword`, `newPassword` |
| `src/auth/application/request-password-reset.use-case.ts` | Anti-enumeration; invalida tokens anteriores; crea token + envía email |
| `src/auth/application/confirm-password-reset.use-case.ts` | Valida token+expiración; `$transaction` marca usado + cambia password + revoca todas las sesiones |
| `src/auth/application/change-password.use-case.ts` | Verifica password actual; `$transaction` cambia password + revoca otras sesiones (mantiene la actual) |
| `src/auth/application/*.use-case.spec.ts` | Tests de los 3 use-cases (7 casos) |
| `src/auth/api/password.controller.ts` | 3 endpoints: `POST auth/password/reset/request`, `POST auth/password/reset/confirm`, `POST auth/password/change` |
| `src/auth/auth.module.ts` | `PasswordController` + 3 use-cases en providers |

**Mobile (apps/mobile)**

| Archivo | Cambio |
|---|---|
| `src/features/auth/authClient.ts` | `postPasswordResetRequest`, `postPasswordResetConfirm`, `postPasswordChange` |
| `src/screens/ForgotPasswordScreen.tsx` | Ingresa email → 204 siempre (anti-enum) → link a ResetPassword |
| `src/screens/ResetPasswordScreen.tsx` | Token + nueva contraseña; éxito → login; maneja `INVALID_OR_EXPIRED_TOKEN` |
| `src/screens/ChangePasswordScreen.tsx` | Password actual + nueva (con eye toggle) + confirmar; éxito → goBack |
| `src/navigation/AppNavigator.tsx` | `ForgotPassword`, `ResetPassword` en `AuthStackParamList`; `ChangePassword` en `RootStackParamList` |
| `src/screens/LoginScreen.tsx` | Link "Forgot password?" → ForgotPassword |
| `src/screens/SettingsScreen.tsx` | Botón "Change password" → ChangePassword en sección Account |

### Endpoints

| Método | Ruta | Auth | Throttle | Respuesta |
|---|---|---|---|---|
| POST | `/api/v1/auth/password/reset/request` | — | login | 204 |
| POST | `/api/v1/auth/password/reset/confirm` | — | login | 204 |
| POST | `/api/v1/auth/password/change` | JWT | mutations | 204 |

### Decisiones clave

- Token reset: raw hex 64 chars generado por `TokenService.generateEmailToken()`; solo el SHA256 hash se persiste en DB. TTL 30 min.
- Anti-enumeration: `reset/request` siempre retorna 204 aunque el email no exista.
- Revocación de sesiones en reset/confirm: **todas** las sesiones (usuario ya no debería estar logueado).
- Revocación de sesiones en change: **todas excepto la actual** (`id: { not: sessionId }`).
- Password validation: ≥ 8 chars + 1 uppercase + 1 number (frontend) + `@MinLength(8)` (backend DTO).

---

## 31. Auth Sprint 5: Auth Audit Events + Session Management UI

### Que se hizo

Cierre del sprint de auth de producción: trail de auditoría persistente en DB + campo `isCurrent` en sesiones + pantalla `SessionsScreen` en el móvil.

### Backend

**Nuevo modelo `AuthAuditEvent`** (sin relación a User; `userId` nullable para `login_failed` con identifier desconocido):
```
id, userId?, eventType, sessionId?, ip?, userAgent?, metadata Json, createdAt
@@index([userId, createdAt(sort: Desc)])
@@index([eventType, createdAt(sort: Desc)])
```

**`AuthAuditService`** (`infra/auth-audit.service.ts`): `log(data)` best-effort — callers fire-and-forget con `.catch(warn)`.

**Eventos auditados:**

| Use-case | Evento |
|---|---|
| LoginUseCase (ok) | `login_success` (userId, sessionId, ip, userAgent) |
| LoginUseCase (fail) | `login_failed` (userId null si not_found, metadata.reason) |
| RefreshUseCase (ok) | `refresh_success` (userId, sessionId) |
| RefreshUseCase (reuse) | `refresh_reused_detected` (userId, sessionId) |
| LogoutUseCase | `logout` (userId, sessionId) |
| LogoutAllUseCase | `logout_all` (userId) |
| RegisterUseCase | `register` (userId) |
| RequestEmailVerifyUseCase | `email_verify_requested` (userId) |
| ConfirmEmailVerifyUseCase | `email_verified` (userId) |
| RequestPasswordResetUseCase | `password_reset_requested` (userId null si not found) |
| ConfirmPasswordResetUseCase | `password_reset_confirmed` (userId) |
| ChangePasswordUseCase | `password_changed` (userId, sessionId) |
| RevokeSessionCommand | `session_revoked` (userId, metadata.revokedSessionId) |

**`isCurrent` en sesiones**: `ListSessionsQuery.execute(userId, currentSessionId?)` añade `isCurrent: session.id === currentSessionId` en cada item. `SessionsController` pasa `actor.sessionId`.

### Mobile

- `SessionItem` interface en `types/api.ts`
- `getSessions()` + `deleteSession(id)` en `authClient.ts`
- `SessionsScreen`: FlatList con pull-to-refresh, badge "This device" para sesión actual, botón Log out (sesión propia) / Revoke (otras), footer "Log out all devices"
- `Sessions: undefined` añadido a `RootStackParamList`; screen registrado con `title: 'Devices'`
- Settings → "Manage devices" navega a Sessions (arriba de "Change password")

### Tests

Todos los spec files de use-cases actualizados con mock `AuthAuditService` pasado al constructor. Nuevo `revoke-session.command.spec.ts` con 4 tests: happy path + idempotencia + 404 + 403.

### Migración

`20260227064245_add_auth_audit_event` — tabla `auth_audit_event` con dos índices.

### Archivos clave

```
apps/api/prisma/schema.prisma                               (+ AuthAuditEvent model)
apps/api/prisma/migrations/20260227064245_add_auth_audit_event/
apps/api/src/auth/infra/auth-audit.service.ts               (nuevo)
apps/api/src/auth/application/{login,refresh,logout,logout-all,register,...}.use-case.ts
apps/api/src/auth/application/revoke-session.command.ts
apps/api/src/auth/application/list-sessions.query.ts        (isCurrent)
apps/api/src/auth/api/sessions.controller.ts                (pasa sessionId)
apps/api/src/auth/auth.module.ts                            (registra AuthAuditService)
apps/api/src/auth/application/revoke-session.command.spec.ts (nuevo)
apps/mobile/src/types/api.ts                                (+ SessionItem)
apps/mobile/src/features/auth/authClient.ts                 (+ getSessions, deleteSession)
apps/mobile/src/screens/SessionsScreen.tsx                  (nuevo)
apps/mobile/src/navigation/AppNavigator.tsx                 (+ Sessions route)
apps/mobile/src/screens/SettingsScreen.tsx                  (+ Manage devices btn)
```

---

## 32. Push: Backend source of truth + deviceId + group_added notification

### Que se hizo

- **Backend como fuente de verdad para push**: `GET /api/v1/push/devices` devuelve los dispositivos del usuario autenticado (sin expoPushToken). El hook `usePushNotifications` ahora consulta el backend al montar/cambiar de usuario en vez de leer SecureStore.
- **deviceId en PushDevice**: campo `deviceId` (nullable, sin unique) persistido en la tabla `PushDevice` para identificar el dispositivo actual. El cliente lo genera y lo persiste via `getOrCreateDeviceId()` (ya existente en `token-store.ts`).
- **Notificacion push `group_added`**: al agregar un miembro a un grupo se envía push al usuario agregado (fire-and-forget, 30 min cooldown via `NotificationDelivery`).
- **NotificationDelivery**: `matchId` ahora nullable; campo `groupId` (nullable UUID) e índice compuesto `(userId, groupId, type, createdAt)` para dedupe de notificaciones de grupo.

### Convencion

El hook `usePushNotifications` ya no escribe en SecureStore para el estado push; el backend es la fuente de verdad. `pushEnabledKey`/`pushTokenKey` eliminados del hook.

### Archivos clave

```
apps/api/prisma/schema.prisma                               (PushDevice.deviceId, NotificationDelivery.groupId nullable)
apps/api/prisma/migrations/20260303120000_.../migration.sql (nueva migración)
apps/api/src/push/application/get-push-devices.query.ts     (nuevo)
apps/api/src/push/api/push.controller.ts                    (+ GET devices)
apps/api/src/push/api/dto/register-device.dto.ts            (+ deviceId)
apps/api/src/push/application/register-device.use-case.ts  (+ deviceId en upsert)
apps/api/src/push/push.module.ts                            (registra GetPushDevicesQuery)
apps/api/src/groups/application/group-notification.service.ts (nuevo)
apps/api/src/groups/application/add-member.use-case.ts      (fire-and-forget push)
apps/api/src/groups/groups.module.ts                        (importa PushModule, registra GroupNotificationService)
apps/mobile/src/features/push/pushClient.ts                 (+ getPushDevices, deviceId en RegisterDevicePayload)
apps/mobile/src/features/push/usePushNotifications.ts       (backend source of truth, usa getOrCreateDeviceId)
```

---

## 33. MatchGender computed + Reject invite (reemplaza Decline)

### Que se hizo

**MatchGender computed (Opción A):**
- Campo `matchGender: 'SIN_DEFINIR' | 'MASCULINO' | 'FEMENINO' | 'MIXTO'` en `MatchSnapshot` y `MatchHomeItem`.
- Se calcula en base a los `gender` de participantes con status `CONFIRMED`. Spectators, WAITLISTED e INVITED no cuentan.
- Lógica: 0 confirmados → SIN_DEFINIR; todos MALE → MASCULINO; todos FEMALE → FEMENINO; mezcla → MIXTO.
- Implementado como función pura `computeMatchGender(confirmedGenders: string[])` en `domain/`.
- En `buildMatchSnapshot`: se añade `gender: true` al include de `user` y se llama `computeMatchGender`.
- En `listMatchesQuery`: batch extra de `matchParticipant.findMany` para genders de confirmados (query 5), sin cambiar el groupBy existente.

**Reject invite (reemplaza Decline):**
- `DeclineParticipationUseCase` eliminado. Reemplazado por `RejectInviteUseCase`.
- Reglas: solo INVITED puede rechazar; borra la fila (hard delete); incrementa revision; registra `invite.rejected` en audit log.
- Locked match NO bloquea reject.
- Sin `expectedRevision` (el usuario rechaza su propia invitación sin necesitar conocer el estado del match).
- `/decline` (deprecado) y `/reject` (nuevo) llaman al mismo use case → backward compat para mobile hasta PR 3.
- `actionsAllowed` de snapshot incluye `'reject'` cuando `myStatus === 'INVITED'`.

### Archivos clave

```
apps/api/src/matches/domain/compute-match-gender.ts          (nuevo)
apps/api/src/matches/domain/compute-match-gender.spec.ts     (nuevo, 6 tests)
apps/api/src/matches/application/reject-invite.use-case.ts   (nuevo)
apps/api/src/matches/application/reject-invite.use-case.spec.ts (nuevo, 5 tests)
apps/api/src/matches/application/build-match-snapshot.ts     (+ matchGender, + reject en actionsAllowed, + gender en user select)
apps/api/src/matches/application/list-matches.query.ts       (+ matchGender, + query 5 gender batch)
apps/api/src/matches/application/match-audit.service.ts      (+ INVITE_REJECTED)
apps/api/src/matches/api/matches.controller.ts               (swap decline→reject use case, + POST :id/reject)
apps/api/src/matches/matches.module.ts                       (swap DeclineParticipationUseCase→RejectInviteUseCase)
apps/api/src/matches/application/list-matches.query.spec.ts  (fix mock para doble findMany)
```

---

## 34. Mobile PR 3: MatchDetail redesign (countdown, matchGender, Reject, OthersSection)

### Que se hizo

**Tipos:**
- `MatchHomeItem` y `MatchSnapshot` en `apps/mobile/src/types/api.ts` reciben campo `matchGender`.

**CreateMatchScreen:**
- `formatDate` cambiado de `yyyy-mm-dd` a `dd-mm-yyyy` (solo display; ISO sigue enviándose al backend).

**MatchDetailScreen (rediseño):**
- **Countdown a `startsAt`**: `computeCountdown()` calcula tiempo restante. ≥1 día → `Xd Hh Mm`; <1 día → `Hh Mm Ss`. Tick cada 1s via `setInterval`. Desaparece cuando el partido ya arrancó. Aparece como InfoRow "Starts in".
- **matchGender display**: InfoRow "Género" con valores Masculino/Femenino/Mixto/— (SIN_DEFINIR).
- **Reject invite**: `PLAYER_ACTIONS` cambia de `["confirm", "decline"]` a `["confirm", "reject"]`. `handleAction("reject")` llama `doReject()` que hace `POST /matches/:id/reject`, invalida cache de matches y navega `goBack()` (el partido desaparece de la lista del usuario). Loading state independiente (`rejectLoading`) para el botón Rechazar.
- **OthersSection**: Reemplaza las secciones separadas Invited/Waitlist/Declined/Spectator por una sola sección "Others" (sin sub-headers entre grupos). Orden: WAITLISTED → INVITED → SPECTATOR. Cada item tiene un `statusChip` de color indicando su estado. `OthersParticipantRow` mantiene promote/demote buttons para admins. DECLINED eliminado del UI.
- **formatAuditLog**: agrega case `invite.rejected`.

### Archivos clave

```
apps/mobile/src/types/api.ts                     (+ matchGender en MatchHomeItem + MatchSnapshot)
apps/mobile/src/screens/CreateMatchScreen.tsx     (formatDate → dd-mm-yyyy)
apps/mobile/src/screens/MatchDetailScreen.tsx     (countdown, matchGender, reject, OthersSection)
```

---

## 35. Match Lifecycle: Scheduler + Freeze Edit + Missing-Players Alerts + Notification Bucket Dedup

### Que se hizo

**MatchLifecycleJob (scheduler):**
- `@nestjs/schedule` activado: `ScheduleModule.forRoot()` en `app.module.ts`.
- `MatchLifecycleJob` con `@Cron(EVERY_MINUTE)` procesa partidos en la ventana `[now-5min, now+60min]` que no sean `canceled`/`played`.
- **Regla 1 — Auto-lock**: si `minutesToStart <= 60 && confirmedCount >= capacity && !isLocked` → actualiza `isLocked=true`, `lockedAt`, `lockedBy=null`, incrementa `revision`, registra audit `match.auto_locked`, notifica WS.
- **Regla 2 — Reminder**: si `minutesToStart <= 60 && confirmedCount < capacity` → envía push `reminder_missing_players` a creator + admins con dedup por bucket (`b0`..`b3`, ventana de 15 min).
- **Regla 3 — Auto-cancel**: si `minutesToStart <= 0 && confirmedCount < capacity` → cancela el match, registra audit `match.auto_canceled`, notifica WS, dispara push `onCanceled` a todos los participantes (actorId=null).
- Reglas 1 y 3 son idempotentes por diseño (re-chequeo dentro de la transacción con `lockMatchRow`).

**Freeze edit (T-60):**
- `UpdateMatchUseCase`: nuevo check antes del check de lock — si `minutesToStart <= 60` → lanza `UnprocessableEntityException('MATCH_EDIT_FROZEN')`.

**Missing-players alert en leave y kick:**
- `LeaveMatchUseCase`: si el participante que se va era CONFIRMED + match isLocked + T-60 → `onMissingPlayersAlert` fire-and-forget a creator + admins (5-min cooldown).
- `KickParticipantUseCase`: misma lógica post-kick para confirmed + locked + T-60.

**Notification Bucket Dedup:**
- `NotificationDelivery` gana columna `bucket TEXT` nullable con índice compuesto `(userId, matchId, type, bucket)`.
- `MatchNotificationService`: nuevos tipos `reminder_missing_players` (dedup por bucket) y `missing_players_alert` (cooldown 5-min).
- `shouldSend` y `recordDelivery` aceptan `bucket?` opcional. Si se pasa bucket, usa query por bucket exacto (no ventana de tiempo).
- `onCanceled`: `actorId: string | null` — si null (system cancel), notifica a todos; si no, excluye al actor. Cuerpo del mensaje diferente para cada caso.

**Nuevos audit types:**
- `match.auto_locked`, `match.auto_canceled` en `AuditLogType`.

### Archivos clave

```
apps/api/src/matches/application/match-lifecycle.job.ts          (nuevo)
apps/api/src/matches/application/match-lifecycle.job.spec.ts     (nuevo, 5 tests)
apps/api/prisma/migrations/20260304120000_notification_delivery_bucket/migration.sql (nuevo)
apps/api/prisma/schema.prisma                                    (+ bucket en NotificationDelivery)
apps/api/src/app.module.ts                                       (+ ScheduleModule.forRoot())
apps/api/src/matches/matches.module.ts                           (+ MatchLifecycleJob)
apps/api/src/matches/application/match-audit.service.ts          (+ MATCH_AUTO_LOCKED, MATCH_AUTO_CANCELED)
apps/api/src/matches/application/match-notification.service.ts   (+ 2 types, bucket dedup, nullable actorId)
apps/api/src/matches/application/match-notification.service.spec.ts (+ 4 nuevos describe blocks)
apps/api/src/matches/application/update-match.use-case.ts        (+ MATCH_EDIT_FROZEN check)
apps/api/src/matches/application/leave-match.use-case.ts         (+ missing-players alert)
apps/api/src/matches/application/kick-participant.use-case.ts    (+ MatchNotificationService, alert)
apps/api/src/matches/application/kick-participant.use-case.spec.ts (actualizado: + mockNotification)
apps/api/src/matches/application/update-lock.use-case.spec.ts    (fix: futureStartsAt > 60min)
```

---

## 36. User Profile Fields + termsAcceptedAt

### Que se hizo

- Extendidos enums de Prisma: `UserGender` +`OTHER`; nuevos `PreferredPosition` (GOALKEEPER/DEFENDER/MIDFIELDER/FORWARD) y `SkillLevel` (BEGINNER/AMATEUR/REGULAR/SEMIPRO/PRO).
- Agregados campos opcionales a `User`: `firstName`, `lastName`, `birthDate` (`@db.Date`), `preferredPosition`, `skillLevel`; `gender` ahora nullable (sin default).
- Agregado `termsAcceptedAt DateTime @default(now())` — obligatorio en register (aceptación de T&C), con default DB para usuarios existentes.
- `POST /api/v1/auth/register` acepta `acceptTerms: boolean` (requerido); si `false` → 422 `TERMS_NOT_ACCEPTED`. Acepta campos de perfil opcionales.
- `GET /api/v1/me` devuelve los nuevos campos.
- `TERMS_NOT_ACCEPTED` agregado a `DOMAIN_UNPROCESSABLE_CODES` en el exception filter.

### Archivos clave

```
apps/api/prisma/schema.prisma
apps/api/prisma/migrations/20260305000000_user_profile_fields/migration.sql
apps/api/src/auth/api/dto/register.dto.ts
apps/api/src/auth/application/register.use-case.ts
apps/api/src/auth/application/get-me.use-case.ts
apps/api/src/common/filters/api-exception.filter.ts
apps/api/src/auth/application/register.use-case.spec.ts
```

---

## 37. Reliability Score + Suspension (Sprint 1)

### Que se hizo

Implementacion del score de confiabilidad (0-100) basado en late-leaves, con suspension de 2 semanas si llega a 0 dentro de una ventana de 30 dias.

**Reglas:**
- Penalizacion por late-leave: -10 (minimo 0)
- `reliabilityWindowStartedAt`: se setea en la primera penalizacion; se resetea si pasan > 30 dias
- Si el score llega a 0 dentro de la ventana de 30 dias → `suspendedUntil = now + 14 dias`
- Si el usuario ya esta suspendido, la penalizacion es no-op
- Label derivado al vuelo: 85-100 Cumplidor, 70-84 Confiable, 50-69 Medio loro, 0-49 Poco confiable

**Bloqueo de sesion:**
- Login y refresh verifican `suspendedUntil > now` → 403 `account_suspended` con `suspendedUntil` en la respuesta

### Migracion

`20260306120000_reliability_score`: agrega `reliabilityScore SMALLINT DEFAULT 100`, `reliabilityWindowStartedAt TIMESTAMP?`, `suspendedUntil TIMESTAMP?` al modelo `User`.

### Archivos clave

```
apps/api/prisma/schema.prisma (User: 3 campos nuevos)
apps/api/prisma/migrations/20260306120000_reliability_score/migration.sql
apps/api/src/matches/application/user-reliability.service.ts (nuevo)
apps/api/src/matches/application/user-reliability.service.spec.ts (nuevo)
apps/api/src/matches/application/leave-match.use-case.ts (llama UserReliabilityService en late-leave)
apps/api/src/matches/matches.module.ts (registra UserReliabilityService)
apps/api/src/auth/application/login.use-case.ts (bloqueo por suspension)
apps/api/src/auth/application/refresh.use-case.ts (bloqueo por suspension)
apps/api/src/auth/application/get-me.use-case.ts (expone reliabilityScore, reliabilityLabel, suspendedUntil)
apps/api/src/common/filters/api-exception.filter.ts (account_suspended code + suspendedUntil en body)
apps/mobile/src/types/api.ts (MeResponse + ApiErrorBody actualizados)
apps/mobile/src/screens/ProfileScreen.tsx (card de confiabilidad + banner de suspension)
apps/mobile/src/screens/LoginScreen.tsx (manejo de account_suspended)
```

---

## 38. Avatar Upload (Sprint 2) — Presigned URLs + MinIO/S3 + UI mobile

### Que se hizo

Subida de avatar via presigned PUT URL (S3-compatible). Storage en MinIO (dev) / S3 (prod). Sin guardar binario en DB.

**Flujo:**
1. Mobile llama `POST /api/v1/me/avatar/prepare` → recibe `uploadUrl` + `key`
2. Mobile hace PUT directo al storage con el binario del archivo
3. Mobile llama `POST /api/v1/me/avatar/confirm` → upsert en `UserAvatar`
4. Mobile llama `refreshUser()` → `/me` devuelve `avatarUrl`

**Validaciones:**
- contentType: image/jpeg o image/png
- size: > 0 y <= AVATAR_MAX_BYTES (3MB default)
- key en confirm debe empezar con `avatars/{userId}/` (ownership check)

**Env vars nuevas (apps/api):**
```
STORAGE_BUCKET=fuchibol-avatars
STORAGE_REGION=us-east-1
STORAGE_ACCESS_KEY_ID=minioadmin
STORAGE_SECRET_ACCESS_KEY=minioadmin
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_FORCE_PATH_STYLE=true
STORAGE_PUBLIC_BASE_URL=http://localhost:9000/fuchibol-avatars
AVATAR_MAX_BYTES=3145728
```

**MinIO (dev):** `docker compose -f infra/docker-compose.yml up minio -d`
Consola web en http://localhost:9001. Crear bucket `fuchibol-avatars` manualmente o via mc.

### Migracion

`20260306130000_user_avatar`: tabla `UserAvatar` (userId PK, key, contentType, size).

### Archivos clave

```
apps/api/prisma/schema.prisma (UserAvatar model + User.avatar relation)
apps/api/prisma/migrations/20260306130000_user_avatar/migration.sql
apps/api/src/infra/storage/storage.service.ts (nuevo — S3Client + presigned PUT)
apps/api/src/infra/storage/storage.module.ts (nuevo)
apps/api/src/auth/application/prepare-avatar.use-case.ts (nuevo)
apps/api/src/auth/application/confirm-avatar.use-case.ts (nuevo)
apps/api/src/auth/application/prepare-avatar.use-case.spec.ts (nuevo)
apps/api/src/auth/application/confirm-avatar.use-case.spec.ts (nuevo)
apps/api/src/auth/api/me.controller.ts (endpoints prepare + confirm)
apps/api/src/auth/api/dto/prepare-avatar.dto.ts (nuevo)
apps/api/src/auth/api/dto/confirm-avatar.dto.ts (nuevo)
apps/api/src/auth/application/get-me.use-case.ts (avatarUrl derivado)
apps/api/src/auth/auth.module.ts (StorageModule + nuevos use cases)
apps/api/src/common/filters/api-exception.filter.ts (3 nuevos error codes)
infra/docker-compose.yml (servicio minio)
apps/mobile/src/types/api.ts (avatarUrl en MeResponse + nuevos tipos)
apps/mobile/src/features/auth/authClient.ts (postAvatarPrepare, postAvatarConfirm)
apps/mobile/src/screens/ProfileScreen.tsx (avatar UI + flujo de upload)
```

---

## 39. Venues + CreateMatch en 2 pasos

### Que se hizo

Modelo `Venue`/`VenuePitch` + endpoint de búsqueda + flujo CreateMatch refactorizado en 2 pasos (fecha/hora/tipo → selección de cancha).

**Flujo CreateMatch nuevo:**
1. Step 1: usuario elige fecha, hora y tipo de cancha (F5/F7/F9/F11) → "Siguiente" busca canchas activas de ese tipo
2. Step 2: lista de canchas, selección → "Crear partido" crea el match con venueId + venuePitchId

**Reglas:**
- El endpoint `GET /api/v1/venue-pitches/search?pitchType=` devuelve solo canchas activas (isActive=true) cuyo predio también esté activo
- No hay booking real ni disponibilidad horaria: la selección es representativa/informativa
- Title se auto-genera: `${pitchType} en ${venueName}`
- Capacity se deriva del pitchType: F5→10, F7→14, F9→18, F11→22

### Migracion

`20260306150000_add_venue_venuepitch`: enum `PitchType`, tablas `Venue` y `VenuePitch`, columnas opcionales `venueId` y `venuePitchId` en `Match`.

### Archivos clave

```
apps/api/prisma/schema.prisma (PitchType enum, Venue, VenuePitch, Match.venueId/venuePitchId)
apps/api/prisma/migrations/20260306150000_add_venue_venuepitch/migration.sql
apps/api/src/venues/venues.module.ts (nuevo)
apps/api/src/venues/api/venue-pitches.controller.ts (nuevo)
apps/api/src/venues/api/dto/search-venue-pitches-query.dto.ts (nuevo)
apps/api/src/venues/application/search-venue-pitches.query.ts (nuevo)
apps/api/src/venues/application/search-venue-pitches.query.spec.ts (nuevo)
apps/api/src/app.module.ts (VenuesModule registrado)
apps/api/src/matches/api/dto/create-match.dto.ts (venueId?, venuePitchId?)
apps/api/src/matches/application/create-match.use-case.ts (venueId?, venuePitchId? en input + create)
apps/mobile/src/types/api.ts (PitchType, VenuePitchItem, SearchVenuePitchesResponse)
apps/mobile/src/features/matches/matchesClient.ts (searchVenuePitches, createMatch actualizado)
apps/mobile/src/screens/CreateMatchScreen.tsx (flujo 2 pasos completo)
```

---

## 40. Venue/Pitch Snapshot en Match — Estabilidad histórica (Sprint 2)

### Objetivo

Garantizar que `MatchDetails` muestre predio, cancha, tipo, precio y mapa de forma históricamente estable, incluso si el catálogo de Venue/VenuePitch cambia o se desactiva.

### Qué se implementó

- **Snapshots en Match**: dos columnas JSONB (`venueSnapshot`, `pitchSnapshot`) persisten los datos del predio y cancha al momento de creación.
- **Validación en create-match**: si se provee uno de `venueId`/`venuePitchId` sin el otro → 422. Si ambos presentes: verifica que sean activos y que el pitch pertenezca al venue. `pitchType` se deriva del `VenuePitch`, no de input del cliente.
- **Snapshot expuesto en `buildMatchSnapshot`**: los campos son parte del `MatchSnapshot` estándar.
- **MatchDetails mobile**: `MatchInfoCard` renderiza PREDIO, DIRECCIÓN, CANCHA (nombre · tipo), PRECIO y botón "Abrir en mapa" solo si los snapshots existen. No muestra bloques vacíos para matches sin cancha asignada.

### Migración

`20260307120000_match_venue_pitch_snapshot`: agrega columnas `venueSnapshot JSONB` y `pitchSnapshot JSONB` a la tabla `Match`.

### Archivos clave

```
apps/api/prisma/schema.prisma (Match.venueSnapshot Json?, Match.pitchSnapshot Json?)
apps/api/prisma/migrations/20260307120000_match_venue_pitch_snapshot/migration.sql
apps/api/src/matches/application/create-match.use-case.ts (validación + snapshots)
apps/api/src/matches/application/create-match.use-case.spec.ts (10 tests)
apps/api/src/matches/application/build-match-snapshot.ts (venueSnapshot, pitchSnapshot en output)
apps/mobile/src/types/api.ts (VenueSnapshot, PitchSnapshot, MatchSnapshot actualizado)
apps/mobile/src/screens/MatchDetailScreen.tsx (MatchInfoCard con venue/pitch/mapa)
```

---

## 41. Admin Base + Gestión de Predios y Canchas (Sprint admin/venues)

### Objetivo

Crear el área de administración en mobile y conectar ahí la gestión completa de predios y canchas (CRUD + activación/desactivación).

### Qué se implementó

**Backend:**
- 6 endpoints `admin/venues` protegidos por `@Roles('ADMIN')` + `JwtAuthGuard` + `RolesGuard`.
- `AdminVenueService` y `AdminPitchService`: listar todos (incluido inactivos), crear, actualizar y activar/desactivar via PATCH `{ isActive }`.
- Validación de pertenencia pitch↔venue en update: 404 si el pitch no pertenece al venue indicado.

**Mobile:**
- `AdminTab` en `MainTabs` visible solo para `user.role === 'ADMIN'`.
- `AdminNavigator` (NativeStackNavigator anidado dentro del tab) con 5 screens: AdminHome → AdminVenues → (AdminVenueForm | AdminVenuePitches → AdminPitchForm).
- `AdminHomeScreen`: hub con card "Predios & Canchas" operativa y placeholders para Usuarios y Métricas (futuro).
- `AdminVenuesScreen`: lista todos los predios con conteo de canchas y botones Editar / Canchas / Activar/Desactivar. Reload automático al volver de formularios (`useFocusEffect`).
- `AdminVenueFormScreen`: crear y editar predio (nombre, dirección, mapsUrl, lat/lng, isActive solo en edición).
- `AdminVenuePitchesScreen`: canchas de un predio con estado y botones Editar / Activar/Desactivar.
- `AdminPitchFormScreen`: crear y editar cancha (nombre, pitchType pills, precio, isActive solo en edición).

### Archivos clave

```
apps/api/src/venues/api/admin-venues.controller.ts (nuevo)
apps/api/src/venues/api/dto/admin-venue.dto.ts (nuevo)
apps/api/src/venues/api/dto/admin-pitch.dto.ts (nuevo)
apps/api/src/venues/application/admin-venue.service.ts (nuevo)
apps/api/src/venues/application/admin-pitch.service.ts (nuevo)
apps/api/src/venues/application/admin-venue.service.spec.ts (nuevo, 13 tests)
apps/api/src/venues/venues.module.ts (actualizado)
apps/mobile/src/navigation/AppNavigator.tsx (AdminStackParamList, AdminNavigator, AdminTab condicional)
apps/mobile/src/types/api.ts (VenueAdmin, PitchAdmin, response types)
apps/mobile/src/features/admin/adminClient.ts (nuevo)
apps/mobile/src/screens/AdminHomeScreen.tsx (nuevo)
apps/mobile/src/screens/AdminVenuesScreen.tsx (nuevo)
apps/mobile/src/screens/AdminVenueFormScreen.tsx (nuevo)
apps/mobile/src/screens/AdminVenuePitchesScreen.tsx (nuevo)
apps/mobile/src/screens/AdminPitchFormScreen.tsx (nuevo)
```

---

## 40. Match Lifecycle: IN_PROGRESS + PLAYED DB-driven

### Que se hizo

Implementado el ciclo de vida completo del partido con estados `IN_PROGRESS` y `PLAYED` persistidos en DB (reemplaza el PLAYED derivado por tiempo).

**Nuevo flujo de estados:**
- `SCHEDULED` → `LOCKED` (scheduler: auto-lock si está completo 60min antes)
- `SCHEDULED/LOCKED` → `IN_PROGRESS` (scheduler: al llegar `startsAt` y `confirmedCount >= capacity`)
- `SCHEDULED/LOCKED` → `CANCELED` (scheduler: al llegar `startsAt` y `confirmedCount < capacity`)
- `IN_PROGRESS` → `PLAYED` (scheduler: 60min después de `startsAt`)
- Reconciliación tardía: si el job corrió tarde y `startsAt + 60min` ya pasó, salta directamente a `PLAYED`.

**Al iniciar (`in_progress`):**
- Se eliminan los rows de `WAITLISTED` (ya no relevantes).
- Push fire-and-forget a todos los `CONFIRMED`.
- Audit log `match.started`.

**Al finalizar (`played`):**
- Audit log `match.played`.
- WS emite `{ matchId, revision }` → cliente refetchea.

**Reglas de inmutabilidad:**
- `in_progress`, `played`, `canceled` → todas las mutaciones retornan 409 `MATCH_CANCELLED`.
- `actionsAllowed` vacío en el snapshot para esos estados.

**list-matches view filter:** ahora basado en status DB (no en tiempo).
- `upcoming`: `status IN (scheduled, locked, in_progress)`
- `history`: `status IN (canceled, played)`

### Archivos modificados

```
apps/api/prisma/schema.prisma (enum MatchStatus: +in_progress)
apps/api/prisma/migrations/20260308120000_add_in_progress_status/ (nueva)
packages/shared/src/index.ts (IN_PROGRESS: "in_progress")
apps/api/src/matches/domain/compute-match-status-view.ts (DB-driven, sin cálculo por tiempo)
apps/api/src/matches/domain/compute-match-status-view.spec.ts (tests actualizados)
apps/api/src/matches/application/build-match-snapshot.ts (isImmutable basado en status DB)
apps/api/src/matches/application/match-audit.service.ts (+MATCH_STARTED, +MATCH_PLAYED)
apps/api/src/matches/application/match-notification.service.ts (+onMatchStarted, +match_started type)
apps/api/src/matches/application/match-lifecycle.job.ts (reescrito: autoStart, tryFinalizeMatch)
apps/api/src/matches/application/match-lifecycle.job.spec.ts (18 tests: +auto-start, +finalize, +idempotencia, +late reconciliation)
apps/api/src/matches/application/list-matches.query.ts (view filter DB-driven)
apps/api/src/matches/application/list-matches.query.spec.ts (tests actualizados)
apps/api/src/matches/application/*.use-case.ts (todos: bloquean in_progress y played)
apps/mobile/src/types/api.ts (matchStatus: +IN_PROGRESS)
apps/mobile/src/screens/MatchDetailScreen.tsx (MatchInProgressPanel, MatchPlayedPanel, isReadOnly actualizado)
```


---

## Sprint: Armado de equipos — Step 1 (Backend)

**Objetivo:** modelo persistente de slots por equipo, generación automática (random y equilibrada por skill), movimiento de jugadores entre slots, expuesto en snapshot del match.

### Modelo de datos

`MatchTeamSlot`: slot-based, `team` (A/B), `slotIndex`, `userId?` (nullable FK a User con ON DELETE SET NULL).

`Match.teamsConfigured Boolean @default(false)`: flag que indica que el match tiene equipos configurados.

Reglas:
- `capacity/2` slots por equipo (floor para capacidades impares).
- Solo jugadores CONFIRMED pueden ocupar slots.
- No se permiten duplicados entre ambos equipos.
- Solo el creator puede modificar equipos.
- El match no puede estar en estado inmutable (canceled/played/in_progress).

### Use Cases

| Use Case | Endpoint | Descripción |
|---|---|---|
| `SaveTeamsUseCase` | `POST /matches/:id/teams` | Reemplaza todos los slots con configuración manual |
| `GenerateRandomTeamsUseCase` | `POST /matches/:id/teams/generate-random` | Fisher-Yates shuffle, split mitad/mitad |
| `GenerateBalancedTeamsUseCase` | `POST /matches/:id/teams/generate-balanced` | Snake draft por skillLevel (PRO→A, SEMIPRO→B, REGULAR→B, AMATEUR→A...) |
| `MoveTeamPlayerUseCase` | `POST /matches/:id/teams/move-player` | Swap de userId entre dos slots |

### Snapshot del match

`MatchSnapshot` ahora incluye:
- `teamsConfigured: boolean`
- `teams: { teamA: TeamSlotView[], teamB: TeamSlotView[] } | null` (solo si `teamsConfigured=true`)
- `actionsAllowed` incluye `'manage_teams'` para el creator (en estados no inmutables)

### Archivos modificados

```
apps/api/prisma/schema.prisma (+MatchTeamSlot, +Match.teamsConfigured, +User.teamSlots)
apps/api/prisma/migrations/20260309120000_add_team_slots/ (nueva)
apps/api/src/matches/application/build-match-snapshot.ts (+TeamSlotView, +TeamsSnapshot, +teams, +teamsConfigured, +manage_teams)
apps/api/src/matches/application/match-audit.service.ts (+TEAMS_CONFIGURED, +TEAMS_GENERATED_RANDOM, +TEAMS_GENERATED_BALANCED, +TEAM_PLAYER_MOVED)
apps/api/src/matches/application/save-teams.use-case.ts (nuevo)
apps/api/src/matches/application/generate-random-teams.use-case.ts (nuevo)
apps/api/src/matches/application/generate-balanced-teams.use-case.ts (nuevo)
apps/api/src/matches/application/move-team-player.use-case.ts (nuevo)
apps/api/src/matches/application/teams.use-case.spec.ts (nuevo, 22 tests)
apps/api/src/matches/api/dto/team-command.dto.ts (nuevo)
apps/api/src/matches/api/matches.controller.ts (+4 endpoints de teams)
apps/api/src/matches/matches.module.ts (+4 providers)
apps/mobile/src/types/api.ts (+TeamSlotView, +TeamsSnapshot, +teams, +teamsConfigured en MatchSnapshot)
```

---

## Sprint: Armado de equipos — Step 2 (Mobile UI)

**Objetivo:** pantalla de armado de equipos para el creator, con visualización de equipos en MatchDetails.

### Decisiones de implementación

- **Aleatorio**: Fisher-Yates shuffle local → snake draft → actualiza estado local (no API, sin persistir)
- **Equilibrado**: sort alfabético por username + snake draft local (proxy sin datos de skill) → actualiza estado local
- **Guardar**: única acción que llama al backend (`POST /matches/:id/teams`) → persiste + incrementa revision + back
- **Visualización**: si `teamsConfigured === true`, MatchDetails muestra `TeamsDisplayCard` (dos columnas) en lugar de la lista plana de confirmados

### UX de edición de slots

- Tap en un slot → lo selecciona (highlight azul)
- Tap en otro slot → intercambia los jugadores entre los dos slots
- Tap en el mismo slot → lo deselecciona
- Tap en jugador "Sin asignar" con slot seleccionado → coloca al jugador en ese slot
- Tap en jugador "Sin asignar" sin selección → lo ubica en el primer slot vacío (A primero, luego B)

### Archivos modificados

```
apps/mobile/src/features/matches/matchesClient.ts (+saveTeams, +generateBalancedTeams)
apps/mobile/src/navigation/AppNavigator.tsx (+TeamAssembly en RootStackParamList + Screen)
apps/mobile/src/screens/TeamAssemblyScreen.tsx (nuevo — screen de armado)
apps/mobile/src/screens/MatchDetailScreen.tsx (+canManageTeams, +TeamsDisplayCard, +botón Armar/Editar equipos)
```

---

## 41. Team Assembly Sprint 3: Roster integration (slot sync automático)

**Objetivo:** mantener los slots de equipo sincronizados con los cambios del roster: liberar slot cuando un CONFIRMED deja de jugar, asignar slot cuando un jugador entra a CONFIRMED.

### Reglas implementadas

- **Liberar slot** (releaseTeamSlot): cuando un CONFIRMED hace leave, es kickeado, o pasa a SPECTATOR → su slot queda vacío (userId = null)
- **Liberar batch** (releaseTeamSlotsBatch): en cambio mayor (update-match) que reinicia CONFIRMED → INVITED, se liberan todos sus slots
- **Auto-asignar** (autoAssignTeamSlot): cuando un jugador entra a CONFIRMED (confirm-participation o promoción desde waitlist tras leave/kick/spectator) → ocupa el primer slot vacío en orden determinístico (team A first, por slotIndex)
- Todo ocurre solo si `match.teamsConfigured === true`; si no hay equipos configurados, no hay efecto

### Archivos creados / modificados

```
apps/api/src/matches/application/team-slot-sync.ts (nuevo — 3 helpers: releaseTeamSlot, releaseTeamSlotsBatch, autoAssignTeamSlot)
apps/api/src/matches/application/team-slot-sync.spec.ts (nuevo — 7 tests)
apps/api/src/matches/application/confirm-participation.use-case.ts (+autoAssignTeamSlot si teamsConfigured)
apps/api/src/matches/application/leave-match.use-case.ts (+releaseTeamSlot al salir + autoAssignTeamSlot al promovido)
apps/api/src/matches/application/kick-participant.use-case.ts (+releaseTeamSlot al kickeado + autoAssignTeamSlot al promovido)
apps/api/src/matches/application/toggle-spectator.use-case.ts (+releaseTeamSlot CONFIRMED→SPECTATOR + autoAssignTeamSlot al promovido)
apps/api/src/matches/application/update-match.use-case.ts (+releaseTeamSlotsBatch en cambio mayor)
apps/api/src/matches/application/match-audit.service.ts (+TEAM_SLOT_RELEASED, +TEAM_SLOT_AUTO_ASSIGNED)
```

---

## 42. Team Assembly Sprint 4: Auto-generación de equipos a T-30

**Objetivo:** generar equipos aleatorios automáticamente 30 minutos antes del inicio si el creator no intervino, con notificación push y bloqueo permanente de esa autogeneración cuando el creator abre la pantalla de armado.

### Decisiones de implementación

- **`teamsAutoGenBlocked`**: nuevo campo booleano en `Match` que el creator activa al entrar a `TeamAssemblyScreen`. Una vez activado, el scheduler no genera equipos aunque el partido todavía no los tenga configurados.
- **Ventana T-30**: el job evalúa `minutesToStart <= 30` para todos los partidos del bucket upcoming (0–60min). Las guards internas (lock de fila + re-fetch dentro del tx) garantizan idempotencia.
- **Sin segunda autogeneración**: una vez que `teamsConfigured=true` (ya sea por auto-gen o por save manual), el job no vuelve a intentarlo.
- **Fire-and-forget notification**: push solo al creator, con cooldown de 60min.

### Archivos modificados

```
apps/api/prisma/schema.prisma (+teamsAutoGenBlocked al modelo Match)
apps/api/prisma/migrations/20260309140000_add_teams_autogen_blocked/migration.sql (nuevo)
apps/api/src/matches/application/match-audit.service.ts (+MATCH_AUTO_TEAMS_GENERATED)
apps/api/src/matches/application/match-notification.service.ts (+teams_auto_generated type, cooldown y onTeamsAutoGenerated)
apps/api/src/matches/application/match-lifecycle.job.ts (+teamsConfigured/teamsAutoGenBlocked en tipo, +autoGenerateTeams, hook en processUpcoming)
apps/api/src/matches/application/block-team-autogen.use-case.ts (nuevo)
apps/api/src/matches/api/matches.controller.ts (POST :id/teams/block-autogen)
apps/api/src/matches/matches.module.ts (+BlockTeamAutoGenUseCase)
apps/api/src/matches/application/match-lifecycle.job.spec.ts (+5 tests auto-gen, +matchTeamSlot en mock tx, +teamsConfigured/teamsAutoGenBlocked en makeMatch)
apps/mobile/src/features/matches/matchesClient.ts (+blockTeamAutoGen)
apps/mobile/src/screens/TeamAssemblyScreen.tsx (useEffect on mount → blockTeamAutoGen)
```

## 43. Chat Sprint 1: Infraestructura de chat + Match chat end-to-end

### Decisiones de diseño

- **Sistema unificado**: un solo módulo `chat` para todos los tipos (MATCH, GROUP, DIRECT futuros). Scope MATCH primero.
- **WS full payload**: el namespace `/chat` emite `message.new { conversationId, message }` con el mensaje completo (no signal-only). Justificado porque los mensajes son append-only — no hay revision conflicts.
- **Chat WS separado del match WS**: `/matches` sigue emitiendo solo `{ matchId, revision }`. El chat tiene su propio namespace `/chat` con sus propios rooms `conv:{conversationId}`.
- **`isReadOnly` derivado**: no se persiste en `Conversation`. Se calcula en cada request desde `match.status`. Si el match está `played` o `canceled`, el chat es read-only.
- **Dedup via `clientMsgId`**: constraint UNIQUE `(conversationId, senderId, clientMsgId)` en DB. No se usa `Idempotency-Key` header para chat (patrón propio del dominio).
- **Acceso**: creator OR MatchParticipant con status CONFIRMED/WAITLISTED/SPECTATOR. INVITED no puede chatear.
- **Conversation creada junto con el Match**: en transacción dentro de `CreateMatchUseCase`.

### Modelo de datos (migración 20260310032432_add_conversation_messages)

```
Conversation: id, type (MATCH|GROUP|DIRECT), matchId?, createdAt, updatedAt
  - matchId UNIQUE → una conversation por match
  - onDelete: Cascade desde Match

Message: id, conversationId, senderId, body, clientMsgId, createdAt
  - UNIQUE(conversationId, senderId, clientMsgId) → dedup
  - INDEX(conversationId, createdAt DESC) → paginación eficiente
```

Data migration: crea Conversation para todos los Match existentes.

### API

- `GET /api/v1/matches/:matchId/conversation` → `{ id, type, isReadOnly }`
- `GET /api/v1/conversations/:id/messages?limit=30&before=<cursor>` → `{ items[], hasMore, nextCursor }`
- `POST /api/v1/conversations/:id/messages` → `{ body, clientMsgId }` → `MessageView`

### Realtime

- WS namespace `/chat`, JWT en `handshake.auth.token`
- `chat.subscribe { conversationId }` → verifica membresía antes de `join(conv:{id})`
- `chat.unsubscribe { conversationId }` → leave
- `message.new { conversationId, message }` → emitido por `ChatRealtimePublisher` después de cada POST

### Mobile

- `useChatRealtime(conversationId)` prepend mensajes al cache con dedup por id
- `useMessages` usa `useInfiniteQuery` con cursor para paginación hacia atrás
- `useSendMessage` actualiza cache optimista en `onSuccess` (antes de que llegue el WS)
- `MatchChatScreen` con FlatList invertida, input en footer, soporte read-only
- Botón "Chat del partido" en `MatchDetailScreen` visible para creator + CONFIRMED/WAITLISTED/SPECTATOR

### Archivos creados / modificados

```
apps/api/prisma/schema.prisma (+Conversation, +Message, +sentMessages en User, +conversation en Match)
apps/api/prisma/migrations/20260310032432_add_conversation_messages/ (nuevo + data migration)
apps/api/src/matches/application/create-match.use-case.ts ($transaction + tx.conversation.create)
apps/api/src/chat/application/match-chat-access.service.ts (nuevo)
apps/api/src/chat/application/get-match-conversation.use-case.ts (nuevo)
apps/api/src/chat/application/list-messages.use-case.ts (nuevo)
apps/api/src/chat/application/send-message.use-case.ts (nuevo)
apps/api/src/chat/application/match-chat.use-case.spec.ts (nuevo — 17 tests)
apps/api/src/chat/api/dto/send-message.dto.ts (nuevo)
apps/api/src/chat/api/chat.controller.ts (nuevo)
apps/api/src/chat/realtime/chat-realtime.publisher.ts (nuevo)
apps/api/src/chat/realtime/chat.gateway.ts (nuevo)
apps/api/src/chat/realtime/chat-realtime.module.ts (nuevo)
apps/api/src/chat/chat.module.ts (nuevo)
apps/api/src/app.module.ts (+ChatModule)
apps/mobile/src/types/api.ts (+ConversationInfo, +MessageView, +ListMessagesResponse)
apps/mobile/src/lib/socket.ts (+getChatSocket, +disconnectChatSocket)
apps/mobile/src/features/chat/chatClient.ts (nuevo)
apps/mobile/src/features/chat/useMatchConversation.ts (nuevo)
apps/mobile/src/features/chat/useMessages.ts (nuevo)
apps/mobile/src/features/chat/useSendMessage.ts (nuevo)
apps/mobile/src/features/chat/useChatRealtime.ts (nuevo)
apps/mobile/src/screens/MatchChatScreen.tsx (nuevo)
apps/mobile/src/navigation/AppNavigator.tsx (+MatchChat route)
apps/mobile/src/screens/MatchDetailScreen.tsx (+canChat, +Chat button)
```

---

## 44. Chat Sprint 2: Home > Chats > Matches (lista de conversaciones)

### Decisiones de diseño

- **ChatsTab en bottom navigator**: se agrega como 6ta pestaña (`ChatsTab`) entre HomeTab y GroupsTab. React Navigation soporta >5 tabs sin "More" automático.
- **Pestañas internas como pills**: Privados | Matches | Grupos implementadas como pills simples con `useState` (no nested navigator). Suficiente para MVP; facilita futura extensión.
- **Solo Matches funcional en este sprint**: Privados y Grupos muestran placeholder "próximamente".
- **Endpoint `GET /api/v1/conversations`**: devuelve solo MATCH por ahora. Extensible cuando existan GROUP y DIRECT.
- **Sort por actividad**: use-case ordena por `lastMessage.createdAt` o `conversation.updatedAt` desc en JS (N pequeño — MVP).
- **`isReadOnly` derivado en lista**: igual que en Sprint 1, calculado desde `match.status`.
- **Acceso idéntico al chat individual**: filtra con el mismo criterio que `MatchChatAccessService` (creator OR CONFIRMED/WAITLISTED/SPECTATOR).

### API

- `GET /api/v1/conversations` → `MatchConversationListItem[]`
  - Incluye: `id, type, isReadOnly, match{id,title,status,startsAt}, lastMessage{id,body,senderUsername,createdAt}|null, updatedAt`
  - Solo retorna conversaciones MATCH donde el usuario es creator o participante activo

### Mobile

- `ChatsScreen` con pestañas Privados / Matches / Grupos
- `MatchConversationItem`: título del partido, preview del último mensaje, timestamp (HH:mm si hoy, dd/mm si anterior), badge "Solo lectura" si aplica
- Pull-to-refresh en lista de Matches
- Al tocar → `navigation.navigate('MatchChat', { matchId })` → reutiliza `MatchChatScreen` existente
- `useMatchConversations` hook con React Query (queryKey `['match-conversations']`)

### Tests

- 9 tests unitarios en `list-user-conversations.use-case.spec.ts`
  - shape correcta, isReadOnly played/canceled, lastMessage incluido, sort por tiempo desc, filtro Prisma correcto, array vacío

### Archivos creados / modificados

```
apps/api/src/chat/application/list-user-conversations.use-case.ts (nuevo)
apps/api/src/chat/application/list-user-conversations.use-case.spec.ts (nuevo — 9 tests)
apps/api/src/chat/api/chat.controller.ts (+GET conversations, +ListUserConversationsUseCase)
apps/api/src/chat/chat.module.ts (+ListUserConversationsUseCase provider)
apps/mobile/src/types/api.ts (+MatchConversationListItem)
apps/mobile/src/features/chat/chatClient.ts (+listMatchConversations)
apps/mobile/src/features/chat/useMatchConversations.ts (nuevo)
apps/mobile/src/screens/ChatsScreen.tsx (nuevo)
apps/mobile/src/navigation/AppNavigator.tsx (+ChatsTab en TabParamList y MainTabs)
```

## 45. Chat Sprint 3: Group Chat end-to-end

### Decisiones de diseño

- **Infraestructura compartida**: Se reutiliza el mismo `Conversation`/`Message` model, `ListMessagesUseCase`, `SendMessageUseCase` y WS gateway. Se agrega `groupId` a `Conversation` y se crea `GroupChatAccessService` que verifica `GroupMember` directamente — sin tabla `ConversationMember` separada.
- **Conversación creada con el grupo**: `CreateGroupUseCase` crea la conversación GROUP en la misma `$transaction`. Data migration crea conversaciones para grupos existentes.
- **Acceso derivado de membresía**: No hay sync periódico. El acceso se verifica en cada request contra `GroupMember`. Remover un miembro del grupo revoca el acceso al chat inmediatamente.
- **`GroupChatScreen` independiente** (no abstracción prematura): Espeja `MatchChatScreen` pero usa `useGroupConversation(groupId)`. Sin concepto de `isReadOnly` (grupos siempre escribibles para miembros).
- **Endpoint `GET /api/v1/groups/:groupId/conversation`**: Retorna `ConversationInfo` para que el cliente pueda obtener el `conversationId` y usar los endpoints de mensajes existentes.
- **Endpoint `GET /api/v1/conversations/groups`**: Lista conversaciones GROUP del usuario con lastMessage preview. NestJS resuelve `groups` antes del param `:id` — sin conflicto.
- **Partidos pasados no aparecen en Chats > Matches**: Se filtra `status: { notIn: ['played', 'canceled'] }` al nivel de Prisma query. Los chats de partidos pasados solo se acceden desde el historial del perfil.

### API

- `GET /api/v1/groups/:groupId/conversation` → `ConversationInfo { id, type, isReadOnly }`
  - 403 `CHAT_ACCESS_DENIED` si el usuario no es miembro del grupo
  - 404 `CONVERSATION_NOT_FOUND` si no existe la conversación
- `GET /api/v1/conversations/groups` → `GroupConversationListItem[]`
  - Incluye: `id, type, group{id,name}, lastMessage{id,body,senderUsername,createdAt}|null, updatedAt`
  - Solo retorna grupos donde el usuario es miembro

### DB

- Migración `20260310160000_add_group_conversation`:
  - `Conversation.groupId UUID? @unique` con FK a `Group` (CASCADE)
  - Data migration: INSERT conversations para grupos existentes sin conversación

### Mobile

- `ChatsScreen` pestaña Grupos: lista `GroupConversationListItem`, `GroupConversationItem` mostrando nombre del grupo, last message, timestamp
- Al tocar → `navigation.navigate('GroupChat', { groupId, groupName })`
- `GroupChatScreen`: chat completo reutilizando `useMessages`, `useSendMessage`, `useChatRealtime`
- `GroupDetailScreen`: botón "Chat" en el header → navega a `GroupChat`
- Navegación: `GroupChat: { groupId, groupName }` en `RootStackParamList`

### Tests

- 10 tests en `group-chat.use-case.spec.ts`
  - `GroupChatAccessService`: miembro accede, no-miembro bloqueado
  - `GetGroupConversationUseCase`: retorna ConversationInfo, 403 no-miembro, 404 sin conversación
  - `ListGroupConversationsUseCase`: vacío, shape correcta, sort desc, lastMessage null, filtro por usuario
- `create-group.use-case.spec.ts` actualizado: mock tx incluye `conversation.create`
- `match-chat.use-case.spec.ts` actualizado: `SendMessageUseCase` y `ListMessagesUseCase` reciben `GroupChatAccessService` stub

### Archivos creados / modificados

```
apps/api/prisma/schema.prisma (+groupId en Conversation, +conversation en Group)
apps/api/prisma/migrations/20260310160000_add_group_conversation/migration.sql (nuevo)
apps/api/src/chat/application/group-chat-access.service.ts (nuevo)
apps/api/src/chat/application/get-group-conversation.use-case.ts (nuevo)
apps/api/src/chat/application/list-group-conversations.use-case.ts (nuevo)
apps/api/src/chat/application/group-chat.use-case.spec.ts (nuevo — 10 tests)
apps/api/src/chat/application/send-message.use-case.ts (+GroupChatAccessService, GROUP block)
apps/api/src/chat/application/list-messages.use-case.ts (+GroupChatAccessService, GROUP block)
apps/api/src/chat/application/match-chat.use-case.spec.ts (actualizado — GroupChatAccessService stub)
apps/api/src/chat/application/list-user-conversations.use-case.ts (+filtro played/canceled)
apps/api/src/chat/application/list-user-conversations.use-case.spec.ts (actualizado — 7 tests)
apps/api/src/chat/api/chat.controller.ts (+GET conversations/groups, +GET groups/:groupId/conversation)
apps/api/src/chat/realtime/chat.gateway.ts (+groupId select, GROUP membership check)
apps/api/src/chat/chat.module.ts (+GroupChatAccessService, GetGroupConversationUseCase, ListGroupConversationsUseCase)
apps/api/src/groups/application/create-group.use-case.ts (+conversation.create en tx)
apps/api/src/groups/application/create-group.use-case.spec.ts (actualizado — mock tx con conversation)
apps/mobile/src/types/api.ts (+GroupConversationListItem, +MatchConversationListItem)
apps/mobile/src/features/chat/chatClient.ts (+listGroupConversations, +getGroupConversation)
apps/mobile/src/features/chat/useGroupConversation.ts (nuevo)
apps/mobile/src/features/chat/useGroupConversations.ts (nuevo)
apps/mobile/src/screens/GroupChatScreen.tsx (nuevo)
apps/mobile/src/screens/ChatsScreen.tsx (+Grupos tab, GroupConversationItem)
apps/mobile/src/screens/GroupDetailScreen.tsx (+botón Chat)
apps/mobile/src/navigation/AppNavigator.tsx (+GroupChat en RootStackParamList y stack)
```

## 46. Chat Sprint 4: Direct Chat end-to-end

### Decisiones de diseño

- **Infraestructura compartida**: DIRECT se implementa sobre el mismo `Conversation`/`Message` model, los mismos `ListMessagesUseCase` y `SendMessageUseCase`, y el mismo WS gateway. Sin sistema paralelo.
- **Unicidad por par**: `userAId`/`userBId` almacenados en orden lexicográfico (menor UUID = userA). La unique constraint `@@unique([userAId, userBId])` garantiza que A→B y B→A resuelven a la misma fila.
- **Creación on-demand (get-or-create)**: `GetOrCreateDirectConversationUseCase` busca primero, crea si no existe. Race condition cubierta: si la creación falla con P2002 (duplicate key), re-fetcha la conversación existente.
- **`DirectChatAccessService`**: valida que el actor es `userAId` o `userBId` de la conversación. Sin tabla intermedia de membresía.
- **`DirectChatScreen` recibe `conversationId`**: quien navega (lista o botón de perfil) ya tiene o acaba de obtener el ID. La pantalla no necesita un step adicional de "get conversation".
- **Botón "Mensaje" en perfil público**: llama `POST /conversations/direct` con loading state en el botón, luego navega. Error silencioso (el usuario queda en el perfil y puede reintentar).
- **No self-chat**: 422 `CANNOT_CHAT_WITH_SELF` si `requesterId === targetUserId`.

### API

- `POST /api/v1/conversations/direct` — body: `{ targetUserId: UUID }` → `ConversationInfo { id, type, isReadOnly }`
  - 422 `CANNOT_CHAT_WITH_SELF` si es el mismo usuario
  - 404 `USER_NOT_FOUND` si el target no existe
  - Idempotente: devuelve la conversación existente si ya había una
- `GET /api/v1/conversations/direct` → `DirectConversationListItem[]`
  - Incluye: `id, type, otherUser{id,username,avatarUrl}, lastMessage{id,body,senderUsername,createdAt}|null, updatedAt`
  - Solo retorna conversaciones donde el usuario es userA o userB

### DB

- Migración `20260310180000_add_direct_conversation`:
  - `Conversation.userAId UUID?` y `Conversation.userBId UUID?` con FK a `User`
  - Unique constraint `(userAId, userBId)` para garantizar unicidad del par
  - `@@unique([userAId, userBId])` en schema Prisma

### Mobile

- `DirectChatScreen`: chat completo reutilizando `useMessages`, `useSendMessage`, `useChatRealtime`. Sin nombre del otro usuario en los bubbles (chat 1:1 — contexto implícito).
- `ChatsScreen` pestaña Privados: funcional con `useDirectConversations`, `DirectConversationItem` mostrando username del otro usuario y último mensaje.
- `PublicUserProfileScreen`: botón "Mensaje" con loading state → `getOrCreateDirectConversation` → navega a `DirectChat`.
- `DirectChat: { conversationId, otherUsername }` en `RootStackParamList`; header muestra el username del otro.

### Tests

- 14 tests en `direct-chat.use-case.spec.ts`:
  - `DirectChatAccessService` (4): userA, userB, tercero, conversación inexistente
  - `GetOrCreateDirectConversationUseCase` (6): self-chat 422, USER_NOT_FOUND 404, retorna existente, crea nueva, orden canónico (B→A produce userA<userB), race condition P2002
  - `ListDirectConversationsUseCase` (4): vacío, shape con otherUser siendo userB, otherUser siendo userA, sort desc, filtro Prisma
- `match-chat.use-case.spec.ts` actualizado: `SendMessageUseCase` recibe `DirectChatAccessService` stub como 4º parámetro

### Archivos creados / modificados

```
apps/api/prisma/schema.prisma (+userAId/userBId en Conversation, relations en User)
apps/api/prisma/migrations/20260310180000_add_direct_conversation/migration.sql (nuevo)
apps/api/src/chat/application/direct-chat-access.service.ts (nuevo)
apps/api/src/chat/application/get-or-create-direct-conversation.use-case.ts (nuevo)
apps/api/src/chat/application/list-direct-conversations.use-case.ts (nuevo)
apps/api/src/chat/application/direct-chat.use-case.spec.ts (nuevo — 14 tests)
apps/api/src/chat/application/send-message.use-case.ts (+DirectChatAccessService, DIRECT block)
apps/api/src/chat/application/list-messages.use-case.ts (+DirectChatAccessService, DIRECT block)
apps/api/src/chat/application/match-chat.use-case.spec.ts (actualizado — makeDirectAccess stub)
apps/api/src/chat/realtime/chat.gateway.ts (+DIRECT subscription check, +userAId/userBId en select)
apps/api/src/chat/api/chat.controller.ts (+POST/GET conversations/direct, StartDirectConversationDto)
apps/api/src/chat/chat.module.ts (+DirectChatAccessService, GetOrCreateDirectConversationUseCase, ListDirectConversationsUseCase)
apps/mobile/src/types/api.ts (+DirectConversationListItem)
apps/mobile/src/features/chat/chatClient.ts (+listDirectConversations, +getOrCreateDirectConversation)
apps/mobile/src/features/chat/useDirectConversations.ts (nuevo)
apps/mobile/src/screens/DirectChatScreen.tsx (nuevo)
apps/mobile/src/screens/ChatsScreen.tsx (+Privados tab, DirectConversationItem, useDirectConversations)
apps/mobile/src/screens/PublicUserProfileScreen.tsx (+Mensaje button, handleMessage, startingChat state)
apps/mobile/src/navigation/AppNavigator.tsx (+DirectChat en RootStackParamList y stack, import DirectChatScreen)
```

---

## 47. Chat Polish: Unread/listas en tiempo real, errores, lifecycle, robustez

Sprint de pulido post-chat antes de push notifications. Sin features nuevas: corrección de bugs reales y consistencia.

### Bugs corregidos

**Backend:**
- Sin cambios en el filtro de `list-user-conversations` — los partidos played/canceled no aparecen en la lista de chats (comportamiento intencional).

**Mobile:**
- `ChatsScreen`: `refreshing={matchLoading}` → `refreshing={matchRefetching}`. `isLoading` es true solo en la carga inicial; `isRefetching` es true durante pull-to-refresh. El spinner nunca aparecía en refetch.
- `ChatsScreen`: agregados estados de error con botón "Reintentar" en las tres pestañas. Antes mostraba estado vacío cuando la API fallaba.
- `MatchChatScreen` / `GroupChatScreen`: eliminado `useEffect` con `scrollToIndex(0)` en mount. Se ejecutaba cuando messages estaba vacío (carga async), podía lanzar excepciones, y era innecesario: el `inverted FlatList` ya posiciona el scroll en el mensaje más reciente.
- `DirectChatScreen`: agregado estado de error con botón "Reintentar". Antes no tenía ningún manejo de `isError`.

### Mejoras realtime

- `useChatRealtime`: al recibir `message.new` via WS, ahora también actualiza en-caché las listas de conversaciones (`match-conversations`, `group-conversations`, `direct-conversations`) actualizando `lastMessage` y re-ordenando. Zero-network: solo el cache de la lista que contiene la conversación cambia; las otras son no-ops.
- `useSendMessage`: tras envío exitoso, invalida las tres listas de conversaciones. Backup para cuando el WS está temporalmente desconectado.
- Resultado: ChatsScreen se actualiza en tiempo real cuando llega un mensaje (sin pull-to-refresh).

### Tests

- `list-user-conversations.use-case.spec.ts`: actualizado test de filtro Prisma (eliminada aserción de `status: notIn`), añadidos 2 tests nuevos: `marks played match as isReadOnly` y `marks canceled match as isReadOnly`. Total chat suite: 52 tests ✓, suite completa API: 361 tests ✓.

### Archivos modificados

```
apps/api/src/chat/application/list-user-conversations.use-case.ts (eliminado filtro status notIn)
apps/api/src/chat/application/list-user-conversations.use-case.spec.ts (test filtro + 2 tests isReadOnly)
apps/mobile/src/features/chat/useChatRealtime.ts (update conversation list caches on new message)
apps/mobile/src/features/chat/useSendMessage.ts (invalidate conversation lists on success)
apps/mobile/src/screens/ChatsScreen.tsx (refreshing fix, error states con retry)
apps/mobile/src/screens/MatchChatScreen.tsx (eliminado scrollToIndex useEffect)
apps/mobile/src/screens/GroupChatScreen.tsx (eliminado scrollToIndex useEffect)
apps/mobile/src/screens/DirectChatScreen.tsx (error state con retry)
```

---

## 48. Chat Push Notifications Sprint 1: fanout unificado por conversación

### Qué se hizo

Integración de push notifications para mensajes de chat sobre la infraestructura existente de `PushModule` / `NotificationProvider`. Arquitectura unificada: un solo servicio maneja MATCH, GROUP y DIRECT sin lógica por tipo fuera del fanout de destinatarios y la construcción del payload.

### Decisiones de diseño

- **Fuente de destinatarios**: Para MATCH se usa `MatchParticipant` con `status IN [CONFIRMED, WAITLISTED, SPECTATOR]` — consistente con los statuses que otorgan acceso al chat. Para GROUP se usa `GroupMember`. Para DIRECT los dos campos `userAId`/`userBId` de la conversación.
- **Sin ConversationMember table**: La membresía ya existe en las tablas nativas; agregar una tabla denormalizada para MVP sería complejidad sin beneficio real.
- **Dedup natural**: `SendMessageUseCase` ahora retorna `{ message, created: boolean }`. El controller solo dispara push cuando `created === true`, evitando reenviar en retries idempotentes.
- **Fire-and-forget**: `void chatNotifications.onMessageCreated(message).catch(...)` desde el controller, post-WS-emit.
- **Deep link payload**: `data.type === 'chat_message'` discrimina de notificaciones legacy. `conversationType` indica el tipo, más los ids/nombres necesarios para navegar directo al chat correcto.

### Payload de push por tipo

| Tipo  | title          | body                        | data                                                              |
|-------|----------------|-----------------------------|-------------------------------------------------------------------|
| MATCH | match.title    | `{username}: {msg}`         | `{ type, conversationType:'MATCH', matchId }`                    |
| GROUP | group.name     | `{username}: {msg}`         | `{ type, conversationType:'GROUP', groupId, groupName }`          |
| DIRECT| senderUsername | `{msg}` (sin prefijo)       | `{ type, conversationType:'DIRECT', conversationId, otherUsername }` |

- Cuerpos > 100 chars se truncan con `…`.

### Mobile deep link

`handleNotificationTap()` en `App.tsx` discrimina por `data.type`:
- `chat_message + MATCH` → `MatchChat { matchId }`
- `chat_message + GROUP` → `GroupChat { groupId, groupName }`
- `chat_message + DIRECT` → `DirectChat { conversationId, otherUsername }`
- Cualquier otra notificación (legacy) → `MatchDetail { matchId }` si tiene `matchId`.

### Tests

12 tests en `chat-notification.service.spec.ts`: fanout por tipo, exclusión del sender, payload correcto, truncación, conversación no encontrada.

### Archivos modificados/creados

```
apps/api/src/chat/application/chat-notification.service.ts (NUEVO)
apps/api/src/chat/application/chat-notification.service.spec.ts (NUEVO — 12 tests)
apps/api/src/chat/application/send-message.use-case.ts (retorna { message, created })
apps/api/src/chat/application/match-chat.use-case.spec.ts (actualizar assertions por nuevo return type)
apps/api/src/chat/api/chat.controller.ts (+ChatNotificationService, fire-and-forget, Logger)
apps/api/src/chat/chat.module.ts (+PushModule import, +ChatNotificationService)
apps/mobile/App.tsx (handleNotificationTap con deep link a chats)
```

---

## 49. Chat Push Notifications Sprint 2: unread tracking, push suppression, deep link robusto

### Qué se hizo

Sprint de pulido de notificaciones de chat: supresión de push cuando el usuario está viendo el chat, unread indicators en la lista de conversaciones, mark-as-read automático y fix de deep link en cold start.

### Decisiones de diseño

- **ConversationReadState**: tabla simple `(userId, conversationId, lastReadAt)` con PK compuesta. Upsert en cada mark-as-read. Base limpia para mute/preferencias futuras sin complejidad prematura.
- **hasUnread**: computed server-side en los list use cases. Estrategia: `lastMessage existe && lastMessage.senderId != userId && (lastReadAt is null || lastMessage.createdAt > lastReadAt)`. Un check O(1) por conversación con una sola query extra (`findMany` de read states).
- **Push suppression vía Redis**: `chat:viewing:{conversationId}:{userId}` con TTL 90s. Set en `chat.subscribe`, del en `chat.unsubscribe` y disconnect. `ChatNotificationService.filterViewingUsers()` usa `MGET` para filtrar en batch. Fail-open si Redis es null.
- **Mark-as-read integrado en useChatRealtime**: al subscribir (montar pantalla) y al recibir cada mensaje nuevo. Cache update optimista en las listas (`hasUnread: false`) sin invalidar ni re-fetchear la red.
- **Cold start deep link**: `navigateWhenReady()` reintentar hasta 10 veces cada 150ms hasta que `navigationRef.isReady()`. Elimina la race condition donde la navegación se silenciaba porque el stack aún no estaba montado.

### Flujo completo

```
Usuario abre DirectChatScreen
  → useChatRealtime monta → chat.subscribe WS
  → ChatGateway: Redis SETEX chat:viewing:{convId}:{userId} 90 1
  → useChatRealtime: markConversationRead(convId) [fire-and-forget]
    → POST /conversations/:id/read → ConversationReadState upsert
    → cache: match/group/direct-conversations[convId].hasUnread = false

Mensaje nuevo llega mientras está en pantalla
  → message.new WS → onMessage handler
  → cache messages + lista actualizada (hasUnread: false)
  → markConversationRead(convId) [fire-and-forget]
  → ChatNotificationService.onMessageCreated():
    → resolveRecipients()
    → filterViewingUsers(): MGET → user está viewing → excluido
    → NO push enviada

Usuario sale de la pantalla
  → chat.unsubscribe WS
  → ChatGateway: Redis DEL chat:viewing:{convId}:{userId}

Próximo mensaje → push enviada normalmente
```

### Unread dots en ChatsScreen

- Punto azul (8px) junto al timestamp en items con `hasUnread: true`
- Título y preview en bold cuando hay mensajes no leídos
- `updateListLastMessage` (en useChatRealtime) setea `hasUnread: false` inline al actualizar el cache de lista mientras se está viendo la conversación

### Tests

- `mark-conversation-read.use-case.spec.ts`: 2 tests (upsert, 404 si no existe)
- `chat-notification.service.spec.ts`: +3 tests Redis (viewing suppresses, not viewing sends, null Redis fails open)
- Total API suite: **376 tests ✓**

### Archivos modificados/creados

```
apps/api/prisma/migrations/20260311120000_add_conversation_read_state/migration.sql (NUEVO)
apps/api/prisma/schema.prisma (+ConversationReadState model, back-relations)
apps/api/src/chat/application/mark-conversation-read.use-case.ts (NUEVO)
apps/api/src/chat/application/mark-conversation-read.use-case.spec.ts (NUEVO — 2 tests)
apps/api/src/chat/application/list-user-conversations.use-case.ts (+hasUnread, +readStates query)
apps/api/src/chat/application/list-group-conversations.use-case.ts (+hasUnread, +readStates query)
apps/api/src/chat/application/list-direct-conversations.use-case.ts (+hasUnread, +readStates query)
apps/api/src/chat/application/chat-notification.service.ts (+REDIS_CLIENT, filterViewingUsers)
apps/api/src/chat/application/chat-notification.service.spec.ts (+3 Redis suppression tests)
apps/api/src/chat/realtime/chat.gateway.ts (+REDIS_CLIENT, SETEX on subscribe, DEL on unsubscribe/disconnect)
apps/api/src/chat/api/chat.controller.ts (+POST /conversations/:id/read, +MarkConversationReadUseCase)
apps/api/src/chat/chat.module.ts (+MarkConversationReadUseCase)
apps/api/src/chat/application/list-user-conversations.use-case.spec.ts (+conversationReadState mock)
apps/api/src/chat/application/group-chat.use-case.spec.ts (+conversationReadState mock)
apps/api/src/chat/application/direct-chat.use-case.spec.ts (+conversationReadState mock)
apps/mobile/src/types/api.ts (+hasUnread en 3 list item interfaces)
apps/mobile/src/features/chat/chatClient.ts (+markConversationRead)
apps/mobile/src/features/chat/useChatRealtime.ts (+markRead on subscribe/message, +hasUnread: false en cache)
apps/mobile/src/screens/ChatsScreen.tsx (+UnreadDot, unread styles, itemTitleUnread, itemPreviewUnread)
apps/mobile/App.tsx (+navigateWhenReady cold start fix)
```

## 50. Chat UX: Unread badge en Home, tab por defecto, realtime FlatList fix

### Qué se hizo

**Badge de no leídos en Home:**
- Nuevo use case `GetUnreadCountUseCase` (4 queries paralelas — match/group/direct — mismo patrón hasUnread que listas existentes).
- Nuevo endpoint `GET /api/v1/conversations/unread-count` → `{ total: number }`.
- Hook `useUnreadCount()` en mobile (React Query, polling 60s, staleTime 30s).
- Badge rojo con número sobre el botón "Chats" en HomeScreen. Se invalida al marcar conversaciones leídas.

**Tab por defecto en ChatsScreen:**
- Cambio de `useState('matches')` → `useState('privados')`.

**Realtime FlatList fix:**
- `maintainVisibleContentPosition={{ minIndexForVisible: 1, autoscrollToTopThreshold: 10 }}` en los tres FlatList de chat (Match/Group/Direct). Evita el salto de scroll al prepender mensajes en modo `inverted`.
- `scrollToOffset({ offset: 0 })` al enviar un mensaje (retorna el viewport al mensaje más nuevo).
- Fix en `useChatRealtime.onMessage`: si el cache no está inicializado aún (`old === undefined`), seed la primera página con el mensaje recibido en lugar de descartarlo silenciosamente.
- `invalidateQueries(['unread-count'])` en `markRead` para que el badge refleje el estado real.

### Archivos modificados

```
apps/api/src/chat/application/get-unread-count.use-case.ts (nuevo)
apps/api/src/chat/chat.module.ts (+GetUnreadCountUseCase)
apps/api/src/chat/api/chat.controller.ts (+GET conversations/unread-count)
apps/mobile/src/features/chat/chatClient.ts (+getUnreadConversationCount)
apps/mobile/src/features/chat/useUnreadCount.ts (nuevo)
apps/mobile/src/screens/HomeScreen.tsx (+useUnreadCount, badge sobre Chats btn)
apps/mobile/src/screens/ChatsScreen.tsx (default tab 'privados')
apps/mobile/src/features/chat/useChatRealtime.ts (seed cache, invalidate unread-count)
apps/mobile/src/screens/MatchChatScreen.tsx (maintainVisibleContentPosition, scrollToOffset on send)
apps/mobile/src/screens/GroupChatScreen.tsx (idem)
apps/mobile/src/screens/DirectChatScreen.tsx (idem)
```

---

## 51. Refactor: reorganización de application/ en módulos auth y chat

### Qué se hizo

Reorganización pura de archivos — sin cambios de lógica ni de comportamiento. Los módulos `auth` y `chat` tenían ~22 archivos planos cada uno en `application/`. Se crearon subcarpetas por responsabilidad para mejorar navegabilidad.

### Estructura resultante

**auth/application/**
```
sessions/   login, logout, logout-all, refresh, revoke-session, list-sessions
password/   change-password, request-password-reset, confirm-password-reset
email/      request-email-verify, confirm-email-verify
profile/    register, get-me, update-me, prepare-avatar, confirm-avatar
```

**chat/application/**
```
conversations/  find-direct, get-or-create-direct, get-match, get-group, list-direct, list-group, list-user, send-first-direct
messages/       send-message, list-messages
read/           mark-conversation-read, get-unread-count
access/         direct-chat-access.service, group-chat-access.service, match-chat-access.service
notifications/  chat-notification.service
```

### Decisiones

- Los `*-access.service` de chat se separaron porque son lógica de autorización distinta a los use-cases de conversación.
- No se crearon barrel `index.ts` — imports directos al archivo.
- Todos los imports en controllers, módulos, specs y archivos cruzados fueron actualizados.
- Tests: 400 pasando sin cambios de lógica.

### Archivos modificados

```
apps/api/src/auth/application/** (todos movidos a subcarpetas)
apps/api/src/chat/application/** (todos movidos a subcarpetas)
apps/api/src/auth/auth.module.ts (paths actualizados)
apps/api/src/chat/chat.module.ts (paths actualizados)
apps/api/src/auth/api/*.controller.ts (5 controllers — paths actualizados)
apps/api/src/chat/api/chat.controller.ts (paths actualizados)
apps/api/src/chat/realtime/chat-realtime.publisher.ts (paths actualizados)
apps/api/src/chat/realtime/chat.gateway.ts (paths actualizados)
```

---

## 52. Match Reminders: T-24h y T-2h para jugadores confirmados

### Qué se hizo

Extensión del sistema de reminders del `MatchLifecycleJob`. El sistema anterior solo cubría la ventana de 60 minutos previos al partido (buckets b0–b3) y notificaba solo a admins. Se agregaron dos nuevas ventanas temporales dirigidas a todos los jugadores confirmados.

### Nuevas ventanas

| Ventana | Rango de query | Bucket | Destinatarios |
|---|---|---|---|
| T-24h | startsAt in (now+23h, now+25h] | `t24h` | CONFIRMED participants |
| T-2h | startsAt in (now+1.5h, now+2.5h] | `t2h` | CONFIRMED participants |

Las ventanas tienen 2 horas de ancho para garantizar cobertura completa con el cron de 1 minuto. El bucket fijo previene reenvíos: máximo 1 notif por `(userId, matchId, type, bucket)`.

### Dedup

Mismo mecanismo que `reminder_missing_players` — bucket-based en `NotificationDelivery`. Sin cooldown por tiempo, solo por bucket. Sin migración de DB (columna `bucket` ya existía).

### Mensajes

- T-24h: "Tu partido es mañana" / `"${title}" comienza en ~24 horas.`
- T-2h: "¡Tu partido está por empezar!" / `"${title}" comienza en 2 horas. ¡Preparate!`

### Archivos modificados

```
apps/api/src/matches/application/notifications/match-notification.service.ts
  +tipos reminder_24h, reminder_2h
  +métodos onReminder24h, onReminder2h
  +helper privado sendTimedReminder

apps/api/src/matches/application/lifecycle/match-lifecycle.job.ts
  +2 queries en runTick() (ventanas T-24h y T-2h)
  +método privado sendTimedReminder
  +Redis REDIS_CLIENT @Optional() — escribe lifecycle:lastTickAt en cada tick

apps/api/src/matches/application/lifecycle/match-lifecycle.job.spec.ts
  buildJob() ampliado a 5 parámetros (+ reminder24hMatches, reminder2hMatches)
  buildMockNotification() + onReminder24h, onReminder2h
  +6 tests nuevos (2 describe blocks: T-24h, T-2h)
```

---

## 53. Admin Panel: módulo de moderación y operación de sistema

### Qué se hizo

Nuevo módulo `admin` con endpoints bajo `/api/v1/admin/*`. Todos protegidos por `JwtAuthGuard + RolesGuard + @Roles('ADMIN')`. El enum `Role { USER, ADMIN }` ya existía en schema. El módulo de venues ya tenía su propio `AdminVenuesController` en `/admin/venues` — no fue tocado.

### Migración DB

```
User.bannedAt  DateTime?   — ban manual de moderación (distinto de suspendedUntil que es automático)
User.banReason String?
```

### Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| GET | /admin/dashboard | Stats generales del sistema |
| GET | /admin/users | Lista con search, filtro status, paginación |
| GET | /admin/users/:id | Perfil completo + push tokens + stats de partidos |
| POST | /admin/users/:id/ban | Ban con reason |
| POST | /admin/users/:id/unban | Unban |
| GET | /admin/matches | Lista con filtros status/fecha, paginación |
| GET | /admin/matches/:id | Detalle completo: participants + notifs + audit log |
| POST | /admin/matches/:id/cancel | Cancel sin expectedRevision (admin override) |
| DELETE | /admin/matches/:id | Hard delete con cascade |
| POST | /admin/matches/:id/unlock | Unlock + WS publish |
| GET | /admin/system/health | Cron status (Redis lastTickAt), push stats, DB ping |

### Decisiones

- `bannedAt` separado de `suspendedUntil`: el primero es moderación manual, el segundo es el sistema de reliability automático.
- `CancelMatchAdminUseCase` no reutiliza `CancelMatchUseCase` — el admin override no necesita expectedRevision ni idempotency key.
- `DeleteMatchUseCase` elimina manualmente `NotificationDelivery` (no tiene FK cascade); el resto de relaciones tienen `onDelete: Cascade`.
- `GetSystemHealthQuery` lee `lifecycle:lastTickAt` de Redis (TTL 120s). Si no existe o está expirado → `status: 'stale'`. Redis es `@Optional()` en todos los inyectores que lo usan.
- Login actualizado: si `user.bannedAt !== null` → 403 `USER_BANNED`.
- El admin panel frontend queda pendiente (ver `docs/future-implementations.md`).

### Archivos creados

```
apps/api/src/admin/admin.module.ts
apps/api/src/admin/api/admin-dashboard.controller.ts
apps/api/src/admin/api/admin-users.controller.ts
apps/api/src/admin/api/admin-matches.controller.ts
apps/api/src/admin/api/admin-system.controller.ts
apps/api/src/admin/api/dto/admin-ban.dto.ts
apps/api/src/admin/api/dto/admin-users-query.dto.ts
apps/api/src/admin/api/dto/admin-matches-query.dto.ts
apps/api/src/admin/application/get-dashboard.query.ts
apps/api/src/admin/application/list-admin-users.query.ts
apps/api/src/admin/application/get-admin-user.query.ts
apps/api/src/admin/application/ban-user.use-case.ts
apps/api/src/admin/application/unban-user.use-case.ts
apps/api/src/admin/application/list-admin-matches.query.ts
apps/api/src/admin/application/get-admin-match.query.ts
apps/api/src/admin/application/cancel-match-admin.use-case.ts
apps/api/src/admin/application/delete-match.use-case.ts
apps/api/src/admin/application/unlock-match-admin.use-case.ts
apps/api/src/admin/application/get-system-health.query.ts
apps/api/prisma/migrations/20260314005831_add_user_ban_fields/migration.sql
```

### Archivos modificados

```
apps/api/prisma/schema.prisma (+bannedAt, banReason en User)
apps/api/src/app.module.ts (+AdminModule)
apps/api/src/auth/application/sessions/login.use-case.ts (+banned check → 403 USER_BANNED)
apps/api/src/matches/application/lifecycle/match-lifecycle.job.ts (+REDIS_CLIENT @Optional, lastTickAt write)
apps/api/src/matches/application/lifecycle/match-lifecycle.job.spec.ts (null como arg Redis en todos los tests)
apps/api/src/auth/application/sessions/login.use-case.spec.ts (+bannedAt: null en mock)
```
