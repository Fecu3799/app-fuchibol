# ⚽ Fuchibol

> **Organizar un partido no debería requerir 47 mensajes de WhatsApp.**

Fuchibol es una app mobile-first para gestionar partidos de fútbol amateur entre amigos: cupo, confirmaciones, waitlist automática, chat en tiempo real y notificaciones — todo en un solo lugar.

---

## ¿Qué hace?

- **Creá y gestioná partidos** con fecha, lugar y capacidad
- **Confirmá tu lugar** — si el partido está lleno, entrás a la waitlist
- **Promoción automática** — cuando alguien se va, el primero de la lista entra solo
- **Chat en tiempo real** — por partido, por grupo y entre jugadores
- **Notificaciones push** — cuando te invitan, cuando te promocionan, cuando hay cambios
- **Grupos de amigos** — para invitar rápido a tu equipo habitual
- **Historial de partidos** y puntaje de confiabilidad por jugador

---

## El problema

Organizar un partido con WhatsApp es un caos:

- Nadie sabe quién confirmó y quién no
- Cuando alguien se baja, hay que hacer todo a mano
- Los mensajes importantes se pierden en el chat
- No hay forma de saber cuántos faltan para completar el equipo

---

## La solución

Fuchibol centraliza toda la lógica de un partido:

- Estado claro para cada jugador (`invited → confirmed → waitlist`)
- Waitlist FIFO automática — sin intervención humana
- Notificaciones dirigidas por evento (no spam)
- Chat desacoplado del estado del partido
- El organizador puede delegar administración sin perder control

---

## Arquitectura

### Monolito modular + DDD pragmático

El backend está organizado en bounded contexts:

```
auth · users · groups · matches · chat · notifications · push · infra
```

Cada módulo sigue una separación en capas:

```
domain/       → entidades, value objects, reglas puras
application/  → use-cases / commands / queries
infra/        → repositorios, adapters, persistencia
api/          → controllers, DTOs, guards
```

La lógica de negocio vive en `application/` y `domain/` — nunca en controllers.

---

### Match como agregado principal

`Match` concentra las reglas más críticas del sistema:

- Estados: `scheduled → locked → played / canceled`
- `locked` solo bloquea nuevas invitaciones — no bloquea a jugadores ya invitados
- `played` y `canceled` son inmutables
- Cada participante tiene un status individual con transiciones controladas

```
invited → confirmed ──→ waitlist (si cupo lleno)
        ↘ declined
confirmed → spectator (libera cupo, promueve waitlist)
(cualquier) → spectator → invited (toggle)
```

---

### Optimistic locking con `revision`

Cada mutación del Match incrementa un campo `revision`. Las operaciones admin incluyen `expectedRevision` en el body. Si hay conflicto → `409 REVISION_CONFLICT`.

Esto evita condiciones de carrera sin necesidad de locks pesimistas ni transacciones distribuidas.

---

### Idempotencia por diseño

Las acciones sensibles (`confirm`, `decline`, `leave`, `cancel`, `toggle-spectator`) requieren un header `Idempotency-Key` (UUID). El servidor guarda `(userId, matchId, action, key)` y responde igual en retries.

Resultado: safe to retry desde el cliente sin efectos duplicados.

---

### Realtime: snapshot + resync, no estado parcial

El servidor **nunca emite estado** por WebSocket — solo emite `{ matchId, revision }`.

Flujo del cliente:

```
1. GET snapshot (incluye revision actual)
2. WS subscribe al match
3. On match.updated → si revision > local → refetch via HTTP
```

Beneficios:
- El cliente siempre tiene el estado completo y consistente
- Los eventos WS se pueden perder o llegar out-of-order sin consecuencias
- Coalesce: una ráfaga de N eventos genera máximo 2 GETs

---

## Decisiones técnicas

### ¿Por qué no microservicios?

El dominio es pequeño y el equipo es uno. Los microservicios habrían introducido complejidad operacional (service discovery, contratos, deploys coordinados) sin beneficio real en esta etapa. El monolito modular da la misma separación de responsabilidades con mucho menos overhead.

### ¿Por qué Postgres como fuente de verdad?

Redis es rápido pero eventual. Postgres garantiza consistencia con transacciones ACID, constraints únicos y optimistic locking. Redis se usa solo para rate limiting y presencia — nunca para estado de negocio.

### ¿Por qué WebSockets "best effort"?

Forzar consistencia fuerte por WS requiere ACKs, redelivery y estado en el servidor. El trade-off no vale: es más simple tener HTTP como fuente de verdad y WS como señal de "hay algo nuevo". Si se pierde un evento, el cliente refetcha igual en el próximo focus/mount.

---

## Features técnicas destacadas

| Feature | Detalle |
|---|---|
| **Waitlist FIFO automática** | Al liberar un cupo (`leave`, `spectator`), se promueve el primer `waitlisted` por `confirmedAt ASC` |
| **Reconfirmación por cambios mayores** | Cambio de fecha/hora/lugar/capacidad → todos los `confirmed` vuelven a `invited` (excepto el creator) |
| **Deduplicación de chat** | `clientMsgId` con constraint UNIQUE en DB — el cliente puede reenviar sin duplicar |
| **Push con suppress + dedupe** | Ventanas de tiempo por tipo de notificación; suppression si el usuario tiene la app abierta; tabla `NotificationDelivery` como registro |
| **Reliability score** | `lateLeaveCount` por jugador — si te bajás en las últimas horas antes del partido, queda registrado |
| **Admin Panel web** | Módulo separado (Vite + React) para moderación y operación del sistema |
| **Team Assembly** | Auto-generación de equipos a T-30min con sincronización de slots |
| **Match Scheduler** | Jobs automáticos para recordatorios (T-24h, T-2h), freeze de edición y transición de estados |
| **Session management** | Multi-device con refresh rotation, reuse detection y revocación de sesiones |
| **Audit log** | Append-only por partido — todas las acciones quedan registradas con actor y metadata |

---

## Observabilidad y seguridad

- **Logs estructurados** con `requestId` propagado en toda la cadena de llamadas
- **Métricas operacionales** estilo Prometheus (match events, push delivery, WS connections, query latency)
- **Rate limiting** por endpoint con throttle guards
- **WS auth** — JWT validado al conectar; sockets sin token válido son rechazados
- **Helmet + CORS + body limit** configurados
- **Health endpoints** para liveness y readiness

---

## Stack

| Capa | Tecnología |
|---|---|
| API | NestJS · TypeScript · Prisma ORM |
| Base de datos | PostgreSQL 16 |
| Cache / Presencia | Redis 7 |
| Mobile | React Native · Expo · React Query |
| Realtime | Socket.IO (WebSockets) |
| Push | Expo Push (abstracción lista para FCM/APNs) |
| Monorepo | pnpm workspaces |
| CI/CD | GitHub Actions |
| Admin | Vite + React |

---

## Cómo correr el proyecto

### Requisitos

- Node.js 20+
- pnpm 9+
- Docker (para Postgres y Redis)

### Setup

```bash
# 1. Clonar e instalar
git clone https://github.com/tu-usuario/fuchibol-app.git
cd fuchibol-app
pnpm install

# 2. Levantar infraestructura
docker compose -f infra/docker-compose.yml up -d

# 3. Variables de entorno
cp apps/api/.env.example apps/api/.env
# Completar DATABASE_URL, JWT_SECRET, etc.

# 4. Migrations + seed
pnpm -C apps/api prisma migrate dev

# 5. Correr API y mobile
pnpm dev:api
pnpm dev:mobile
```

---

## Roadmap

- [ ] Monetización: partidos de pago con split automático
- [ ] Analytics: heatmaps de participación, tendencias por grupo
- [ ] Rating post-partido entre jugadores
- [ ] Federación de grupos (torneos)
- [ ] FCM / APNs directo para producción
- [ ] Escalamiento horizontal via Socket.IO Redis Adapter

---

## Contexto

Este proyecto empezó como "hagamos algo mejor que el grupo de WhatsApp" y terminó siendo un sistema con estado distribuido consistente, lógica de dominio no trivial y una UX mobile pensada para uso real.

Cada decisión técnica tiene un *por qué*. El código está para demostrarlo.

---

*Built with production mindset — by [Facundo](https://github.com/tu-usuario)*
