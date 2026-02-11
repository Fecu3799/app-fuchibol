# CLAUDE.md — Reglas de trabajo (Monorepo: RN + NestJS + Postgres + Redis)

Este repo se construye como **MVP escalable** con **monolito modular**, **DDD pragmático**, **Light CQRS**, **realtime resiliente**.
El objetivo es velocidad con calidad: reglas de negocio claras + DB constraints + idempotencia.

---

## 0) Principios no negociables

1. **No inventar complejidad**: nada de microservicios/brokers/outbox en MVP.
2. **Vertical slices**: cada feature debe funcionar end-to-end (API + DB + UI mínima).
3. **DB es la fuente de verdad**. WebSocket es best-effort.
4. **Idempotencia obligatoria** en acciones sensibles.
5. **Optimistic locking** con `revision` para updates admin.
6. **Constraints primero** (unique keys, FKs, índices).
7. **Migrations + seeds** siempre que se agregue una entidad/regla.

---

## 1) Stack y convenciones

- Mobile: React Native (Expo), TypeScript.
- API: NestJS (TypeScript).
- DB: Postgres.
- Cache/Presence/Jobs: Redis (MVP: presence + rate limit; jobs pueden ser BullMQ si se usa).
- Shared: `packages/shared` para enums/schemas (Zod).

### Lenguaje

- Código en inglés (nombres de variables, clases, funciones).
- Comentarios solo para decisiones importantes (no describir lo obvio).

---

## 2) Arquitectura backend (NestJS)

### Estructura por módulos (bounded contexts)

- `auth`
- `users`
- `groups`
- `matches` (core)
- `chat`
- `notifications`
- `infra` (db/redis/config)

### Patrón de capas (DDD pragmático)

- `domain/` (entidades, value objects si aplican, reglas)
- `application/` (use-cases/commands/queries)
- `infra/` (repositorios, persistencia, adapters)
- `api/` (controllers/dtos/guards)

**Regla**: lógica de negocio crítica vive en `application` y/o `domain`, no en controllers.

### Light CQRS

- Commands mutan estado (transacciones).
- Queries devuelven DTOs optimizados (sin exponer entidades internas).

---

## 3) Reglas de negocio (resumen v1)

Estados match: scheduled, locked, played, canceled.

Participant status: invited, confirmed, declined, waitlist, kicked.

Reglas clave:

- Confirm: invited -> confirmed si hay cupo, sino -> waitlist.
- Withdraw confirmed:
  - si hay waitlist => promover 1º a confirmed
  - si no hay waitlist => estado match no cambia
- Abandono: withdraw confirmed dentro de la última hora antes del inicio.
  - No cuenta si cancel o cambio mayor que fuerza reconfirmación.
- Cambio mayor (fecha/hora/lugar/capacidad):
  - match vuelve a scheduled
  - confirmed -> invited
  - waitlist se mantiene
- Baja de cupo:
  - últimos confirmados pasan a waitlist (por confirmedAt desc).
- Declined NO puede confirmar directo: solo admin puede reinvite (declined -> invited).
- Locked es flexible: no bloquea confirm/baja.

---

## 4) Concurrencia, idempotencia y dedupe

### 4.1 Idempotency keys

- Endpoints: confirm/decline/withdraw deben recibir `requestId` (UUID).
- Guardar `requestId` procesado por (userId, matchId, action).
- Responder consistentemente en retries.

### 4.2 Optimistic locking

- `matches.revision` incrementa en cambios relevantes.
- Updates admin requieren `expectedRevision`.
- Si mismatch => 409 REVISION_CONFLICT.

### 4.3 Chat dedupe

- Cliente envía `clientMsgId`.
- DB constraint UNIQUE(scopeId, senderId, clientMsgId).
- Responder ACK con serverMsgId.

---

## 5) Realtime (WebSocket)

- Realtime es best-effort.
- Al entrar a sala:
  1. GET snapshot (incluye revision)
  2. WS subscribe con lastKnownRevision
  3. si gap => RESYNC_REQUIRED -> GET snapshot
- Presence:
  - heartbeat cada 20-30s
  - TTL 60s en Redis
- Nunca depender de WS para consistencia de estado.

---

## 6) Mobile (React Native)

- Pantallas mínimas primero (sin pixel-perfect).
- Estado: preferir server state (React Query) antes que estados globales innecesarios.
- Manejar reconexión WS (re-subscribe + resync snapshot).
- Jamás asumir conexión estable.

---

## 7) Calidad: testing obligatorio por regla, no por cobertura

Cada regla crítica debe tener tests:

- capacity reduce => últimos confirmados a waitlist
- cambio mayor => confirmed -> invited sin abandono
- withdraw <1h => abandono++
- withdraw con waitlist => promoción 1º FIFO
- revision conflict => 409

Preferir tests de use-cases (application layer) + integración DB para invariantes.

---

## 8) Entregables por PR (checklist)

- [ ] Migración y constraints (si aplica)
- [ ] Seeds/fixtures actualizadas
- [ ] Use-case + tests (regla cubierta)
- [ ] DTOs validados (Zod y/o class-validator)
- [ ] Manejo de errores consistente (409/403/422)
- [ ] Logs estructurados con matchId/userId cuando aplique

---

## 9) “No hacer” (para evitar deuda)

- No introducir microservicios, event buses externos, CQRS completo.
- No meter Redux/estado global sin necesidad.
- No “dejar para después” idempotencia/revision/constraints.
- No mockear backend por semanas: siempre integrar temprano.

---

## 10) Estilo de commits y ramas

- Commits pequeños, orientados a slice.
- Prefijos sugeridos:
  - feat(api): ...
  - feat(mobile): ...
  - fix(core): ...
  - chore(infra): ...
  - test(core): ...
