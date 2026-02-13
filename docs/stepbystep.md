# Fuchibol App — Step by Step

Registro cronologico del desarrollo del proyecto. Cada seccion documenta un paso concreto: que se hizo, que archivos se crearon/modificaron, que convenciones se establecieron y como se integra con el resto.

---

## Indice

1. [Bootstrap del monorepo](#1-bootstrap-del-monorepo)
2. [Infraestructura local (Docker)](#2-infraestructura-local-docker)
3. [API: esqueleto NestJS + Prisma](#3-api-esqueleto-nestjs--prisma)
4. [Mobile: esqueleto Expo](#4-mobile-esqueleto-expo)
5. [Shared: paquete compartido](#5-shared-paquete-compartido)
6. [CI/CD: GitHub Actions](#6-cicd-github-actions)
7. [Slice: Matches API (create + get)](#7-slice-matches-api-create--get)
8. [Slice: Identity & Access (auth MVP)](#8-slice-identity--access-auth-mvp)
9. [Slice: Match Participation](#9-slice-match-participation)
10. [Slice: Match Updates + Lock/Unlock + Reconfirmacion](#10-slice-match-updates--lockunlock--reconfirmacion)
11. [Read Model: Home (List Matches)](#11-read-model-home-list-matches)
12. [Health Endpoint + CORS + LAN Bind](#12-health-endpoint--cors--lan-bind)
13. [Mobile: Smoke Test de Conectividad](#13-mobile-smoke-test-de-conectividad)
14. [Monorepo pnpm Workspaces (cleanup)](#14-monorepo-pnpm-workspaces-cleanup)
15. [Mobile Slice 1: Login → Home → Detail → Actions](#15-mobile-slice-1-login--home--detail--actions)
16. [Mobile Slice 1.1: Home real + Detail (read-only)](#16-mobile-slice-11-home-real--detail-read-only)
17. [Mobile: Create Match](#17-mobile-create-match)
18. [Mobile: Mejorar CreateMatch UX (pickers + formato)](#18-mobile-mejorar-creatematch-ux-pickers--formato)
19. [Mobile Slice 1.2: Acciones de participacion (confirm/decline/withdraw)](#19-mobile-slice-12-acciones-de-participacion-confirmdeclinewithdraw)
20. [Etapa 0 RNF: Observabilidad y contrato de errores](#20-etapa-0-rnf-observabilidad-y-contrato-de-errores)
21. [RNF Step 1: Seguridad minima + Anti-abuso (Rate Limiting + Helmet)](#21-rnf-step-1-seguridad-minima--anti-abuso-rate-limiting--helmet)
22. [Idempotency v2: TTL, Replay, Payload Reuse Detection, Cleanup](#22-idempotency-v2-ttl-replay-payload-reuse-detection-cleanup)

---

## 1. Bootstrap del monorepo

**Commit**: `7e8e381` — `chore: bootstrap monorepo (api+mobile+infra)`

### Que se hizo

Se creo la estructura base del monorepo con tres workspaces: `apps/api`, `apps/mobile` y `packages/shared`, orquestados por **pnpm workspaces** + **Turborepo**.

### Estructura resultante

```
fuchibol-app/
├── apps/
│   ├── api/          # NestJS backend
│   └── mobile/       # React Native (Expo)
├── packages/
│   └── shared/       # Enums y tipos compartidos
├── infra/            # Docker Compose para dev local
├── CLAUDE.md         # Reglas de desarrollo del proyecto
├── package.json      # Root workspace
├── pnpm-workspace.yaml
└── turbo.json
```

### Archivos clave

| Archivo | Rol |
|---|---|
| `pnpm-workspace.yaml` | Define workspaces: `apps/*`, `packages/*` |
| `turbo.json` | Orquesta tasks: `dev`, `build`, `lint`, `test` |
| `package.json` (root) | Package manager `pnpm@10.29.2`, devDeps: eslint, prettier, turbo, typescript |
| `CLAUDE.md` | Reglas de arquitectura, negocio, convenciones de codigo |

### Convenciones establecidas

- **Package manager**: pnpm con hoisting (`node-linker: hoisted`).
- **Build orchestration**: Turbo. `build` depende de `^build` (dependencias primero).
- **Lenguaje**: codigo en ingles, comentarios solo para decisiones importantes.
- **Commits**: prefijos `feat(api):`, `feat(mobile):`, `fix(core):`, `chore(infra):`, `test(core):`.

---

## 2. Infraestructura local (Docker)

**Parte de**: commit `7e8e381`

### Que se hizo

Se configuro Docker Compose para levantar PostgreSQL 16 y Redis 7 localmente.

### Archivo: `infra/docker-compose.yml`

```yaml
services:
  postgres:
    image: postgres:16
    container_name: fuchibol_db
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: app
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]

  redis:
    image: redis:7
    container_name: fuchibol_redis
    ports: ["6379:6379"]

volumes:
  pgdata:
```

### Como levantar

```bash
docker compose -f infra/docker-compose.yml up -d
```

### Decisiones

- PostgreSQL como fuente de verdad (CLAUDE.md principio #3).
- Redis reservado para presence y rate limiting (MVP). No se usa como message broker.
- Volumen persistente `pgdata` para no perder datos entre reinicios.

---

## 3. API: esqueleto NestJS + Prisma

**Parte de**: commit `7e8e381`

### Que se hizo

Se creo la app NestJS bajo `apps/api/` con:
- PrismaService singleton con adapter `@prisma/adapter-pg` para connection pooling.
- ConfigModule global para env vars.
- ValidationPipe global (whitelist, transform, 422 en errores).
- Dev auth middleware (inyecta user fake para desarrollo).
- Estructura de testing (unit + e2e).

### Stack del API

| Dependencia | Version | Rol |
|---|---|---|
| `@nestjs/common` | ^11.0.1 | Framework core |
| `@nestjs/config` | ^4.0.3 | Env vars |
| `@prisma/client` | ^7.0.0 | ORM |
| `@prisma/adapter-pg` | ^7.0.0 | Connection pooling |
| `pg` | ^8.13.1 | Driver PostgreSQL |
| `class-validator` | ^0.14.2 | Validacion de DTOs |
| `class-transformer` | ^0.5.1 | Transformacion de DTOs |
| `jest` | ^30.0.0 | Testing |
| `supertest` | ^7.1.0 | HTTP testing |

### Archivos principales

| Archivo | Rol |
|---|---|
| `src/main.ts` | Bootstrap: crea app, global prefix `api/v1`, ValidationPipe global |
| `src/app.module.ts` | Root module: ConfigModule (global), PrismaModule, feature modules |
| `src/infra/prisma/prisma.service.ts` | Singleton PrismaClient con lifecycle hooks |
| `src/infra/prisma/prisma.module.ts` | Exporta PrismaService como provider global |
| `src/infra/prisma/prisma-adapter.factory.ts` | Factory: crea PrismaClient con PgAdapter (pool de node-pg) |
| `src/infra/auth/dev-auth.middleware.ts` | Middleware dev: lee `x-dev-user-id` header, inyecta en `req.user` |
| `src/@types/express/index.d.ts` | Augmenta `Express.Request` con `user` tipado |

### PrismaService: patron de conexion

```typescript
// prisma-adapter.factory.ts
const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
```

- En dev usa `DATABASE_URL`, en test usa `DATABASE_URL_TEST`.
- `onModuleInit()` conecta, `onModuleDestroy()` desconecta pool + client.
- Se accede via `prismaService.client` (no directamente como PrismaClient).

### ValidationPipe global

```typescript
// main.ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,           // strip propiedades no declaradas
  transform: true,           // coerce types automaticamente
  forbidNonWhitelisted: true,// error si mandan props extras
  errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY, // 422
}));
```

### Variables de entorno

```bash
# .env.example
DATABASE_URL="postgresql://app:app@localhost:5432/app?schema=public"
SHADOW_DATABASE_URL="postgresql://app:app@localhost:5432/app_shadow?schema=public"
PORT=3000
NODE_ENV=development
TZ=UTC
```

### Scripts (apps/api/package.json)

```bash
pnpm start:dev      # nest start --watch
pnpm build          # nest build
pnpm lint           # eslint --fix
pnpm test           # jest (unit)
pnpm test:e2e       # prepare DB + jest e2e
pnpm db:migrate     # prisma migrate dev
pnpm db:generate    # prisma generate
pnpm db:seed        # prisma db seed
pnpm db:status      # prisma migrate status
```

### Infraestructura de tests

- **Unit tests**: regex `*.spec.ts`, directorio `src/`, runner Jest con ts-jest.
- **E2e tests**: directorio `test/`, regex `*.e2e-spec.ts`, config separada en `test/jest-e2e.json`.
- **Preparacion e2e** (`test/e2e-prepare-db.ts`): crea DB test si no existe, valida que el nombre contenga `_test`, ejecuta `prisma migrate reset`.
- **Setup e2e** (`test/jest.setup.ts`): carga `.env.test`, mapea `DATABASE_URL_TEST` a `DATABASE_URL`.

---

## 4. Mobile: esqueleto Expo

**Parte de**: commit `7e8e381`

### Que se hizo

Se creo la app React Native bajo `apps/mobile/` con Expo SDK 54.

### Stack

| Dependencia | Version |
|---|---|
| `expo` | ~54.0.21 |
| `react-native` | 0.81.5 |
| `react` | 19.1.0 |
| `typescript` | ~5.9.3 |

### Scripts

```bash
pnpm start     # expo start
pnpm android   # expo start --android
pnpm ios       # expo start --ios
pnpm web       # expo start --web
```

### Estado actual

Solo esqueleto con `App.tsx` basico. No hay pantallas implementadas. La convencion de CLAUDE.md indica:
- Estado preferido: server state (React Query) sobre estado global.
- Pantallas minimas primero (sin pixel-perfect).
- Manejar reconexion WS con resync de snapshots.

---

## 5. Shared: paquete compartido

**Parte de**: commit `7e8e381`

### Que se hizo

Se creo `packages/shared` con enums tipados para usar en API y mobile.

### Archivo: `packages/shared/src/index.ts`

```typescript
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
export type ParticipantStatus = (typeof ParticipantStatus)[keyof typeof ParticipantStatus];
```

### Patron

Se usan objetos `as const` + type derivado. Esto da autocompletado y validacion en tiempo de compilacion sin depender de enums de TypeScript (que tienen problemas con tree-shaking y ESM).

---

## 6. CI/CD: GitHub Actions

**Commits**: `aae4aa8`, `b68cb3a`, `1fe3c04`, `5e59485`

### Que se hizo

Se creo pipeline CI en `.github/workflows/ci.yml` que corre en push a `main` y en PRs.

### Pipeline

```
Trigger: push main | pull_request
Concurrency: cancela runs previos por branch

Services:
  - postgres:16 (health check: pg_isready)
  - redis:7 (health check: redis-cli ping)

Env:
  NODE_ENV=test
  DATABASE_URL=...app_test
  DATABASE_URL_TEST=...app_test
  SHADOW_DATABASE_URL=...app_shadow_test

Steps:
  1. checkout
  2. corepack enable (activa pnpm)
  3. setup-node@v4 (node 20 + cache pnpm)
  4. pnpm install --frozen-lockfile
  5. pnpm --filter api db:generate
  6. cp .env.example .env (si no existe)
  7. pnpm --filter api lint
  8. pnpm --filter api test
  9. pnpm --filter api test:e2e
  10. pnpm --filter api build
```

### Decisiones

- Timeout de 15 minutos.
- Postgres en CI usa `POSTGRES_DB: postgres` (no `app`) — las DBs test se crean por script.
- Concurrency con `cancel-in-progress: true` para no desperdiciar recursos.
- Redis habilitado pero no usado activamente todavia (preparado para presence/cache).

---

## 7. Slice: Matches API (create + get)

**Parte de**: commits `7e8e381` — `5e59485`

### Que se hizo

Primer feature completo end-to-end: crear y consultar partidos.

### Migracion inicial: `20250310120000_init`

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "MatchStatus" AS ENUM ('scheduled', 'locked', 'played', 'canceled');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Match" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'scheduled',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Match_capacity_check" CHECK ("capacity" > 0),
    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Match_createdById_idx" ON "Match"("createdById");
ALTER TABLE "Match" ADD CONSTRAINT "Match_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id");
```

### Migracion: `20260211182751_matches_api_init`

```sql
ALTER TABLE "Match" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;
```

Quita defaults auto-generados: el id UUID y updatedAt se manejan desde Prisma (`@default(uuid())` y `@updatedAt`).

### Estructura del modulo

```
src/matches/
├── matches.module.ts
├── api/
│   ├── matches.controller.ts      # POST /matches, GET /matches/:id
│   └── dto/
│       ├── create-match.dto.ts           # Input: title, startsAt, capacity
│       ├── create-match-response.dto.ts  # Output: id, revision, status
│       └── match-snapshot.dto.ts         # Output: match completo
└── application/
    ├── create-match.use-case.ts          # Logica de creacion
    ├── create-match.use-case.spec.ts     # Tests
    ├── get-match.use-case.ts             # Logica de consulta
    └── get-match.use-case.spec.ts        # Tests
```

### Endpoints

| Metodo | Ruta | Auth | Body | Respuesta |
|---|---|---|---|---|
| `POST` | `/api/v1/matches` | JWT | `{ title, startsAt, capacity }` | `{ id, revision, status }` |
| `GET` | `/api/v1/matches/:id` | Publico | — | `{ match: { ...snapshot } }` |

### Reglas de negocio (CreateMatchUseCase)

1. `capacity` debe ser > 0 (tambien validado por CHECK constraint en DB).
2. `startsAt` debe ser ISO date valido.
3. `startsAt` debe ser >= 1 minuto en el futuro.
4. Status inicial: `scheduled`.
5. Revision inicial: `1`.

### Validaciones DTO (class-validator)

```typescript
// create-match.dto.ts
@IsString() @IsNotEmpty() title: string;
@IsDateString() startsAt: string;
@Type(() => Number) @IsInt() @Min(1) capacity: number;
```

### Patron DDD pragmatico

- **Controller** (`api/`): recibe HTTP, valida DTO, delega a use-case.
- **Use-case** (`application/`): logica de negocio, interactua con Prisma.
- **Sin capa domain separada** para Match todavia — la entidad vive como Prisma model. Se extraera cuando la logica lo amerite.

### Tests unitarios

- `create-match.use-case.spec.ts`: valida que no se crea match con startsAt muy cercano, y que se crea correctamente con status `scheduled`.
- `get-match.use-case.spec.ts`: valida que devuelve match existente y tira `NotFoundException` si no existe.

### Seed: `prisma/seed.ts`

Crea usuarios de desarrollo para poder probar sin registrarse (ver seccion 8 para version actualizada).

---

## 8. Slice: Identity & Access (auth MVP)

**Fecha**: 2026-02-12

### Objetivo

Registro + login con JWT, actor inyectado en controllers, guards de roles, endpoint `/me`. Minimo usable sin refresh tokens, MFA ni social login.

### Migracion: `20260212053710_auth_user_fields`

Cambio destructivo (MVP, sin datos en produccion):

```sql
-- Nuevo enum de roles
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- Match: createdById pasa de TEXT a UUID
ALTER TABLE "Match" DROP CONSTRAINT "Match_createdById_fkey";
ALTER TABLE "Match" DROP COLUMN "createdById", ADD COLUMN "createdById" UUID NOT NULL;

-- User: se recrea con campos de auth
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
  ADD COLUMN "email" TEXT NOT NULL,
  ADD COLUMN "passwordHash" TEXT NOT NULL,
  ADD COLUMN "role" "Role" NOT NULL DEFAULT 'USER',
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL,
  DROP COLUMN "id",
  ADD COLUMN "id" UUID NOT NULL,
  ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "Match_createdById_idx" ON "Match"("createdById");

ALTER TABLE "Match" ADD CONSTRAINT "Match_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id");
```

### Cambios al schema Prisma

**Antes** (User minimo):
```prisma
model User {
  id        String   @id
  createdAt DateTime @default(now())
  matches   Match[]
}
```

**Despues** (User con auth):
```prisma
enum Role {
  USER
  ADMIN
}

model User {
  id           String   @id @default(uuid()) @db.Uuid
  email        String   @unique
  passwordHash String
  role         Role     @default(USER)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  matches      Match[]
}
```

Tambien se actualizo `Match.createdById` a `@db.Uuid` para coincidir con el nuevo tipo de User.id.

### Dependencias agregadas

| Paquete | Version | Rol |
|---|---|---|
| `@nestjs/jwt` | ^11.0.2 | Generacion y verificacion de JWT |
| `@nestjs/passport` | ^11.0.5 | Integracion Passport con NestJS |
| `passport` | ^0.7.0 | Framework de autenticacion |
| `passport-jwt` | ^4.0.1 | Estrategia JWT para Passport |
| `argon2` | ^0.44.0 | Hashing de passwords (mas seguro que bcrypt) |
| `@types/passport-jwt` | ^4.0.1 | Tipos TypeScript |

### Estructura del modulo

```
src/auth/
├── auth.module.ts                         # Modulo: imports JWT, Passport, providers
├── api/
│   ├── auth.controller.ts                 # POST register, POST login
│   ├── me.controller.ts                   # GET /me (controller separado, sin prefix)
│   └── dto/
│       ├── register.dto.ts                # email (lowercase+trim), password (min 8)
│       └── login.dto.ts                   # email (lowercase+trim), password
├── application/
│   ├── register.use-case.ts               # Registro: check email, hash, create, sign JWT
│   ├── register.use-case.spec.ts          # Tests: registro ok, email duplicado 409
│   ├── login.use-case.ts                  # Login: find user, verify hash, sign JWT
│   ├── login.use-case.spec.ts             # Tests: login ok, email invalido 401, password invalido 401
│   └── get-me.use-case.ts                 # Consulta: devuelve user sin passwordHash
├── guards/
│   ├── jwt-auth.guard.ts                  # AuthGuard('jwt')
│   └── roles.guard.ts                     # Valida @Roles() metadata
├── decorators/
│   ├── actor.decorator.ts                 # @Actor() -> ActorPayload desde req.user
│   └── roles.decorator.ts                 # @Roles('ADMIN', ...) metadata decorator
├── infra/
│   └── jwt.strategy.ts                    # Passport JWT strategy: Bearer token -> { userId, role }
└── interfaces/
    └── actor-payload.interface.ts          # { userId: string, role: string }
```

### Endpoints

| Metodo | Ruta | Auth | Body | Respuesta | Errores |
|---|---|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Publico | `{ email, password }` | `{ accessToken, user: { id, email, role } }` | 409 email duplicado, 422 validacion |
| `POST` | `/api/v1/auth/login` | Publico | `{ email, password }` | `{ accessToken, user: { id, email, role } }` | 401 credenciales invalidas, 422 validacion |
| `GET` | `/api/v1/me` | JWT | — | `{ id, email, role, createdAt }` | 401 sin token |

### Flujo JWT

```
1. Cliente envia POST /auth/register o /auth/login con email+password.
2. Backend valida, hashea (register) o verifica (login) con argon2.
3. Genera JWT con payload: { sub: userId, role: userRole }.
4. Cliente recibe accessToken.
5. En requests protegidos, cliente envia: Authorization: Bearer <token>.
6. JwtStrategy (Passport) extrae token, verifica firma, decodifica payload.
7. Retorna { userId, role } que NestJS setea en req.user.
8. El decorator @Actor() lo extrae tipado como ActorPayload.
```

### Configuracion JWT (auth.module.ts)

```typescript
JwtModule.registerAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    secret: config.getOrThrow<string>('JWT_SECRET'),
    signOptions: {
      expiresIn: config.get<StringValue>('JWT_EXPIRES_IN', '7d'),
    },
  }),
})
```

- `StringValue` importado de `ms` para tipar correctamente el `expiresIn`.
- `JWT_SECRET` es requerido (falla si no existe).
- `JWT_EXPIRES_IN` default `7d`.

### Guards y decorators

**JwtAuthGuard**: wrapper de `AuthGuard('jwt')`. Se aplica con `@UseGuards(JwtAuthGuard)`.

**RolesGuard**: lee metadata `@Roles(...)` del handler/class. Si no hay roles definidos, permite acceso. Si hay, verifica que `req.user.role` este en la lista.

**Uso combinado**:
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Get('admin-only')
adminEndpoint(@Actor() actor: ActorPayload) { ... }
```

**@Actor() decorator**: extrae `req.user` tipado como `ActorPayload { userId, role }`.

### Seguridad

- Passwords hasheados con **argon2** (resistente a GPU attacks, ganador PHC).
- Email normalizado: `toLowerCase().trim()` via `@Transform` en DTOs.
- `passwordHash` nunca se devuelve (use-cases hacen `select` explicito sin el campo).
- Errores genericos en login: "Invalid credentials" (no revela si el email existe).

### Variables de entorno nuevas

```bash
JWT_SECRET="dev-secret-change-in-production"   # Requerido
JWT_EXPIRES_IN="7d"                             # Opcional, default "7d"
```

Agregadas a `.env` y `.env.example`.

### Cambios a archivos existentes

| Archivo | Cambio |
|---|---|
| `src/main.ts` | Agregado `app.setGlobalPrefix('api/v1')` — todos los endpoints ahora bajo `/api/v1/` |
| `src/app.module.ts` | Agregado `AuthModule` a imports. `DevAuthMiddleware` solo en `NODE_ENV !== 'production'` |
| `src/@types/express/index.d.ts` | `req.user` cambia de `{ id }` a `{ userId, role }` |
| `src/infra/auth/dev-auth.middleware.ts` | Skip si hay header `Authorization`. Ya no asigna user por default. Usa nuevo shape `{ userId, role }` |
| `src/matches/api/matches.controller.ts` | `POST /matches` ahora protegido con `@UseGuards(JwtAuthGuard)`. Usa `@Actor()` en vez de `req.user?.id` |
| `src/matches/application/create-match.use-case.ts` | Removido `user.upsert` — los usuarios se crean via register, no auto-creados al crear match |
| `src/matches/application/create-match.use-case.spec.ts` | Actualizado: sin mock de `user.upsert` |
| `prisma/seed.ts` | Crea dos users con argon2: `dev@fuchibol.local` (USER) y `admin@fuchibol.local` (ADMIN), password: `password123` |
| `package.json` (root) | Agregado `pnpm.onlyBuiltDependencies: ["argon2"]` para permitir build nativo |

### Prefijo global `/api/v1`

A partir de este slice, todos los endpoints del API estan bajo `/api/v1/`:
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/me`
- `POST /api/v1/matches`
- `GET /api/v1/matches/:id`

Esto se configuro en `main.ts` con `app.setGlobalPrefix('api/v1')`.

### Tests agregados

| Test | Que valida |
|---|---|
| `register.use-case.spec.ts` — "registers a new user and returns token" | Registro exitoso devuelve `{ accessToken, user }` |
| `register.use-case.spec.ts` — "throws 409 when email already exists" | Email duplicado lanza `ConflictException` |
| `login.use-case.spec.ts` — "returns token on valid credentials" | Login exitoso devuelve token |
| `login.use-case.spec.ts` — "throws 401 on unknown email" | Email inexistente lanza `UnauthorizedException` |
| `login.use-case.spec.ts` — "throws 401 on wrong password" | Password incorrecto lanza `UnauthorizedException` |

### Ejemplos curl

```bash
# Registrar usuario
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"password123"}'

# Obtener usuario actual (reemplazar <TOKEN>)
curl http://localhost:3000/api/v1/me \
  -H 'Authorization: Bearer <TOKEN>'

# Sin token -> 401
curl http://localhost:3000/api/v1/me

# Crear match (requiere JWT)
curl -X POST http://localhost:3000/api/v1/matches \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <TOKEN>' \
  -d '{"title":"Futbol 5","startsAt":"2026-12-01T18:00:00Z","capacity":10}'
```

---

## 9. Slice: Match Participation

**Fecha**: 2026-02-12

### Objetivo

Permitir que usuarios se confirmen en un match, queden en waitlist si no hay cupo, se retiren liberando cupo con promocion FIFO automatica, y que admins puedan invitar. Todo con idempotencia obligatoria y optimistic locking.

### Migracion: `20260212_match_participation`

```sql
-- Enum para estados de participacion
CREATE TYPE "MatchParticipantStatus" AS ENUM (
  'INVITED', 'CONFIRMED', 'WAITLISTED', 'DECLINED', 'WITHDRAWN'
);

-- Tabla de participantes
CREATE TABLE "MatchParticipant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "matchId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "MatchParticipantStatus" NOT NULL,
    "waitlistPosition" INTEGER,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MatchParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MatchParticipant_matchId_userId_key"
  ON "MatchParticipant"("matchId", "userId");
CREATE INDEX "MatchParticipant_matchId_status_idx"
  ON "MatchParticipant"("matchId", "status");
CREATE INDEX "MatchParticipant_matchId_waitlistPosition_idx"
  ON "MatchParticipant"("matchId", "waitlistPosition");

ALTER TABLE "MatchParticipant" ADD CONSTRAINT "MatchParticipant_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE;
ALTER TABLE "MatchParticipant" ADD CONSTRAINT "MatchParticipant_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id");

-- Tabla de idempotencia
CREATE TABLE "IdempotencyRecord" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "actorId" UUID NOT NULL,
    "route" TEXT NOT NULL,
    "matchId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "responseJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdempotencyRecord_key_actorId_route_matchId_key"
  ON "IdempotencyRecord"("key", "actorId", "route", "matchId");
CREATE INDEX "IdempotencyRecord_createdAt_idx"
  ON "IdempotencyRecord"("createdAt");
```

### Modelos Prisma agregados

```prisma
enum MatchParticipantStatus {
  INVITED
  CONFIRMED
  WAITLISTED
  DECLINED
  WITHDRAWN
}

model MatchParticipant {
  id               String                 @id @default(uuid()) @db.Uuid
  matchId          String                 @db.Uuid
  userId           String                 @db.Uuid
  status           MatchParticipantStatus
  waitlistPosition Int?
  confirmedAt      DateTime?
  createdAt        DateTime               @default(now())
  updatedAt        DateTime               @updatedAt
  match            Match @relation(...)
  user             User  @relation(...)
  @@unique([matchId, userId])
  @@index([matchId, status])
  @@index([matchId, waitlistPosition])
}

model IdempotencyRecord {
  id           String   @id @default(uuid()) @db.Uuid
  key          String
  actorId      String   @db.Uuid
  route        String
  matchId      String   @db.Uuid
  status       String   @default("completed")
  responseJson Json
  createdAt    DateTime @default(now())
  @@unique([key, actorId, route, matchId])
  @@index([createdAt])
}
```

### Estructura de archivos

```
src/common/
└── idempotency/
    ├── idempotency.module.ts     # Modulo NestJS
    └── idempotency.service.ts    # Servicio reutilizable de idempotencia

src/matches/
├── application/
│   ├── build-match-snapshot.ts           # Builder compartido para snapshot enriquecido
│   ├── confirm-participation.use-case.ts # Confirmar participacion
│   ├── decline-participation.use-case.ts # Declinar participacion
│   ├── withdraw-participation.use-case.ts# Retirarse (libera cupo + promueve FIFO)
│   ├── invite-participation.use-case.ts  # Invitar (solo admin del match)
│   └── participation.use-case.spec.ts    # Tests de participacion
├── api/
│   └── dto/
│       └── participation-command.dto.ts  # DTOs: expectedRevision, userId (invite)
└── matches.module.ts                     # Actualizado con nuevos providers
```

### Endpoints

| Metodo | Ruta | Auth | Headers | Body | Respuesta |
|---|---|---|---|---|---|
| `POST` | `/api/v1/matches/:id/confirm` | JWT | `Idempotency-Key` | `{ expectedRevision }` | MatchSnapshot |
| `POST` | `/api/v1/matches/:id/decline` | JWT | `Idempotency-Key` | `{ expectedRevision }` | MatchSnapshot |
| `POST` | `/api/v1/matches/:id/withdraw` | JWT | `Idempotency-Key` | `{ expectedRevision }` | MatchSnapshot |
| `POST` | `/api/v1/matches/:id/invite` | JWT (admin) | `Idempotency-Key` | `{ expectedRevision, userId }` | MatchSnapshot |
| `GET` | `/api/v1/matches/:id` | JWT | — | — | `{ match: MatchSnapshot }` (actualizado) |

### MatchSnapshot (respuesta enriquecida)

```typescript
{
  id, title, startsAt, capacity, status, revision, createdById,
  confirmedCount: number,
  participants: [{ userId, status, waitlistPosition }],  // sin WITHDRAWN
  waitlist: [{ userId, status, waitlistPosition }],       // ordenado FIFO
  myStatus: string | null,        // status del actor actual
  actionsAllowed: string[],       // ['confirm', 'decline', 'withdraw', 'invite']
  createdAt, updatedAt
}
```

### Reglas de negocio implementadas

**Confirm**:
- Si hay cupo (`confirmedCount < capacity`) -> CONFIRMED con `confirmedAt`.
- Si no hay cupo -> WAITLISTED con `waitlistPosition` incremental.
- Si ya CONFIRMED o WAITLISTED -> idempotente (no cambia, devuelve snapshot).
- Si DECLINED/WITHDRAWN -> permite reingresar como nuevo confirm.

**Decline**:
- INVITED -> DECLINED.
- WAITLISTED -> DECLINED (sale de waitlist).
- CONFIRMED -> 409 "Cannot decline while confirmed. Use withdraw first."
- Ya DECLINED -> idempotente.

**Withdraw**:
- CONFIRMED -> WITHDRAWN + libera cupo.
- Si habia WAITLISTED -> promueve al primero (MIN `waitlistPosition`) a CONFIRMED.
- WAITLISTED -> WITHDRAWN (sale de waitlist).
- INVITED/DECLINED/WITHDRAWN -> idempotente.

**Invite**:
- Solo `match.createdById` puede invitar (403 si no es admin).
- Si el usuario ya tiene cualquier status -> idempotente.
- Si no existia -> crea con status INVITED.

### Concurrencia y consistencia

**Optimistic locking**: cada comando recibe `expectedRevision` en el body. Al inicio de la transaccion se verifica que `match.revision === expectedRevision`. Si no coincide -> 409 REVISION_CONFLICT.

**Transacciones**: todas las mutaciones de participacion ocurren dentro de `prisma.$transaction()`. Dentro de la tx:
1. Leer match y verificar revision.
2. Leer/crear/actualizar participant.
3. Si withdraw de confirmed: buscar primer WAITLISTED y promover.
4. Incrementar `match.revision`.
5. Construir y retornar snapshot.

**Waitlist FIFO**: usa `waitlistPosition` incremental. Los huecos se mantienen (no se compactan) para minimizar writes. La promocion busca `MIN(waitlistPosition)` entre los WAITLISTED. El snapshot muestra posiciones normalizadas (1, 2, 3...).

### Idempotencia

**Servicio**: `IdempotencyService` en `src/common/idempotency/`.

**Mecanismo**:
1. Antes de ejecutar, busca `IdempotencyRecord` por `(key, actorId, route, matchId)`.
2. Si existe -> devuelve `responseJson` cacheado sin ejecutar logica.
3. Si no existe -> ejecuta logica, guarda respuesta en `IdempotencyRecord`, retorna.

**Header**: `Idempotency-Key` requerido en todos los comandos de participacion. Si falta -> 422.

### Cambios a archivos existentes

| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` | +MatchParticipant, +IdempotencyRecord, +MatchParticipantStatus enum. User y Match con relacion `participants` |
| `src/matches/matches.module.ts` | +IdempotencyModule import, +4 participation use-cases como providers |
| `src/matches/api/matches.controller.ts` | +4 endpoints (confirm/decline/withdraw/invite), GET `:id` ahora JWT y pasa actorId al snapshot |
| `src/matches/api/dto/match-snapshot.dto.ts` | Usa `MatchSnapshot` de `build-match-snapshot.ts` |
| `src/matches/application/get-match.use-case.ts` | Usa `buildMatchSnapshot`, acepta `actorId` opcional |
| `src/matches/application/get-match.use-case.spec.ts` | Actualizado para nueva interfaz con participants |

### Tests agregados

| Test | Que valida |
|---|---|
| "confirms with capacity -> CONFIRMED" | Confirm crea participant CONFIRMED cuando hay cupo |
| "confirms when full -> WAITLISTED" | Confirm crea WAITLISTED cuando capacity lleno |
| "rejects wrong expectedRevision -> 409" | Optimistic locking funciona |
| "idempotent: same key returns cached response" | Idempotencia: misma key devuelve respuesta cacheada sin re-ejecutar |
| "withdraw CONFIRMED promotes first WAITLISTED" | Withdraw de confirmado promueve primer waitlisted a CONFIRMED |

### Ejemplos curl

```bash
# Confirmar participacion (requiere Idempotency-Key)
curl -X POST http://localhost:3000/api/v1/matches/<MATCH_ID>/confirm \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <TOKEN>' \
  -H 'Idempotency-Key: <UUID>' \
  -d '{"expectedRevision": 1}'

# Declinar
curl -X POST http://localhost:3000/api/v1/matches/<MATCH_ID>/decline \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <TOKEN>' \
  -H 'Idempotency-Key: <UUID>' \
  -d '{"expectedRevision": 1}'

# Retirarse (libera cupo, promueve waitlist)
curl -X POST http://localhost:3000/api/v1/matches/<MATCH_ID>/withdraw \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <TOKEN>' \
  -H 'Idempotency-Key: <UUID>' \
  -d '{"expectedRevision": 2}'

# Invitar (solo admin del match)
curl -X POST http://localhost:3000/api/v1/matches/<MATCH_ID>/invite \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <TOKEN>' \
  -H 'Idempotency-Key: <UUID>' \
  -d '{"expectedRevision": 1, "userId": "<TARGET_USER_UUID>"}'

# Ver match con snapshot enriquecido
curl http://localhost:3000/api/v1/matches/<MATCH_ID> \
  -H 'Authorization: Bearer <TOKEN>'
```

---

## Resumen de estado actual

### Que esta implementado

- Monorepo pnpm + Turbo con 3 workspaces
- Docker Compose: PostgreSQL 16 + Redis 7
- API NestJS con DDD pragmatico (api/application layers)
- Prisma ORM con adapter PG y migrations
- Autenticacion JWT completa (register, login, me)
- Guards (JWT + Roles) y decorators (@Actor, @Roles)
- Validaciones con class-validator (422 en errores)
- Hash de passwords con argon2
- Prefijo global `/api/v1`
- CI/CD con GitHub Actions (lint, test, e2e, build)
- Match participation completo (confirm/decline/withdraw/invite)
- Waitlist FIFO con promocion automatica
- Optimistic locking con revision en todos los comandos
- Idempotencia obligatoria con tabla IdempotencyRecord
- Snapshot enriquecido (participants, confirmedCount, myStatus, actionsAllowed)
- 40 unit tests pasando
- Paquete shared con enums tipados
- Esqueleto mobile Expo
- Mobile Slice 1: Login → Home → Match Detail → Actions (confirm/decline/withdraw)
- React Query + React Navigation + expo-secure-store + expo-crypto
- Rate limiting (Redis + in-memory fallback) con 3 perfiles (login/mutations/reads)
- Helmet + CORS por ambiente + body size limit
- Error envelope consistente (RATE_LIMITED, REVISION_CONFLICT, etc.)

### Que falta (roadmap segun CLAUDE.md)

- Abandono (withdraw <1h antes del inicio)
- Baja de cupo (ultimos confirmados a waitlist)
- WebSocket (realtime best-effort)
- Chat con dedupe (`clientMsgId`)
- Grupos
- Notificaciones
- Mobile: crear match, admin actions (update/lock/unlock/invite)

---

## 10. Slice: Match Updates + Lock/Unlock + Reconfirmacion

**Fecha**: 2026-02-12

### Objetivo

Cerrar el contrato del core: actualizar matches con optimistic locking, detectar "cambios mayores" que fuerzan reconfirmacion, y permitir lock/unlock de matches que bloquea acciones de participacion.

### Migracion: `20260212182619_match_updates_lock`

```sql
ALTER TABLE "Match" ADD COLUMN "isLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "location" TEXT,
ADD COLUMN "lockedAt" TIMESTAMP(3),
ADD COLUMN "lockedBy" UUID;
```

Campos agregados al modelo Match:
- `location` (String?) — ubicacion/cancha del partido.
- `isLocked` (Boolean, default false) — si el match esta bloqueado.
- `lockedAt` (DateTime?) — cuando se bloqueo.
- `lockedBy` (String? UUID) — userId del admin que lo bloqueo.

### Archivos creados

| Archivo | Rol |
|---|---|
| `src/matches/application/update-match.use-case.ts` | PATCH match con optimistic locking, cambios mayores, reconfirmacion |
| `src/matches/application/lock-match.use-case.ts` | Lock match (admin, idempotente por estado) |
| `src/matches/application/unlock-match.use-case.ts` | Unlock match (admin, idempotente por estado) |
| `src/matches/api/dto/update-match.dto.ts` | DTO para PATCH: title?, startsAt?, location?, capacity?, expectedRevision |
| `src/matches/application/update-lock.use-case.spec.ts` | 14 unit tests para update/lock/unlock |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` | +location, +isLocked, +lockedAt, +lockedBy en Match |
| `src/matches/matches.module.ts` | +UpdateMatchUseCase, +LockMatchUseCase, +UnlockMatchUseCase como providers |
| `src/matches/api/matches.controller.ts` | +PATCH `:id`, +POST `:id/lock`, +POST `:id/unlock` |
| `src/matches/application/build-match-snapshot.ts` | Snapshot incluye location, isLocked, lockedAt, lockedBy. actionsAllowed considera lock state |
| `src/matches/application/confirm-participation.use-case.ts` | +check `isLocked` -> 409 MATCH_LOCKED |
| `src/matches/application/decline-participation.use-case.ts` | +check `isLocked` -> 409 MATCH_LOCKED |
| `src/matches/application/invite-participation.use-case.ts` | +check `isLocked` -> 409 MATCH_LOCKED |
| `src/matches/application/get-match.use-case.spec.ts` | mockMatch actualizado con nuevos campos |
| `src/matches/application/participation.use-case.spec.ts` | mockMatch actualizado con nuevos campos |

### Endpoints nuevos

| Metodo | Ruta | Auth | Body | Respuesta | Errores |
|---|---|---|---|---|---|
| `PATCH` | `/api/v1/matches/:id` | JWT (admin) | `{ expectedRevision, title?, startsAt?, location?, capacity? }` | MatchSnapshot | 403 no admin, 409 revision/capacity |
| `POST` | `/api/v1/matches/:id/lock` | JWT (admin) | `{ expectedRevision }` | MatchSnapshot | 403 no admin, 409 revision |
| `POST` | `/api/v1/matches/:id/unlock` | JWT (admin) | `{ expectedRevision }` | MatchSnapshot | 403 no admin, 409 revision |

### Reglas de negocio implementadas

**PATCH match (UpdateMatchUseCase)**:
- Solo `match.createdById` puede actualizar (403).
- Optimistic locking: `expectedRevision` debe coincidir (409 REVISION_CONFLICT).
- "Cambio mayor" = cambio en `startsAt`, `location`, o `capacity`:
  - Participantes CONFIRMED -> INVITED (fuerza reconfirmacion).
  - WAITLISTED se mantiene WAITLISTED.
  - INVITED, DECLINED, WITHDRAWN no cambian.
- Capacity no puede bajar debajo de `confirmedCount` actual (409 CAPACITY_BELOW_CONFIRMED).
- Si capacity sube (sin ser cambio mayor): promueve waitlist FIFO hasta llenar cupo.
- Cambio solo de `title` no es mayor (no fuerza reconfirmacion).
- `revision` se incrementa en cada update real.

**Lock (LockMatchUseCase)**:
- Solo admin puede lock (403).
- Requiere `expectedRevision` (409 REVISION_CONFLICT).
- Si ya locked -> idempotente (no cambia nada, devuelve snapshot).
- Setea `isLocked=true`, `lockedAt=now()`, `lockedBy=actorId`, `revision++`.

**Unlock (UnlockMatchUseCase)**:
- Solo admin puede unlock (403).
- Requiere `expectedRevision` (409 REVISION_CONFLICT).
- Si ya unlocked -> idempotente.
- Setea `isLocked=false`, `lockedAt=null`, `lockedBy=null`, `revision++`.

**Bloqueo de participacion cuando locked**:
- `confirm` -> 409 MATCH_LOCKED.
- `decline` -> 409 MATCH_LOCKED.
- `invite` -> 409 MATCH_LOCKED.
- `withdraw` -> permitido (un jugador siempre puede bajarse).

**Snapshot actualizado**:
- Incluye `location`, `isLocked`, `lockedAt`, `lockedBy`.
- `actionsAllowed` para admin incluye `update`, `lock`/`unlock`.
- Cuando locked: no muestra `confirm`, `decline`, `invite` en actionsAllowed (excepto `withdraw`).

### Tests agregados (14 nuevos, 29 total)

| Test | Que valida |
|---|---|
| "rejects wrong expectedRevision -> 409" | Optimistic locking en PATCH |
| "rejects non-admin -> 403" | Solo admin puede actualizar |
| "major change (startsAt) resets CONFIRMED -> INVITED" | Reconfirmacion por cambio de fecha |
| "major change (location) resets CONFIRMED -> INVITED" | Reconfirmacion por cambio de ubicacion |
| "capacity below confirmedCount -> 409" | No permite bajar capacity si hay mas confirmados |
| "title-only change does NOT reset participants" | Cambio menor no fuerza reconfirmacion |
| "increments revision on real update" | Revision se incrementa |
| "locks match and increments revision" | Lock funciona correctamente |
| "already locked -> idempotent (no update)" | Lock idempotente |
| "lock rejects wrong expectedRevision -> 409" | Optimistic locking en lock |
| "lock rejects non-admin -> 403" | Solo admin puede lock |
| "unlocks match and increments revision" | Unlock funciona correctamente |
| "already unlocked -> idempotent (no update)" | Unlock idempotente |
| "confirm on locked match -> 409 MATCH_LOCKED" | Lock bloquea confirm |

### Ejemplos curl

```bash
# PATCH match con expectedRevision (cambio mayor: fuerza reconfirmacion)
curl -X PATCH http://localhost:3000/api/v1/matches/<MATCH_ID> \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <TOKEN>' \
  -d '{"expectedRevision": 1, "startsAt": "2026-12-01T20:00:00Z", "location": "Cancha Sur"}'

# PATCH match (cambio menor: solo titulo)
curl -X PATCH http://localhost:3000/api/v1/matches/<MATCH_ID> \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <TOKEN>' \
  -d '{"expectedRevision": 2, "title": "Futbol 5 - Viernes"}'

# Lock match
curl -X POST http://localhost:3000/api/v1/matches/<MATCH_ID>/lock \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <TOKEN>' \
  -d '{"expectedRevision": 3}'

# Confirm falla por locked -> 409 MATCH_LOCKED
curl -X POST http://localhost:3000/api/v1/matches/<MATCH_ID>/confirm \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <TOKEN>' \
  -H 'Idempotency-Key: some-uuid' \
  -d '{"expectedRevision": 4}'

# Unlock match
curl -X POST http://localhost:3000/api/v1/matches/<MATCH_ID>/unlock \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <TOKEN>' \
  -d '{"expectedRevision": 4}'

# Confirm ahora funciona
curl -X POST http://localhost:3000/api/v1/matches/<MATCH_ID>/confirm \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <TOKEN>' \
  -H 'Idempotency-Key: another-uuid' \
  -d '{"expectedRevision": 5}'
```

---

## 11. Read Model: Home (List Matches)

**Fecha**: 2026-02-12

### Objetivo

Endpoint de lectura paginado para la pantalla home del mobile: lista de matches del actor con confirmedCount y myStatus, sin N+1.

### Migracion: `20260212201252_list_matches_indexes`

```sql
CREATE INDEX "Match_startsAt_idx" ON "Match"("startsAt");
CREATE INDEX "MatchParticipant_userId_idx" ON "MatchParticipant"("userId");
```

Indices para:
- Ordenar/filtrar matches por `startsAt` eficientemente.
- Buscar participaciones por `userId` para scope=mine.

### Archivos creados

| Archivo | Rol |
|---|---|
| `src/matches/application/list-matches.query.ts` | Query handler: paginacion, filtros, scope=mine, confirmedCount, myStatus |
| `src/matches/application/list-matches.query.spec.ts` | 7 unit tests |
| `src/matches/api/dto/list-matches-query.dto.ts` | DTO: page, pageSize, from, to (class-validator) |
| `prisma/migrations/20260212201252_list_matches_indexes/migration.sql` | Indices para startsAt y userId |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` | +`@@index([startsAt])` en Match, +`@@index([userId])` en MatchParticipant |
| `src/matches/matches.module.ts` | +ListMatchesQuery como provider |
| `src/matches/api/matches.controller.ts` | +`GET /matches` con query params (antes del `:id` route) |

### Endpoint

| Metodo | Ruta | Auth | Query params | Respuesta |
|---|---|---|---|---|
| `GET` | `/api/v1/matches` | JWT | `page`, `pageSize`, `from`, `to` | `{ items: MatchHomeItem[], pageInfo }` |

### Query params

| Param | Tipo | Default | Validacion |
|---|---|---|---|
| `page` | int | 1 | min 1 |
| `pageSize` | int | 20 | min 1, max 50 |
| `from` | ISO date | — | opcional |
| `to` | ISO date | — | opcional |

### Respuesta: MatchHomeItem

```typescript
{
  id: string;
  title: string;
  startsAt: Date;
  location: string | null;
  capacity: number;
  status: string;
  revision: number;
  isLocked: boolean;
  lockedAt: Date | null;
  confirmedCount: number;    // count agregado, no lista de participants
  myStatus: string | null;   // status del actor en este match
  isMatchAdmin: boolean;     // match.createdById === actorId
  updatedAt: Date;
}
```

### Respuesta: pageInfo

```typescript
{
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}
```

### Scope: mine (default y unico)

Solo devuelve matches donde:
- El actor es creador (`match.createdById === actorId`), O
- El actor tiene participacion (cualquier status en MatchParticipant).

No existe `scope=all` por ahora. No hay grupos implementados.

### Orden

Por `startsAt asc` (proximos primero).

### Performance: evitando N+1

Estrategia en 3 queries (no N+1):

1. **Count** total con filtros (1 query).
2. **Fetch** matches paginados con `select` minimal (1 query).
3. **Batch** confirmedCount via `groupBy` sobre `matchParticipant` donde `status=CONFIRMED` y `matchId IN (ids)` (1 query).
4. **Batch** myStatus via `findMany` sobre `matchParticipant` donde `userId=actorId` y `matchId IN (ids)` (1 query).
5. **Merge** en memoria (O(n) con Maps).

Total: **4 queries fijas** independientemente de cuantos matches haya en la pagina.

### Tests agregados (7 nuevos, 36 total)

| Test | Que valida |
|---|---|
| "returns empty items and correct pageInfo when no matches" | Lista vacia devuelve pageInfo correcto |
| "returns items with confirmedCount and myStatus" | confirmedCount y myStatus computados correctamente |
| "scope=mine: where clause filters by actor participation or ownership" | Filtro OR por createdById y participants |
| "pagination: totalPages and hasNextPage computed correctly" | Paginacion con 25 items y pageSize=10 |
| "pagination: page 2 has hasPrevPage=true" | hasPrevPage funciona |
| "date filters are applied to where clause" | from/to generan filtros startsAt.gte/lte |
| "myStatus is null when actor has no participation" | Sin participacion, myStatus es null |

### Ejemplos curl

```bash
# Listar mis matches (default: page=1, pageSize=20)
curl http://localhost:3000/api/v1/matches \
  -H 'Authorization: Bearer <TOKEN>'

# Listar con paginacion
curl 'http://localhost:3000/api/v1/matches?page=2&pageSize=10' \
  -H 'Authorization: Bearer <TOKEN>'

# Filtrar por rango de fechas
curl 'http://localhost:3000/api/v1/matches?from=2026-06-01T00:00:00Z&to=2026-06-30T23:59:59Z' \
  -H 'Authorization: Bearer <TOKEN>'

# Combinar filtros
curl 'http://localhost:3000/api/v1/matches?page=1&pageSize=5&from=2026-06-01T00:00:00Z' \
  -H 'Authorization: Bearer <TOKEN>'
```

---

## 12. Health Endpoint + CORS + LAN Bind

**Fecha**: 2026-02-12

### Objetivo

Endpoint de health publico para verificar que el API esta vivo, habilitar CORS para Expo dev, y bindear a `0.0.0.0` para acceso desde iPhone por LAN.

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/main.ts` | +`app.enableCors(...)`, bind a `HOST` env var (default `0.0.0.0`) |
| `src/app.controller.ts` | Reemplaza `getHello()` por `GET /health` con respuesta JSON |
| `src/app.controller.spec.ts` | Test actualizado para health endpoint |
| `src/app.module.ts` | Removido `AppService` de providers (ya no se usa) |

### Archivos eliminados

| Archivo | Razon |
|---|---|
| `src/app.service.ts` | Ya no se usa; health es inline en el controller |

### Endpoint

| Metodo | Ruta | Auth | Respuesta |
|---|---|---|---|
| `GET` | `/api/v1/health` | Publico | `{ status: "ok", service: "app-fuchibol-api", time: "<ISO8601>", version: "0.0.1" }` |

### CORS

Configurado en `main.ts`:
- `origin: true` — reflect (acepta cualquier origin, ideal para dev con Expo).
- `methods`: GET, POST, PATCH, PUT, DELETE, OPTIONS.
- `allowedHeaders`: Content-Type, Authorization, Idempotency-Key, If-Match.
- `credentials: true`.

### Bind host

`app.listen(port, host)` donde `host` viene de `process.env.HOST` (default `0.0.0.0`). Esto permite acceso desde dispositivos en la misma red local.

### Variables de entorno nuevas (opcionales)

```bash
HOST="0.0.0.0"   # Default: 0.0.0.0 (accesible por LAN)
PORT=3000         # Default: 3000
```

### Tests

| Test | Que valida |
|---|---|
| "should return status ok" | Health devuelve `{ status: "ok", service, time }` |

### Ejemplos curl

```bash
# Desde localhost
curl http://localhost:3000/api/v1/health

# Desde iPhone (reemplazar con IP local de la Mac)
curl http://192.168.x.x:3000/api/v1/health
```

---

## 13. Mobile: Smoke Test de Conectividad

**Fecha**: 2026-02-12

### Objetivo

Preparar el proyecto Expo para testear conectividad contra el backend local por LAN. Sin pantallas, sin navegacion, solo smoke test del health endpoint.

### Archivos creados

| Archivo | Rol |
|---|---|
| `apps/mobile/.env.example` | Ejemplo de configuracion con `EXPO_PUBLIC_API_BASE_URL` |
| `apps/mobile/.env` | Env local (gitignored) con IP LAN |
| `apps/mobile/src/config/env.ts` | Exporta `apiBaseUrl` validado (throw si falta) |
| `apps/mobile/src/lib/api.ts` | `fetchJson()` generico con timeout 12s |
| `apps/mobile/src/features/health/healthClient.ts` | `getHealth()` llama `/api/v1/health` |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `apps/mobile/App.tsx` | Smoke test: ejecuta health check en useEffect, muestra resultado |
| `apps/mobile/.gitignore` | Agrega `.env` a ignorados |

### Estructura

```
apps/mobile/
├── .env                  # EXPO_PUBLIC_API_BASE_URL (gitignored)
├── .env.example          # Template para otros devs
├── App.tsx               # Smoke test UI minima
└── src/
    ├── config/
    │   └── env.ts        # apiBaseUrl validado
    ├── lib/
    │   └── api.ts        # fetchJson() con timeout
    └── features/
        └── health/
            └── healthClient.ts  # getHealth()
```

### Configuracion de env

```bash
# Obtener IP LAN de la Mac
ipconfig getifaddr en0

# Crear .env en apps/mobile/
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:3000
```

iPhone NO puede usar `localhost` — debe usar la IP LAN de la Mac.

### Como correr

```bash
# Terminal 1: backend
cd apps/api && pnpm start:dev

# Terminal 2: mobile
cd apps/mobile && npx expo start
```

Escanear el QR con Expo Go en el iPhone.

### Que deberia verse en logs

```
[smoke] API base URL: http://192.168.x.x:3000
[smoke] Health OK: {"status":"ok","service":"app-fuchibol-api","time":"2026-...","version":"0.0.1"}
```

Si falla:
```
[smoke] Health FAILED: http://192.168.x.x:3000 Error: Request timed out after 12000ms...
```

---

## 14. Monorepo pnpm Workspaces (cleanup)

**Fecha**: 2026-02-12

### Objetivo

Configurar pnpm workspaces reales para que `pnpm install` desde root gestione todas las deps, Expo bundle correctamente en monorepo, y no queden `node_modules` duplicados.

### Problema previo

- No existia `pnpm-workspace.yaml` — cada app instalaba deps por separado.
- No existia `.npmrc` — pnpm usaba `node-linker=isolated` (incompatible con Metro/Expo).
- `node_modules` duplicados en root y `apps/api`.
- Expo fallaba resolviendo `react-native-web` y otros modulos.

### Archivos creados

| Archivo | Rol |
|---|---|
| `pnpm-workspace.yaml` | Define workspaces: `apps/*` |
| `.npmrc` | `node-linker=hoisted` para compatibilidad Metro/Expo |
| `apps/mobile/metro.config.js` | Config Metro para monorepo: watchFolders + nodeModulesPaths |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `package.json` (root) | `private: true`, scripts `dev:api`, `dev:mobile`, `test`, `lint`. Ampliado `onlyBuiltDependencies` con prisma, nestjs/core, unrs-resolver |
| `apps/mobile/package.json` | +`react-dom`, +`react-native-web` (deps necesarias para Expo monorepo) |
| `pnpm-lock.yaml` | Regenerado con workspaces + hoisted |

### Archivos eliminados

- `apps/api/node_modules/` (duplicado; ahora hoisted en root)

### Configuracion clave

**pnpm-workspace.yaml**:
```yaml
packages:
  - "apps/*"
```

**.npmrc**:
```
node-linker=hoisted
```

**metro.config.js** (apps/mobile):
```js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const config = getDefaultConfig(projectRoot);
config.watchFolders = [...(config.watchFolders ?? []), workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
module.exports = config;
```

### Scripts root

| Script | Comando |
|---|---|
| `pnpm dev:api` | `pnpm --filter api start:dev` |
| `pnpm dev:mobile` | `pnpm --filter mobile start -- --clear` |
| `pnpm test` | `pnpm --filter api test` |
| `pnpm test:e2e` | `pnpm --filter api test:e2e` |
| `pnpm lint` | `pnpm --filter api lint` |

### Verificaciones

- `pnpm install` desde root: instala todo (1 sola invocacion).
- `pnpm test`: 36 tests pasando.
- `expo doctor`: 17/17 checks passed.
- `expo export --platform ios`: bundle exitoso (575 modules).

### Como usar

```bash
# Instalar deps (solo desde root, una vez)
pnpm install

# Levantar API
pnpm dev:api

# Levantar Mobile (Expo)
pnpm dev:mobile

# Tests
pnpm test

# Nota: para mobile, configurar EXPO_PUBLIC_API_BASE_URL en apps/mobile/.env
# con la IP LAN de la Mac (no localhost).
# Obtener IP: ipconfig getifaddr en0
```

---

## 15. Mobile Slice 1: Login → Home → Detail → Actions

**Fecha**: 2026-02-12

### Objetivo

Primer flujo end-to-end en el mobile: login con JWT, ver lista de matches, ver detalle de un match, y ejecutar acciones de participacion (confirm/decline/withdraw). Backend drives UI: los botones se renderizan segun `actionsAllowed` del snapshot.

### Dependencias instaladas

```
@tanstack/react-query    — Server state management
@react-navigation/native — Navigation container
@react-navigation/native-stack — Stack navigator
react-native-screens     — Native screen primitives
react-native-safe-area-context — Safe area insets
expo-secure-store        — Token persistence (encrypted)
expo-crypto              — UUID generation for idempotency keys
```

### Archivos creados

| Archivo | Rol |
|---|---|
| `src/types/api.ts` | Interfaces para todas las respuestas API (LoginResponse, MeResponse, MatchHomeItem, PageInfo, ListMatchesResponse, MatchSnapshot, ParticipantView, GetMatchResponse, ApiErrorBody) |
| `src/lib/token-store.ts` | Wrapper sobre expo-secure-store: `getStoredToken()`, `setStoredToken()`, `removeStoredToken()` |
| `src/contexts/AuthContext.tsx` | AuthProvider + useAuth hook. Bootstrap: lee token de SecureStore → GET /me → si 401 limpia token. Login/logout manejan persistencia |
| `src/features/auth/authClient.ts` | `postLogin(email, pw)` y `getMe(token)` |
| `src/features/matches/matchesClient.ts` | `getMatches(token, params?)`, `getMatch(token, matchId)`, `postMatchAction(token, matchId, action, revision, key)` |
| `src/features/matches/useMatches.ts` | React Query hook para lista paginada |
| `src/features/matches/useMatch.ts` | React Query hook para detalle (select: data.match) |
| `src/features/matches/useMatchAction.ts` | Mutation hook con retry automatico en 409 REVISION_CONFLICT |
| `src/screens/LoginScreen.tsx` | Email + password inputs, error/loading states |
| `src/screens/HomeScreen.tsx` | FlatList con matches, pull-to-refresh, logout, tap → detail |
| `src/screens/MatchDetailScreen.tsx` | Snapshot completo + action buttons (confirm/decline/withdraw) |
| `src/navigation/AppNavigator.tsx` | Type-safe stacks: AuthStack (Login) y AppStack (Home, MatchDetail). Spinner durante bootstrap |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/lib/api.ts` | +`ApiError` class (status + body), +`buildUrl(path, params?)` helper. `fetchJson` ahora lanza `ApiError` en lugar de `Error` generico |
| `App.tsx` | Reemplaza smoke test con QueryClientProvider → AuthProvider → RootNavigator. QueryClient: staleTime 30s, retry 1 |

### Estructura resultante

```
apps/mobile/src/
├── config/
│   └── env.ts
├── contexts/
│   └── AuthContext.tsx
├── features/
│   ├── auth/
│   │   └── authClient.ts
│   ├── health/
│   │   └── healthClient.ts
│   └── matches/
│       ├── matchesClient.ts
│       ├── useMatch.ts
│       ├── useMatchAction.ts
│       └── useMatches.ts
├── lib/
│   ├── api.ts
│   └── token-store.ts
├── navigation/
│   └── AppNavigator.tsx
├── screens/
│   ├── HomeScreen.tsx
│   ├── LoginScreen.tsx
│   └── MatchDetailScreen.tsx
└── types/
    └── api.ts
```

### Decisiones de diseno

**Token passing explicito**: cada funcion de API client recibe `token: string` como parametro. No hay interceptores globales. Los hooks leen el token de `useAuth()`.

**Backend drives UI**: los botones de accion en el detalle se renderizan segun `match.actionsAllowed`. No se duplica logica de negocio en mobile.

**Mutation retry pattern**: `useMatchAction` captura 409 REVISION_CONFLICT, refetch del match para obtener revision fresca, reintenta con nuevo UUID de idempotencia. Max 1 retry.

**Cache update on success**: mutation `onSuccess` hace `setQueryData(['match', matchId], data)` (instant update) + `invalidateQueries(['matches'])` (background refresh del home).

**Auth bootstrap**: al iniciar la app, lee SecureStore → intenta GET /me → si 401 limpia token → muestra login. La navegacion cambia automaticamente via `isAuthenticated`.

### Flujo de usuario

1. App inicia → loading spinner mientras bootstrap de auth
2. Sin token → pantalla Login
3. Login con email/password → guarda token en SecureStore → GET /me → navega a Home
4. Home muestra lista de matches con confirmedCount/capacity, myStatus, pull-to-refresh
5. Tap en match → MatchDetail con info completa + botones de accion
6. Tap confirm/decline/withdraw → mutation con idempotencia + optimistic locking
7. Si 409 REVISION_CONFLICT → retry automatico con revision fresca
8. Exito → cache actualizado inmediatamente, lista se refresca en background
9. Logout → limpia token + cache, vuelve a Login

### Verificacion

```bash
# TypeScript check
cd apps/mobile && npx tsc --noEmit  # OK, 0 errores

# Manual testing
pnpm dev:api     # Backend
pnpm dev:mobile  # Expo

# Login con seed user: dev@fuchibol.local / password123
# Ver matches, tap en uno, confirmar participacion
```

---

## 16. Mobile Slice 1.1: Home real + Detail (read-only)

**Fecha**: 2026-02-12

### Objetivo

Refinar las pantallas Home y MatchDetail para que consuman datos reales del backend, con manejo correcto de estados (loading, error, empty) y logout automatico en 401. Sin acciones (mutations) — eso va en Slice 1.2.

### Archivos creados

| Archivo | Rol |
|---|---|
| `src/lib/use-api-query.ts` | Hook `useLogoutOn401(query)`: observa errores de queries y dispara logout si recibe 401 |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/screens/HomeScreen.tsx` | +error state con retry, +locked indicator `[Locked]` en titulo, +401 handling via `useLogoutOn401`, TouchableOpacity → Pressable |
| `src/screens/MatchDetailScreen.tsx` | Removidas acciones (confirm/decline/withdraw) — quedan para Slice 1.2. +error state (404: "Match not found", otros: retry). +participant/waitlist counts. +revision para debug. +401 handling via `useLogoutOn401` |
| `apps/api/tsconfig.json` | +`../../node_modules/@types` en typeRoots (fix para pnpm hoisted) |
| `apps/api/prisma/seed.ts` | Usa `createPrismaWithPgAdapter` factory (Prisma 7 sin url en schema) |

### Manejo global de 401

Patron elegido: hook `useLogoutOn401(query)` que se llama en cada pantalla autenticada.

```typescript
// src/lib/use-api-query.ts
export function useLogoutOn401(query: UseQueryResult<unknown, Error>) {
  const { logout } = useAuth();
  useEffect(() => {
    if (query.error instanceof ApiError && query.error.status === 401) {
      logout();
    }
  }, [query.error, logout]);
}
```

Cada pantalla lo usa asi:
```typescript
const query = useMatches();
useLogoutOn401(query);
```

Si el token expira o es invalido, la query falla con 401, el hook detecta y llama `logout()` que limpia SecureStore + queryClient + cambia `isAuthenticated` a false → navegacion cambia a LoginScreen automaticamente.

### Checklist de verificacion manual

- [ ] Login con dev@fuchibol.local / password123
- [ ] Home carga lista de matches (o "No matches yet" si vacia)
- [ ] Pull-to-refresh funciona
- [ ] Tap en match → Detail carga snapshot real
- [ ] Detail muestra: title, date, time, location, players, myStatus, participants count, waitlist count, revision
- [ ] Si backend caido → error state con "Retry"
- [ ] Si token invalido → redirige a Login

### Como correr

```bash
pnpm dev:api     # Backend (asegurar Docker con Postgres+Redis corriendo)
pnpm dev:mobile  # Expo

# EXPO_PUBLIC_API_BASE_URL en apps/mobile/.env debe apuntar a IP LAN
```

---

## 17. Mobile: Create Match

**Fecha**: 2026-02-12

### Objetivo

Pantalla para crear matches desde el mobile, desbloqueando pruebas E2E sin depender de curl/seed.

### Endpoint consumido

`POST /api/v1/matches` — no requiere Idempotency-Key.

Body: `{ title: string, startsAt: string (ISO 8601), capacity: number (>= 1) }`

Response: `{ id, revision, status }`

Validaciones backend: title no vacio, capacity > 0, startsAt al menos 1 minuto en el futuro.

### Archivos creados

| Archivo | Rol |
|---|---|
| `src/screens/CreateMatchScreen.tsx` | Form con title, startsAt (ISO text input), capacity. POST al backend. On success: invalida query de matches y navega a MatchDetail del match creado. Manejo de 401 (logout) y 422 (mostrar mensaje) |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/types/api.ts` | +`CreateMatchResponse` interface |
| `src/features/matches/matchesClient.ts` | +`createMatch(token, payload)` |
| `src/navigation/AppNavigator.tsx` | +route `CreateMatch` en AppStack |
| `src/screens/HomeScreen.tsx` | +boton "+ Create Match" que navega a CreateMatch |

### Flujo

1. Home → tap "+ Create Match"
2. CreateMatchScreen: llenar title, startsAt (pre-filled con mañana a la hora en punto), capacity (default 10)
3. Tap "Create Match" → POST /api/v1/matches
4. Success → `invalidateQueries(['matches'])` + `navigation.replace('MatchDetail', { matchId })`
5. Error 422 → muestra mensaje de validacion
6. Error 401 → logout

### Verificacion

```bash
pnpm dev:api && pnpm dev:mobile
# Login → tap "+ Create Match" → llenar form → submit
# → navega a MatchDetail del match creado
# → back → Home muestra el match en la lista
```

---

## 18. Mobile: Mejorar CreateMatch UX (pickers + formato)

**Fecha**: 2026-02-12

### Objetivo

Reemplazar inputs crudos de startsAt y capacity por controles nativos: date/time pickers y selector de formato (F5/F7/F8/F11) que calcula capacity automaticamente.

### Dependencia instalada

`@react-native-community/datetimepicker` — pickers nativos iOS/Android.

### Archivo modificado

| Archivo | Cambio |
|---|---|
| `src/screens/CreateMatchScreen.tsx` | Reescrito: date picker nativo, time picker nativo (24h, spinner), segmented control para formato (F5→10, F7→14, F8→16, F11→22), capacity read-only. Default: mañana 20:00, F5. Payload sigue siendo `{ title, startsAt: date.toISOString(), capacity }` — no se envia "format" al backend |

### Mapeo formato → capacity

| Formato | Capacity |
|---|---|
| F5 | 10 |
| F7 | 14 |
| F8 | 16 |
| F11 | 22 |

### Comportamiento pickers

- **iOS**: display `spinner`, se muestra inline. Boton "Done" para cerrar.
- **Android**: display `spinner`, se cierra automaticamente al seleccionar.
- **startsAt**: se construye combinando fecha + hora local y se envia como UTC via `date.toISOString()`.

### Verificacion

```bash
pnpm dev:api && pnpm dev:mobile
# Login → "+ Create Match"
# Cambiar formato F5 → F7 → capacity cambia a 14
# Elegir fecha con picker, hora con picker
# Submit → navega a MatchDetail
```

---

## 19. Mobile Slice 1.2: Acciones de participacion (confirm/decline/withdraw)

**Fecha**: 2026-02-13

### Objetivo

Agregar botones de accion en MatchDetail para confirmar, declinar o retirarse de un match. Los botones se muestran segun `actionsAllowed` del snapshot (backend drives UI). Incluye retry automatico en 409 REVISION_CONFLICT y manejo de errores user-friendly.

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/features/matches/useMatchAction.ts` | +`formatActionError(err)` para mensajes user-friendly (locked, revision conflict, validation). +401→logout en mutationFn |
| `src/screens/MatchDetailScreen.tsx` | +botones de accion (Confirm/Decline/Withdraw) renderizados segun `actionsAllowed`. Loading state en botones. Error text inline. Usa `useMatchAction` + `formatActionError` |

### Mecanismo de accion

1. UI lee `match.actionsAllowed` del snapshot y muestra solo botones permitidos
2. Al tocar un boton, llama `mutation.mutate({ action, revision: match.revision })`
3. `useMatchAction` genera UUID via `expo-crypto` como `Idempotency-Key`
4. POST `/api/v1/matches/:id/{action}` con body `{ expectedRevision }` y header `Idempotency-Key`
5. Si 409 REVISION_CONFLICT: refetch snapshot, retry con nueva revision + nuevo UUID (max 1 retry)
6. On success: `setQueryData` para update inmediato del detail + `invalidateQueries` para refrescar Home

### Manejo de errores

| Error | Mensaje mostrado |
|---|---|
| 401 | Logout automatico (no muestra mensaje) |
| 409 REVISION_CONFLICT | Retry automatico 1 vez. Si falla de nuevo: "Match was updated, please try again" |
| 409 MATCH_LOCKED | "Match is locked" |
| 409 otro | Mensaje del backend |
| 422 | Mensaje(s) de validacion del backend |
| Network/timeout | "Connection error. Please try again." |

### Headers enviados por accion

```
POST /api/v1/matches/:id/confirm
Headers:
  Authorization: Bearer {token}
  Content-Type: application/json
  Idempotency-Key: {uuid}
Body:
  { "expectedRevision": {revision} }
```

Idem para `/decline` y `/withdraw`.

### Verificacion

```bash
pnpm dev:api && pnpm dev:mobile

# 1. Crear match → ver detail → tap "Confirm" → myStatus cambia a CONFIRMED
# 2. Tap "Withdraw" → myStatus desaparece, confirmedCount baja
# 3. Tap "Confirm" de nuevo → funciona
# 4. Tap "Decline" (si visible) → myStatus cambia a DECLINED
# 5. Lock match via curl → entrar al detail → no aparecen botones (excepto withdraw si confirmado)
# 6. Simular 409: modificar match desde otro cliente → confirmar → retry automatico
```

---

## 20. Etapa 0 RNF: Observabilidad y contrato de errores

**Fecha**: 2026-02-13

### Objetivo

Correlation ID end-to-end (X-Request-Id), logging estructurado por request con duracion, y error envelope consistente (mini Problem Details) para que mobile reaccione por `code` estable en vez de strings.

### Backend: archivos creados

| Archivo | Rol |
|---|---|
| `src/common/middleware/request-id.middleware.ts` | Lee/genera X-Request-Id, adjunta a `req.requestId`, setea header en response |
| `src/common/interceptors/http-logging.interceptor.ts` | Loguea 1 linea por request exitoso: method, path, status, duration, requestId, actorId |
| `src/common/filters/api-exception.filter.ts` | ExceptionFilter global: convierte cualquier error a Problem Details JSON con `code` estable |

### Backend: archivos modificados

| Archivo | Cambio |
|---|---|
| `src/main.ts` | +`app.use(requestIdMiddleware)`, +`app.useGlobalInterceptors(HttpLoggingInterceptor)`, +`app.useGlobalFilters(ApiExceptionFilter)`. CORS: +`X-Request-Id` en allowedHeaders y exposedHeaders |
| `src/@types/express/index.d.ts` | +`requestId?: string` en Express.Request |

### Error envelope (Problem Details)

Todas las respuestas de error ahora tienen esta estructura:

```json
{
  "type": "about:blank",
  "title": "CONFLICT",
  "status": 409,
  "code": "REVISION_CONFLICT",
  "detail": "REVISION_CONFLICT",
  "requestId": "a1b2c3d4-..."
}
```

### Mapeo de codes

| HTTP Status | Code default | Codes de dominio |
|---|---|---|
| 401 | UNAUTHORIZED | — |
| 403 | FORBIDDEN | — |
| 404 | NOT_FOUND | — |
| 409 | CONFLICT | REVISION_CONFLICT, MATCH_LOCKED, CAPACITY_BELOW_CONFIRMED |
| 422 | VALIDATION_ERROR | — (+ campo `errors` con array de mensajes) |
| 500 | INTERNAL | — |

Los codes de dominio se detectan a partir del `message` de las `ConflictException` existentes. No se modifico ninguna logica de dominio.

### Ejemplo 409

```bash
curl -X POST http://localhost:3000/api/v1/matches/xxx/confirm \
  -H 'Authorization: Bearer TOKEN' \
  -H 'Idempotency-Key: uuid' \
  -H 'X-Request-Id: test-rid-123' \
  -d '{"expectedRevision": 999}'
```

```json
{
  "type": "about:blank",
  "title": "CONFLICT",
  "status": 409,
  "code": "REVISION_CONFLICT",
  "detail": "REVISION_CONFLICT",
  "requestId": "test-rid-123"
}
```

### Log de backend

```
[HTTP] GET /api/v1/matches 200 12ms rid=abc-123 actor=user-uuid
[ExceptionFilter] POST /api/v1/matches/x/confirm 409 3ms rid=abc-124 actor=user-uuid code=REVISION_CONFLICT
```

### Mobile: archivos modificados

| Archivo | Cambio |
|---|---|
| `src/lib/api.ts` | Genera X-Request-Id (UUID via expo-crypto) por request. Loguea con rid. ApiError ahora expone `.requestId` y `.code`. Usa `body.detail` como mensaje principal |
| `src/types/api.ts` | ApiErrorBody actualizado a Problem Details shape (+type, +title, +code, +detail, +errors, +requestId) |
| `src/features/matches/useMatchAction.ts` | formatActionError usa `err.code` en vez de `err.body.message`. Retry en 409 detecta por `err.code === 'REVISION_CONFLICT'` |
| `src/screens/HomeScreen.tsx` | Error state muestra requestId para debug |
| `src/screens/MatchDetailScreen.tsx` | Error state muestra requestId para debug |
| `src/screens/LoginScreen.tsx` | Usa `err.body.detail ?? err.body.message` (compat con nuevo envelope) |
| `src/screens/CreateMatchScreen.tsx` | Idem LoginScreen |

### Debug con X-Request-Id

1. Reproducir error en mobile (ej: tap Confirm en match modificado)
2. Copiar requestId de la pantalla de error o del log de consola `[api] ERROR 409 code=REVISION_CONFLICT rid=xxx`
3. Buscar en logs del backend: `grep xxx` o buscar `rid=xxx`
4. Correlacionar mobile ↔ backend con el mismo ID

### Verificacion

```bash
pnpm test         # 36 tests pass
cd apps/api && npx tsc --noEmit    # 0 errors
cd apps/mobile && npx tsc --noEmit # 0 errors
```

---

## 21. RNF Step 1: Seguridad minima + Anti-abuso (Rate Limiting + Helmet)

**Fecha**: 2026-02-13

### Objetivo

Rate limiting (throttling) con Redis como storage, hardening HTTP con Helmet, CORS por ambiente, body size limit. Integrado con el error envelope del Step 0 (code estable `RATE_LIMITED`, requestId).

### Dependencias instaladas

```
@nestjs/throttler  — Rate limiting module para NestJS (v6)
ioredis            — Redis client (storage para throttler)
helmet             — Security HTTP headers
```

### Archivos creados

| Archivo | Rol |
|---|---|
| `src/infra/redis/redis.module.ts` | RedisModule global: crea conexion ioredis, lee `REDIS_URL`, maneja errores sin crash. Si Redis no esta disponible, provee `null` |
| `src/infra/redis/redis-throttle-storage.ts` | Storage adapter para ThrottlerModule: usa Redis si disponible, fallback automatico a Map en memoria. Cleanup periodico de entries expirados |
| `src/common/throttle/throttle.module.ts` | AppThrottleModule: configura ThrottlerModule con 3 perfiles nombrados (login/mutations/reads) + guard global |
| `src/common/guards/app-throttle.guard.ts` | AppThrottleGuard: key por actorId (autenticado) o IP. Para login: IP+email normalizado. Skip health endpoint |
| `src/common/filters/api-exception.filter.spec.ts` | Tests unitarios del filter: verifica 429→RATE_LIMITED, 409→REVISION_CONFLICT, requestId presente, 500→INTERNAL |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/app.module.ts` | +RedisModule, +AppThrottleModule en imports |
| `src/main.ts` | +`helmet()`, +CORS por env (`ALLOWED_ORIGINS` en prod, `true` en dev), +`Retry-After` en exposedHeaders, +body size limit `1mb`, +`NestExpressApplication` type |
| `src/common/filters/api-exception.filter.ts` | 429 ahora mapea a code `RATE_LIMITED` (antes `TOO_MANY_REQUESTS`) |
| `src/auth/api/auth.controller.ts` | +`@Throttle({ login: {} })` en login, +`@Throttle({ mutations: {} })` en register |
| `src/matches/api/matches.controller.ts` | +`@Throttle({ mutations: {} })` en todos los endpoints de mutacion (create, update, lock, unlock, confirm, decline, withdraw, invite) |
| `.env.example` | +REDIS_URL, +ALLOWED_ORIGINS, +THROTTLE_* env vars documentadas |

### Perfiles de rate limiting

| Perfil | TTL | Limit | Aplicado a | Configurable via |
|---|---|---|---|---|
| `login` | 10 min (600000ms) | 5 req | POST /auth/login | THROTTLE_LOGIN_TTL, THROTTLE_LOGIN_LIMIT |
| `mutations` | 1 min (60000ms) | 30 req | Todos los POST/PATCH de mutacion | THROTTLE_MUTATIONS_TTL, THROTTLE_MUTATIONS_LIMIT |
| `reads` | 1 min (60000ms) | 120 req | Global default (GET endpoints) | THROTTLE_READS_TTL, THROTTLE_READS_LIMIT |

### Keying strategy

| Contexto | Key |
|---|---|
| Autenticado | `userId` |
| No autenticado (general) | IP |
| Login endpoint | `IP:email` (normalizado lowercase+trim) |
| Health endpoint | Skip (sin rate limit) |

### Redis integration

- `RedisModule` es `@Global()` — disponible en todo el app via `@Inject(REDIS_CLIENT)`.
- Conexion lazy con reconnect. Si Redis no arranca, el provider retorna `null`.
- `RedisThrottleStorage.increment()` intenta Redis primero; si falla, cae a in-memory.
- Log de warning en fallback: `"Redis throttle error, falling back to memory: ..."`.
- Cleanup de entries en memoria cada 60s.

### Hardening HTTP

**Helmet**: headers de seguridad por defecto (CSP, X-Frame-Options, etc). Configurado antes de CORS para no interferir.

**CORS por ambiente**:
- `NODE_ENV !== 'production'`: `origin: true` (acepta cualquier origin, dev/expo).
- `NODE_ENV === 'production'`: `origin: ALLOWED_ORIGINS` (comma-separated).
- Headers: Content-Type, Authorization, Idempotency-Key, If-Match, X-Request-Id.
- Exposed: X-Request-Id, Retry-After.

**Body size limit**: `1mb` JSON via `app.useBodyParser('json', { limit: '1mb' })`.

### Respuesta 429

```json
{
  "type": "about:blank",
  "title": "TOO_MANY_REQUESTS",
  "status": 429,
  "code": "RATE_LIMITED",
  "detail": "Too many requests",
  "requestId": "a1b2c3d4-..."
}
```

### Variables de entorno nuevas

| Variable | Default | Descripcion |
|---|---|---|
| `REDIS_URL` | `redis://localhost:6379` | URL de conexion Redis |
| `ALLOWED_ORIGINS` | (vacio) | Origins CORS permitidos en prod (comma-separated) |
| `THROTTLE_LOGIN_LIMIT` | 5 | Max requests para login |
| `THROTTLE_LOGIN_TTL` | 600000 | Ventana de tiempo login (ms) |
| `THROTTLE_MUTATIONS_LIMIT` | 30 | Max requests para mutaciones |
| `THROTTLE_MUTATIONS_TTL` | 60000 | Ventana de tiempo mutaciones (ms) |
| `THROTTLE_READS_LIMIT` | 120 | Max requests para lecturas |
| `THROTTLE_READS_TTL` | 60000 | Ventana de tiempo lecturas (ms) |

### Tests agregados (4 nuevos, 40 total)

| Test | Que valida |
|---|---|
| "should return RATE_LIMITED code for 429" | ThrottlerException → code RATE_LIMITED + requestId |
| "should return REVISION_CONFLICT code for known 409" | Domain error codes preservados |
| "should include requestId in every error response" | requestId siempre presente en envelope |
| "should return INTERNAL for unhandled exceptions" | Errores no-HTTP → 500 INTERNAL |

### Ejemplo curl: disparar 429 en login

```bash
# Disparar rate limit en login (6 requests rapidos, limit=5)
for i in $(seq 1 6); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:3000/api/v1/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"test@test.com","password":"wrong"}'
done
# Las primeras 5 devuelven 401, la 6ta devuelve 429

# Ver respuesta completa del 429:
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -H 'X-Request-Id: test-rate-limit' \
  -d '{"email":"test@test.com","password":"wrong"}'
```

### Como correr

```bash
# 1. Levantar infra (Redis + Postgres)
cd infra && docker compose up -d

# 2. API
pnpm dev:api

# 3. Verificar
pnpm test          # 40 tests pass
cd apps/api && npx tsc --noEmit   # 0 errors
```

### Estructura de archivos nuevos

```
src/
├── infra/
│   └── redis/
│       ├── redis.module.ts            # RedisModule (@Global, REDIS_CLIENT provider)
│       └── redis-throttle-storage.ts  # ThrottlerStorage con Redis + fallback memory
├── common/
│   ├── guards/
│   │   └── app-throttle.guard.ts      # Custom guard: key por actor/IP, skip health
│   ├── throttle/
│   │   └── throttle.module.ts         # AppThrottleModule (3 perfiles)
│   └── filters/
│       └── api-exception.filter.spec.ts  # Tests del error envelope
```

---

## 22. Idempotency v2: TTL, Replay, Payload Reuse Detection, Cleanup

### Que se hizo

Se mejoro el sistema de idempotencia para hacerlo production-ready:

1. **Request hash (SHA-256)**: se hashea el body del request y se almacena junto al registro. Si se reutiliza la misma key con un body distinto, se responde `409 IDEMPOTENCY_KEY_REUSE`.
2. **TTL + expiresAt**: cada registro tiene un `expiresAt` (default 48h). Los registros expirados se tratan como nuevos (se eliminan y re-ejecutan).
3. **Cleanup job**: `IdempotencyCleanupService` borra registros expirados cada hora (configurable via env).
4. **Unique constraint simplificado**: `(key, actorId, route)` — se removio `matchId` del constraint (queda como campo opcional de debug).
5. **Columna `status` eliminada**: siempre era "completed", no aportaba valor.

### Migracion

```sql
DELETE FROM "IdempotencyRecord";
-- Drop old constraint/index, add new columns, new constraint/index
ALTER TABLE "IdempotencyRecord" DROP COLUMN IF EXISTS "status";
ALTER TABLE "IdempotencyRecord" ALTER COLUMN "matchId" DROP NOT NULL;
ALTER TABLE "IdempotencyRecord" ADD COLUMN "requestHash" TEXT NOT NULL;
ALTER TABLE "IdempotencyRecord" ADD COLUMN "statusCode" INTEGER NOT NULL DEFAULT 200;
ALTER TABLE "IdempotencyRecord" ADD COLUMN "expiresAt" TIMESTAMP(3) NOT NULL;
CREATE UNIQUE INDEX "IdempotencyRecord_key_actorId_route_key" ON "IdempotencyRecord"("key", "actorId", "route");
CREATE INDEX "IdempotencyRecord_expiresAt_idx" ON "IdempotencyRecord"("expiresAt");
```

### Archivos creados/modificados

| Accion | Archivo |
|--------|---------|
| MODIFY | `apps/api/prisma/schema.prisma` — nuevo schema IdempotencyRecord |
| CREATE | `apps/api/prisma/migrations/20260213..._idempotency_v2/migration.sql` |
| MODIFY | `apps/api/src/common/idempotency/idempotency.service.ts` — hash, TTL, reuse detection |
| CREATE | `apps/api/src/common/idempotency/idempotency-cleanup.service.ts` — cleanup job |
| MODIFY | `apps/api/src/common/idempotency/idempotency.module.ts` — registra cleanup service |
| MODIFY | `apps/api/src/common/filters/api-exception.filter.ts` — agrega `IDEMPOTENCY_KEY_REUSE` |
| MODIFY | `apps/api/src/matches/application/confirm-participation.use-case.ts` — agrega `requestBody` |
| MODIFY | `apps/api/src/matches/application/decline-participation.use-case.ts` — agrega `requestBody` |
| MODIFY | `apps/api/src/matches/application/withdraw-participation.use-case.ts` — agrega `requestBody` |
| MODIFY | `apps/api/src/matches/application/invite-participation.use-case.ts` — agrega `requestBody` |
| CREATE | `apps/api/src/common/idempotency/idempotency.service.spec.ts` — 6 tests |
| CREATE | `apps/api/src/common/idempotency/idempotency-cleanup.service.spec.ts` — 1 test |
| MODIFY | `apps/api/src/matches/application/participation.use-case.spec.ts` — adapt mocks |
| MODIFY | `apps/api/src/matches/application/update-lock.use-case.spec.ts` — adapt mocks |
| MODIFY | `apps/api/.env.example` — env vars documentadas |

### Env vars (opcionales)

| Variable | Default | Descripcion |
|----------|---------|-------------|
| `IDEMPOTENCY_TTL_MS` | `172800000` (48h) | Tiempo de vida de registros de idempotencia |
| `IDEMPOTENCY_CLEANUP_INTERVAL_MS` | `3600000` (1h) | Intervalo de limpieza de registros expirados |

### Logica de `IdempotencyService.run()`

1. Calcula `requestHash` = SHA-256 del body serializado.
2. Busca registro existente por `(key, actorId, route)`.
3. Si existe y no expiro:
   - Hash distinto → `409 IDEMPOTENCY_KEY_REUSE`
   - Hash igual → replay (devuelve `responseJson`)
4. Si existe y expiro → elimina y re-ejecuta.
5. Si no existe → ejecuta callback, guarda resultado con `expiresAt`.

### Tests

- `idempotency.service.spec.ts`: first execution, replay, key reuse (409), expired re-execution, hash determinism.
- `idempotency-cleanup.service.spec.ts`: cleanup deletes expired records.
- Tests existentes adaptados para nuevo constructor de `IdempotencyService` (requiere `ConfigService`).
