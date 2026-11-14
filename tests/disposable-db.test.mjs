import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { disposableDatabaseEnvironment } from '../scripts/disposable-db.mjs';

test('disposable database target rejects remote hosts and connection overrides', () => {
  for (const url of [
    'postgresql://localhost/test?host=production.example',
    'postgresql://localhost/test?service=production',
    'postgresql://production.example/test',
    'postgresql://db/test',
    'postgresql://localhost/',
    'postgresql://localhost/host%3Dproduction.example',
    'postgresql://localhost/postgresql%3A%2F%2Fproduction.example%2Ftest',
    'postgresql://localhost/test#fragment',
    'https://localhost/test',
    'not a URL',
  ]) {
    assert.throws(() => disposableDatabaseEnvironment(url, {}));
  }
});

test('disposable database environment fixes the target and removes inherited libpq settings', () => {
  const env = disposableDatabaseEnvironment('postgresql://test:secret@127.0.0.1:54322/test_db', {
    PGHOST: 'production.example',
    PGSERVICE: 'production',
    pgoptions: '-c search_path=public',
    PATH: 'example',
  });
  assert.equal(env.PGHOST, '127.0.0.1');
  assert.equal(env.PGPORT, '54322');
  assert.equal(env.PGDATABASE, 'test_db');
  assert.equal(env.PGUSER, 'test');
  assert.equal(env.PGPASSWORD, 'secret');
  assert.equal(env.PATH, 'example');
  assert.equal(env.PGSERVICE, undefined);
  assert.equal(env.pgoptions, undefined);
});

test('disposable database environment supports IPv6 loopback', () => {
  const env = disposableDatabaseEnvironment('postgres://[::1]/test_db', {});
  assert.equal(env.PGHOST, '::1');
  assert.equal(env.PGPORT, '5432');
});
