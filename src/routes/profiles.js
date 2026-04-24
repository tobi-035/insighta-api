'use strict';

const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const { validateProfileQuery } = require('../middleware/validate');
const { parseNLQuery }         = require('../utils/nlParser');

/* ── shared query builder ───────────────────────────────────── */
function buildQuery(f) {
  const conds  = [];
  const params = [];
  let   i      = 1;
  const p = (cond, val) => { conds.push(cond.replace('?', `$${i++}`)); params.push(val); };

  if (f.gender)     p('gender = ?', f.gender);
  if (f.age_group)  p('age_group = ?', f.age_group);
  if (f.country_id) p('country_id = ?', f.country_id.toUpperCase());
  if (f.min_age  !== undefined) p('age >= ?', f.min_age);
  if (f.max_age  !== undefined) p('age <= ?', f.max_age);
  if (f.min_gender_probability  !== undefined) p('gender_probability >= ?',  f.min_gender_probability);
  if (f.min_country_probability !== undefined) p('country_probability >= ?', f.min_country_probability);

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const SORT  = { age: 'age', created_at: 'created_at', gender_probability: 'gender_probability' };
  const col   = SORT[f.sort_by] || 'created_at';
  const dir   = f.order === 'asc' ? 'ASC' : 'DESC';
  const limit = f.limit || 10;
  const offset = ((f.page || 1) - 1) * limit;

  return {
    dataSql:    `SELECT * FROM profiles ${where} ORDER BY ${col} ${dir} LIMIT $${i} OFFSET $${i + 1}`,
    dataParams: [...params, limit, offset],
    countSql:   `SELECT COUNT(*)::int AS total FROM profiles ${where}`,
    countParams: params,
  };
}

function fmt(row) {
  return {
    id:                  row.id,
    name:                row.name,
    gender:              row.gender,
    gender_probability:  parseFloat(row.gender_probability),
    age:                 parseInt(row.age, 10),
    age_group:           row.age_group,
    country_id:          row.country_id,
    country_name:        row.country_name,
    country_probability: parseFloat(row.country_probability),
    created_at:          row.created_at instanceof Date
                           ? row.created_at.toISOString()
                           : row.created_at,
  };
}

/* ── GET /api/profiles/search ───────────────────────────────── */
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim())
      return res.status(400).json({ status: 'error', message: 'Missing or empty parameter: q' });

    const parsed = parseNLQuery(q);
    if (!parsed)
      return res.status(422).json({ status: 'error', message: 'Unable to interpret query' });

    const page  = req.query.page  ? parseInt(req.query.page,  10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
    if (isNaN(page)  || page  < 1)          return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });
    if (isNaN(limit) || limit < 1 || limit > 50) return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });

    parsed.page  = page;
    parsed.limit = limit;

    const { dataSql, dataParams, countSql, countParams } = buildQuery(parsed);
    const [data, count] = await Promise.all([
      pool.query(dataSql, dataParams),
      pool.query(countSql, countParams),
    ]);

    return res.json({
      status: 'success',
      page,
      limit,
      total: count.rows[0].total,
      data:  data.rows.map(fmt),
    });
  } catch (err) {
    console.error('[/search]', err.message);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

/* ── GET /api/profiles ──────────────────────────────────────── */
router.get('/', validateProfileQuery, async (req, res) => {
  try {
    const { dataSql, dataParams, countSql, countParams } = buildQuery(req.filters);
    const [data, count] = await Promise.all([
      pool.query(dataSql, dataParams),
      pool.query(countSql, countParams),
    ]);
    return res.json({
      status: 'success',
      page:   req.filters.page,
      limit:  req.filters.limit,
      total:  count.rows[0].total,
      data:   data.rows.map(fmt),
    });
  } catch (err) {
    console.error('[/profiles]', err.message);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

/* ── GET /api/profiles/:id ──────────────────────────────────── */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
      return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });

    const result = await pool.query('SELECT * FROM profiles WHERE id = $1', [id]);
    if (!result.rows.length)
      return res.status(404).json({ status: 'error', message: 'Profile not found' });

    return res.json({ status: 'success', data: fmt(result.rows[0]) });
  } catch (err) {
    console.error('[/:id]', err.message);
    return res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

module.exports = router;
