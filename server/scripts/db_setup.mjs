#!/usr/bin/env node
// Applies src/db/schema.sql and/or src/db/seed.sql using the same
// DATABASE_URL as the API, so `psql` does not have to be installed.
//
//   npm run db:setup      schema + seed
//   npm run db:schema     schema only (DROPS and re-creates all tables!)
//   npm run db:seed       seed only   (run on an empty database)
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'db');
const target = process.argv[2] || 'all';
const files = { schema: ['schema.sql'], seed: ['seed.sql'], all: ['schema.sql', 'seed.sql'] }[target];

if (!files) {
  console.error('Usage: node scripts/db_setup.mjs [schema|seed|all]');
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  for (const file of files) {
    await client.query(readFileSync(join(dir, file), 'utf8'));
    console.log(`Applied ${file}`);
  }
} catch (err) {
  console.error('Database setup failed:', err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
