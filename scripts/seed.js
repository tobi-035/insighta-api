'use strict';

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const pool = require('../src/db');
const { uuidv7 } = require('../src/utils/uuidv7');

async function seed() {
  const filePath = path.join(__dirname, '..', 'data', 'profiles.json');

  if (!fs.existsSync(filePath)) {
    console.error('✗ data/profiles.json not found');
    process.exit(1);
  }

  const raw  = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  // Support both { profiles: [...] } and plain array
  const list = Array.isArray(raw) ? raw : (raw.profiles || []);
  console.log(`→ ${list.length} profiles to seed`);

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

    let inserted = 0, skipped = 0;
    const BATCH = 100;

    for (let i = 0; i < list.length; i += BATCH) {
      const batch = list.slice(i, i + BATCH);
      await client.query('BEGIN');
      for (const p of batch) {
        const id      = uuidv7();
        const name    = (p.name || '').trim();
        const gender  = (p.gender || '').toLowerCase();
        const gprob   = parseFloat(p.gender_probability) || 0;
        const age     = parseInt(p.age, 10) || 0;
        const group   = p.age_group || getGroup(age);
        const cid     = (p.country_id || '').toUpperCase().slice(0, 2);
        const cname   = p.country_name || '';
        const cprob   = parseFloat(p.country_probability) || 0;

        if (!name || !gender || !cid) { skipped++; continue; }

        try {
          const res = await client.query(
            `INSERT INTO profiles
               (id,name,gender,gender_probability,age,age_group,country_id,country_name,country_probability)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             ON CONFLICT (name) DO NOTHING`,
            [id, name, gender, gprob, age, group, cid, cname, cprob]
          );
          if (res.rowCount > 0) inserted++; else skipped++;
        } catch { skipped++; }
      }
      await client.query('COMMIT');
      process.stdout.write(`\r  → ${Math.min(i + BATCH, list.length)}/${list.length}`);
    }

    const { rows } = await client.query('SELECT COUNT(*)::int AS n FROM profiles');
    console.log(`\n✓ Done — inserted: ${inserted}, skipped: ${skipped}, total in DB: ${rows[0].n}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('✗ Seed error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

function getGroup(age) {
  if (age <= 12) return 'child';
  if (age <= 17) return 'teenager';
  if (age <= 64) return 'adult';
  return 'senior';
}

seed();
