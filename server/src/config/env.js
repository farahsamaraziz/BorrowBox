// Central place for environment handling: load .env once, apply defaults, and fail
// fast when something the API cannot run without is missing.
require('dotenv').config();

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 4000,
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/borrowbox',
  JWT_SECRET: process.env.JWT_SECRET || 'borrowbox_dev_secret_change_me_in_production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
};

const missing = ['DATABASE_URL', 'JWT_SECRET'].filter((key) => !env[key]);
if (missing.length && env.NODE_ENV !== 'test') {
  console.error(`Missing required environment variable(s): ${missing.join(', ')}. Copy .env.example to .env and fill them in.`);
  process.exit(1);
}

module.exports = env;
