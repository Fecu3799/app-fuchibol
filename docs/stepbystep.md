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
- 15 unit tests pasando
- Paquete shared con enums tipados
- Esqueleto mobile Expo

### Que falta (roadmap segun CLAUDE.md)

- Lock/unlock de matches (slice 3)
- Reconfirmacion por cambios mayores (fecha/lugar/capacidad)
- Abandono (withdraw <1h antes del inicio)
- Baja de cupo (ultimos confirmados a waitlist)
- WebSocket (realtime best-effort)
- Chat con dedupe (`clientMsgId`)
- Grupos
- Notificaciones
- Implementacion mobile con React Query
