const env = require('./config/env');
const { bootstrapDatabase } = require('./db/bootstrap');

const PORT = env.PORT;

async function start() {
  // Creates the database, tables and sample data automatically when needed.
  await bootstrapDatabase();

  const app = require('./app');
  const { pool } = require('./config/db');

  try {
    await pool.query('SELECT 1');
    console.log('Database connection OK.');
  } catch (err) {
    console.error('Failed to connect to database:', err.message);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`BorrowBox API listening on http://localhost:${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use - another BorrowBox server is probably still running. Close its terminal window and try again.`);
      process.exit(1);
    }
    throw err;
  });
}

start();
