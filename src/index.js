'use strict';

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const pool    = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use((req, res, next) => { res.setHeader('Access-Control-Allow-Origin', '*'); next(); });
app.use(express.json());

app.use('/api/profiles', require('./routes/profiles'));

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() });
  } catch {
    res.status(502).json({ status: 'error', message: 'Database unavailable' });
  }
});

app.get('/', (req, res) => {
  res.json({
    name: 'Insighta Labs – Intelligence Query Engine',
    version: '1.0.0',
    endpoints: {
      list:   'GET /api/profiles',
      search: 'GET /api/profiles/search?q=young males from nigeria',
      single: 'GET /api/profiles/:id',
      health: 'GET /health',
    },
  });
});

app.use((req, res) => res.status(404).json({ status: 'error', message: 'Route not found' }));
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ status: 'error', message: 'Internal server error' });
});

async function init() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id                  VARCHAR(36)  PRIMARY KEY,
        name                VARCHAR(255) UNIQUE NOT NULL,
        gender              VARCHAR(10)  NOT NULL,
        gender_probability  FLOAT        NOT NULL,
        age                 INT          NOT NULL,
        age_group           VARCHAR(20)  NOT NULL,
        country_id          VARCHAR(2)   NOT NULL,
        country_name        VARCHAR(100) NOT NULL,
        country_probability FLOAT        NOT NULL,
        created_at          TIMESTAMPTZ  DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_p_gender  ON profiles(gender);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_p_age     ON profiles(age);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_p_group   ON profiles(age_group);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_p_country ON profiles(country_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_p_cat     ON profiles(created_at);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_p_gprob   ON profiles(gender_probability);`);
    console.log('✓ Database ready');
  } finally {
    client.release();
  }
}

init()
  .then(() => app.listen(PORT, '0.0.0.0', () => console.log(`✓ API running on port ${PORT}`)))
  .catch(err => { console.error('✗ DB init failed:', err.message); process.exit(1); });
