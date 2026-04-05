// backend/db/pool.js
const { Pool } = require('pg');
require('dotenv').config();

// Railway injecte DATABASE_URL automatiquement.
// En local, on utilise les variables DB_HOST, DB_PORT, etc. du fichier .env
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      }
    : {
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME     || 'wts_db',
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
      }
);

pool.on('error', (err) => {
  console.error('Unexpected DB error:', err);
  process.exit(-1);
});

module.exports = pool;
