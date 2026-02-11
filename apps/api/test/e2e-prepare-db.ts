import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as dotenv from 'dotenv';
import { Client } from 'pg';

const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env.test');

if (!fs.existsSync(envPath)) {
  console.error('[e2e] .env.test not found.\nRun: pnpm --filter api env:setup');
  process.exit(1);
}

dotenv.config({ path: envPath });

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
  await ensureDatabaseExists(databaseUrlTest);
  if (shadowDatabaseUrlTest) {
    await ensureDatabaseExists(shadowDatabaseUrlTest);
  }

  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrlTest,
  };

  if (shadowDatabaseUrlTest) {
    env.SHADOW_DATABASE_URL = shadowDatabaseUrlTest;
  }

  const result = spawnSync('pnpm', ['prisma', 'migrate', 'reset', '--force'], {
    cwd: rootDir,
    stdio: 'inherit',
    env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

prepare().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
