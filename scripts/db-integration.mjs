#!/usr/bin/env node
// Applies every migration to a DISPOSABLE PostgreSQL database and runs the SQL
// test scripts. Never point this at production.
//
//   TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54322/postgres \
//   ALLOW_DISPOSABLE_DB=yes node scripts/db-integration.mjs
//
// Requires the `psql` client. Supabase `auth`, `storage`, `extensions` schemas
// and the anon/authenticated/service_role roles must exist (supabase start does
// this; see supabase/README.md for a plain-Postgres bootstrap).
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { disposableDatabaseEnvironment } from './disposable-db.mjs';

const url = process.env.TEST_DATABASE_URL;
if (!url || process.env.ALLOW_DISPOSABLE_DB !== 'yes') {
  console.error('Set TEST_DATABASE_URL and ALLOW_DISPOSABLE_DB=yes (disposable database only).');
  process.exit(2);
}
let dbEnv;
try {
  dbEnv = disposableDatabaseEnvironment(url);
} catch (error) {
  console.error(error.message);
  process.exit(2);
}
const version = spawnSync('psql', ['--version'], { env: dbEnv });
if (version.error || version.status !== 0) {
  console.error('psql is not installed; integration tests are BLOCKED, not passed.');
  process.exit(3);
}

const root = path.resolve(import.meta.dirname, '..');
const run = (file) => {
  console.log(`> ${path.relative(root, file)}`);
  const r = spawnSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-q', '-f', file], { stdio: 'inherit', env: dbEnv });
  if (r.status !== 0) {
    console.error(`FAILED: ${file}`);
    process.exit(1);
  }
};

const migrations = path.join(root, 'supabase', 'migrations');
for (const f of readdirSync(migrations).filter((n) => n.endsWith('.sql')).sort()) run(path.join(migrations, f));
const tests = path.join(root, 'tests', 'sql');
for (const f of readdirSync(tests).filter((n) => n.endsWith('.sql')).sort()) run(path.join(tests, f));
console.log('All migrations applied and SQL tests passed.');
