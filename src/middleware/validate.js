'use strict';

const VALID_SORT    = new Set(['age', 'created_at', 'gender_probability']);
const VALID_ORDER   = new Set(['asc', 'desc']);
const VALID_GENDER  = new Set(['male', 'female']);
const VALID_GROUP   = new Set(['child', 'teenager', 'adult', 'senior']);
const ALLOWED_KEYS  = new Set([
  'gender', 'age_group', 'country_id', 'min_age', 'max_age',
  'min_gender_probability', 'min_country_probability',
  'sort_by', 'order', 'page', 'limit',
]);

function validateProfileQuery(req, res, next) {
  const q = req.query;

  for (const key of Object.keys(q)) {
    if (!ALLOWED_KEYS.has(key)) {
      return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });
    }
  }

  const f = {};

  if (q.gender !== undefined) {
    if (!VALID_GENDER.has(q.gender))
      return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });
    f.gender = q.gender;
  }

  if (q.age_group !== undefined) {
    if (!VALID_GROUP.has(q.age_group))
      return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });
    f.age_group = q.age_group;
  }

  if (q.country_id !== undefined) {
    const cid = q.country_id.toUpperCase();
    if (!/^[A-Z]{2}$/.test(cid))
      return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });
    f.country_id = cid;
  }

  const numField = (val, float = false) => {
    if (val === undefined) return undefined;
    const n = float ? parseFloat(val) : parseInt(val, 10);
    return isNaN(n) ? null : n;
  };

  f.min_age  = numField(q.min_age);
  f.max_age  = numField(q.max_age);
  f.min_gender_probability  = numField(q.min_gender_probability,  true);
  f.min_country_probability = numField(q.min_country_probability, true);

  for (const [k, v] of Object.entries(f)) {
    if (v === null)
      return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });
  }

  if (q.sort_by !== undefined) {
    if (!VALID_SORT.has(q.sort_by))
      return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });
    f.sort_by = q.sort_by;
  }

  if (q.order !== undefined) {
    if (!VALID_ORDER.has(q.order.toLowerCase()))
      return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });
    f.order = q.order.toLowerCase();
  }

  const page  = q.page  !== undefined ? parseInt(q.page,  10) : 1;
  const limit = q.limit !== undefined ? parseInt(q.limit, 10) : 10;

  if (isNaN(page) || page < 1)
    return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });
  if (isNaN(limit) || limit < 1 || limit > 50)
    return res.status(422).json({ status: 'error', message: 'Invalid query parameters' });

  f.page  = page;
  f.limit = limit;
  req.filters = f;
  next();
}

module.exports = { validateProfileQuery };
