# API

## Setup

```bash
docker compose -f infra/docker-compose.yml up -d   # from repo root
pnpm --filter api env:setup                         # creates .env and .env.test from examples (no overwrite)
pnpm --filter api db:generate                       # generate Prisma client
pnpm --filter api db:migrate                        # run migrations (dev DB)
```

## E2E tests

```bash
pnpm --filter api test:e2e
```

This creates `app_test` / `app_shadow_test` databases automatically, runs migrations, and executes tests.
The setup validates that the target DB name contains `_test` to protect dev data.
