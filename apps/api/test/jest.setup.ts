import * as path from 'node:path';
import * as fs from 'node:fs';
import * as dotenv from 'dotenv';

const assertTestDatabase = (url: string, label: string) => {
  const parsed = new URL(url);
  const dbName = parsed.pathname.replace('/', '');
  if (dbName !== 'app_test' && !dbName.includes('_test')) {
    throw new Error(
      `[e2e] ${label} database name "${dbName}" must contain "_test" or be "app_test". Aborting to protect dev DB.`,
    );
  }
};

export const ensureTestEnv = () => {
  const envPath = path.resolve(__dirname, '..', '.env.test');

  if (!fs.existsSync(envPath)) {
    throw new Error(
      '[e2e] .env.test not found. Run: pnpm --filter api env:setup',
    );
  }

  dotenv.config({ path: envPath });

  const databaseUrlTest = process.env.DATABASE_URL_TEST;
  if (!databaseUrlTest) {
    throw new Error('[e2e] DATABASE_URL_TEST is required in .env.test');
  }

  assertTestDatabase(databaseUrlTest, 'DATABASE_URL_TEST');
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = databaseUrlTest;

  const shadowDatabaseUrlTest = process.env.SHADOW_DATABASE_URL_TEST;
  if (shadowDatabaseUrlTest) {
    assertTestDatabase(shadowDatabaseUrlTest, 'SHADOW_DATABASE_URL_TEST');
    process.env.SHADOW_DATABASE_URL = shadowDatabaseUrlTest;
  }
};

ensureTestEnv();
