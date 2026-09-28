// Zero-setup database bootstrap. Runs on every server start:
//   1. creates the database if it does not exist yet
//   2. applies schema.sql + seed.sql when the tables are missing, or when the
//      schema/seed files changed since the last time they were applied
// so `npm install && npm run dev` is all that is ever needed.
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const crypto = require('node:crypto');
const { Client } = require('pg');
const env = require('../config/env');

const schemaSql = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
const seedSql = readFileSync(join(__dirname, 'seed.sql'), 'utf8');
const fingerprint = crypto.createHash('sha256').update(schemaSql + seedSql).digest('hex');

async function ensureDatabaseExists() {
  const url = new URL(env.DATABASE_URL);
  const dbName = decodeURIComponent(url.pathname.slice(1));
  url.pathname = '/postgres'; // maintenance database
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  try {
    const { rowCount } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (!rowCount) {
      await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
      console.log(`Created database "${dbName}".`);
    }
  } finally {
    await admin.end();
  }
}

async function ensureSchemaAndSeed() {
  const client = new Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('CREATE TABLE IF NOT EXISTS _bootstrap_meta (id INT PRIMARY KEY, fingerprint TEXT NOT NULL)');
    const tables = await client.query("SELECT to_regclass('public.users') AS users");
    const meta = await client.query('SELECT fingerprint FROM _bootstrap_meta WHERE id = 1');
    const upToDate = tables.rows[0].users && meta.rows[0] && meta.rows[0].fingerprint === fingerprint;
    if (upToDate) return;

    console.log('Setting up database tables and sample data...');
    await client.query(schemaSql);
    await client.query(seedSql);
    await client.query(
      `INSERT INTO _bootstrap_meta (id, fingerprint) VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET fingerprint = EXCLUDED.fingerprint`,
      [fingerprint]
    );
    console.log('Database ready.');
  } finally {
    await client.end();
  }
}

function explain(err) {
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    return 'Could not reach PostgreSQL. Make sure PostgreSQL is installed and running (default port 5432).';
  }
  if (err.code === '28P01') {
    return 'PostgreSQL rejected the password. Create a file server/.env containing one line:\n' +
      '  DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/borrowbox';
  }
  return err.message;
}

async function bootstrapDatabase() {
  try {
    await ensureDatabaseExists();
    await ensureSchemaAndSeed();
  } catch (err) {
    console.error(`Database setup failed: ${explain(err)}`);
    process.exit(1);
  }
}

module.exports = { bootstrapDatabase };
