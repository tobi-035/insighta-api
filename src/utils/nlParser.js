'use strict';

const COUNTRY_MAP = {
  nigeria: 'NG', nigerian: 'NG',
  ghana: 'GH', ghanaian: 'GH',
  kenya: 'KE', kenyan: 'KE',
  angola: 'AO', angolan: 'AO',
  tanzania: 'TZ', tanzanian: 'TZ',
  uganda: 'UG', ugandan: 'UG',
  ethiopia: 'ET', ethiopian: 'ET',
  cameroon: 'CM', cameroonian: 'CM',
  senegal: 'SN', senegalese: 'SN',
  mali: 'ML', malian: 'ML',
  togo: 'TG', togolese: 'TG',
  benin: 'BJ', beninese: 'BJ',
  niger: 'NE', nigerien: 'NE',
  chad: 'TD', chadian: 'TD',
  rwanda: 'RW', rwandan: 'RW',
  burundi: 'BI', burundian: 'BI',
  somalia: 'SO', somali: 'SO',
  sudan: 'SD', sudanese: 'SD',
  egypt: 'EG', egyptian: 'EG',
  morocco: 'MA', moroccan: 'MA',
  algeria: 'DZ', algerian: 'DZ',
  tunisia: 'TN', tunisian: 'TN',
  libya: 'LY', libyan: 'LY',
  zambia: 'ZM', zambian: 'ZM',
  zimbabwe: 'ZW', zimbabwean: 'ZW',
  mozambique: 'MZ', mozambican: 'MZ',
  malawi: 'MW', malawian: 'MW',
  botswana: 'BW', botswanan: 'BW',
  namibia: 'NA', namibian: 'NA',
  madagascar: 'MG', malagasy: 'MG',
  guinea: 'GN', guinean: 'GN',
  liberia: 'LR', liberian: 'LR',
  gambia: 'GM', gambian: 'GM',
  gabon: 'GA', gabonese: 'GA',
  congo: 'CG', congolese: 'CG',
  drc: 'CD',
  eritrea: 'ER', eritrean: 'ER',
  lesotho: 'LS', basotho: 'LS',
  eswatini: 'SZ', swaziland: 'SZ',
  mauritius: 'MU', mauritian: 'MU',
  seychelles: 'SC',
  comoros: 'KM',
  djibouti: 'DJ',
  'south africa': 'ZA', 'south african': 'ZA',
  'sierra leone': 'SL',
  'burkina faso': 'BF',
  'cape verde': 'CV', 'cabo verde': 'CV',
  'guinea-bissau': 'GW',
  'ivory coast': 'CI', 'cote divoire': 'CI',
  'equatorial guinea': 'GQ',
  'south sudan': 'SS',
  'dr congo': 'CD', 'democratic republic of congo': 'CD',
  usa: 'US', america: 'US', american: 'US',
  uk: 'GB', britain: 'GB', british: 'GB',
  france: 'FR', french: 'FR',
  germany: 'DE', german: 'DE',
  india: 'IN', indian: 'IN',
  china: 'CN', chinese: 'CN',
  brazil: 'BR', brazilian: 'BR',
  canada: 'CA', canadian: 'CA',
  australia: 'AU', australian: 'AU',
};

const AGE_GROUP_MAP = {
  child: 'child', children: 'child', kid: 'child', kids: 'child',
  teenager: 'teenager', teenagers: 'teenager', teen: 'teenager', teens: 'teenager',
  adult: 'adult', adults: 'adult',
  senior: 'senior', seniors: 'senior', elderly: 'senior', elder: 'senior',
};

const MALE_WORDS   = new Set(['male', 'males', 'man', 'men', 'boy', 'boys']);
const FEMALE_WORDS = new Set(['female', 'females', 'woman', 'women', 'girl', 'girls']);

function parseNLQuery(q) {
  if (!q || typeof q !== 'string' || !q.trim()) return null;

  const text = q.toLowerCase().replace(/[^a-z0-9\s\-]/g, ' ').replace(/\s+/g, ' ').trim();
  const filters = {};
  let work = text;

  // 1. "between N and M"
  const between = work.match(/\bbetween\s+(\d+)\s+and\s+(\d+)\b/);
  if (between) {
    filters.min_age = Math.min(+between[1], +between[2]);
    filters.max_age = Math.max(+between[1], +between[2]);
    work = work.replace(between[0], ' ');
  }

  // 2. above / over / older than
  const above = work.match(/\b(?:above|over|older than|at least)\s+(\d+)\b/);
  if (above) { filters.min_age = +above[1]; work = work.replace(above[0], ' '); }

  // 3. below / under / younger than
  const below = work.match(/\b(?:below|under|younger than|at most)\s+(\d+)\b/);
  if (below) { filters.max_age = +below[1]; work = work.replace(below[0], ' '); }

  // 4. aged N
  const aged = work.match(/\baged?\s+(\d+)\b/);
  if (aged) {
    filters.min_age = +aged[1];
    filters.max_age = +aged[1];
    work = work.replace(aged[0], ' ');
  }

  // 5. "young" → 16-24
  if (/\byoung\b/.test(work)) {
    if (filters.min_age === undefined) filters.min_age = 16;
    if (filters.max_age === undefined) filters.max_age = 24;
    work = work.replace(/\byoung\b/, ' ');
  }

  // 6. age group keywords
  for (const [kw, group] of Object.entries(AGE_GROUP_MAP)) {
    if (new RegExp(`\\b${kw}\\b`).test(work)) {
      filters.age_group = group;
      work = work.replace(new RegExp(`\\b${kw}\\b`), ' ');
      break;
    }
  }

  // 7. gender — check for "male and female" first (no filter)
  const bothGender = /\b(?:male and female|female and male|both|everyone|people)\b/.test(work);
  if (!bothGender) {
    let hasMale = false, hasFemale = false;
    for (const w of work.split(/\s+/)) {
      if (MALE_WORDS.has(w))   hasMale   = true;
      if (FEMALE_WORDS.has(w)) hasFemale = true;
    }
    if (hasMale && !hasFemale)  filters.gender = 'male';
    if (hasFemale && !hasMale)  filters.gender = 'female';
  }

  // 8. country — multi-word first, then single word
  const sortedKeys = Object.keys(COUNTRY_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (work.includes(key)) {
      filters.country_id = COUNTRY_MAP[key];
      work = work.replace(key, ' ');
      break;
    }
  }

  if (Object.keys(filters).length === 0) return null;
  return filters;
}

module.exports = { parseNLQuery };
