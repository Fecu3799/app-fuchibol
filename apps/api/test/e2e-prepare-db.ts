import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as dotenv from 'dotenv';
import { Client } from 'pg';

const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env.test');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else if (!process.env.DATABASE_URL_TEST) {
  console.error(
    '[e2e] .env.test not found and DATABASE_URL_TEST not set.\nRun: pnpm --filter api env:setup',
  );
  process.exit(1);
}

const requireEnv = (name: string) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[e2e] Missing ${name} in .env.test`);
  }
  return value;
};

const assertTestDatabase = (url: string, label: string) => {
  const parsed = new URL(url);
  const dbName = parsed.pathname.replace('/', '');
  if (dbName !== 'app_test' && !dbName.includes('_test')) {
    throw new Error(
      `[e2e] ${label} database name "${dbName}" must contain "_test" or be "app_test". Aborting to protect dev DB.`,
    );
  }
};

const getDatabaseName = (databaseUrl: string) => {
  const parsed = new URL(databaseUrl);
  return parsed.pathname.replace('/', '');
};

const getAdminUrl = (databaseUrl: string) => {
  const parsed = new URL(databaseUrl);
  parsed.pathname = '/postgres';
  return parsed.toString();
};

const ensureDatabaseExists = async (databaseUrl: string) => {
  const databaseName = getDatabaseName(databaseUrl);
  const adminUrl = getAdminUrl(databaseUrl);
  const client = new Client({ connectionString: adminUrl });
  await client.connect();

  const result = await client.query(
    'SELECT 1 FROM pg_database WHERE datname = $1',
    [databaseName],
  );

  if (result.rowCount === 0) {
    await client.query(`CREATE DATABASE "${databaseName}"`);
  }

  await client.end();
};

const databaseUrlTest = requireEnv('DATABASE_URL_TEST');
assertTestDatabase(databaseUrlTest, 'DATABASE_URL_TEST');

const shadowDatabaseUrlTest = process.env.SHADOW_DATABASE_URL_TEST;
if (shadowDatabaseUrlTest) {
  assertTestDatabase(shadowDatabaseUrlTest, 'SHADOW_DATABASE_URL_TEST');
}

const prepare = async () => {
  console.log('[e2e] prepare-db: ensuring test databases exist...');
  await ensureDatabaseExists(databaseUrlTest);
  if (shadowDatabaseUrlTest) {
    await ensureDatabaseExists(shadowDatabaseUrlTest);
  }

  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrlTest,
    // Allow Prisma to run destructive reset on the verified test database
    PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: 'yes',
  };

  if (shadowDatabaseUrlTest) {
    env.SHADOW_DATABASE_URL = shadowDatabaseUrlTest;
  }

  console.log('[e2e] prepare-db: running prisma migrate reset...');
  // shell: true is required on Windows so cmd.exe resolves pnpm.CMD;
  // it is a no-op on macOS/Linux (uses /bin/sh).
  const result = spawnSync('pnpm', ['prisma', 'migrate', 'reset', '--force'], {
    cwd: rootDir,
    stdio: 'inherit',
    env,
    shell: true,
  });

  if (result.error) {
    console.error('[e2e] prepare-db: failed to spawn pnpm —', result.error.message);
    console.error('[e2e]   (hint: pnpm not found in PATH inside the Node subprocess)');
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(
      `[e2e] prepare-db: prisma migrate reset failed — status=${result.status ?? 'null'}, signal=${result.signal ?? 'none'}`,
    );
    process.exit(result.status ?? 1);
  }

  console.log('[e2e] prepare-db: done');
};

prepare().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
