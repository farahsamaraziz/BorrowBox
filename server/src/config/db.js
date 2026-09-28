const { Pool, types } = require('pg');
const env = require('./env');

// By default node-postgres turns DATE columns into JS Date objects at local
// midnight, which then serialise to JSON as a shifted UTC timestamp
// (e.g. 2026-09-24 becomes "2026-09-23T19:00:00.000Z" in UTC+5).
// Booking dates are calendar dates, so keep them as plain 'YYYY-MM-DD' strings.
types.setTypeParser(1082, (value) => value);

const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(1);
});

/**
 * Run a query using the shared pool.
 */
function query(text, params) {
  return pool.query(text, params);
}

/**
 * Run a function inside a single client transaction.
 * Usage: await withTransaction(async (client) => { ... });
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
