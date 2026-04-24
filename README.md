# Insighta Labs — Intelligence Query Engine

A Node.js / Express REST API for querying demographic profiles with advanced filtering, sorting, pagination, and natural language search.

---

## Setup & Running Locally

### 1. Install Node.js
Download from [nodejs.org](https://nodejs.org) — version 18 or higher.

### 2. Clone the repo and install dependencies
```bash
git clone https://github.com/your-username/insighta-api.git
cd insighta-api
npm install
```

### 3. Create your .env file
```bash
cp .env.example .env
```
Open `.env` and fill in your database URL:
```
DATABASE_URL=postgresql://user:password@host:5432/dbname
PORT=3000
NODE_ENV=development
```

### 4. Get a free PostgreSQL database (Neon)
1. Go to [neon.tech](https://neon.tech) and sign up free
2. Create a project
3. Copy the connection string — it looks like:
   `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`
4. Remove `?sslmode=require` from the end and paste the rest as your `DATABASE_URL`

### 5. Seed the database
The `data/profiles.json` file is included in the repo.
```bash
npm run seed
```
Expected output:
```
→ 2026 profiles to seed
  → 2026/2026
✓ Done — inserted: 2026, skipped: 0, total in DB: 2026
```

### 6. Start the server
```bash
npm run dev
```
Expected output:
```
✓ Database ready
✓ API running on port 3000
```

### 7. Test it
Open your browser and visit:
- `http://localhost:3000/health`
- `http://localhost:3000/api/profiles`
- `http://localhost:3000/api/profiles?gender=male&country_id=NG`
- `http://localhost:3000/api/profiles/search?q=young males from nigeria`

---

## Deploying to Railway

1. Push code to GitHub (see below)
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Select your repo
4. Click **Add Plugin → PostgreSQL**
5. Railway automatically sets `DATABASE_URL`
6. Add `NODE_ENV=production` in the Variables tab
7. After deploy, seed the live database:
```bash
npm install -g @railway/cli
railway login
railway run npm run seed
```

---

## Endpoints

### GET /api/profiles
Filters, sorts, and paginates profiles.

| Parameter | Type | Description |
|---|---|---|
| gender | string | male or female |
| age_group | string | child, teenager, adult, senior |
| country_id | string | 2-letter ISO code e.g. NG |
| min_age | int | Minimum age |
| max_age | int | Maximum age |
| min_gender_probability | float | 0 to 1 |
| min_country_probability | float | 0 to 1 |
| sort_by | string | age, created_at, gender_probability |
| order | string | asc or desc |
| page | int | default 1 |
| limit | int | default 10, max 50 |

**Example:**
```
GET /api/profiles?gender=male&country_id=NG&min_age=25&sort_by=age&order=desc&page=1&limit=10
```

### GET /api/profiles/search?q=
Natural language search.

**Examples:**
```
GET /api/profiles/search?q=young males from nigeria
GET /api/profiles/search?q=females above 30
GET /api/profiles/search?q=adult males from kenya
```

### GET /api/profiles/:id
Returns a single profile by UUID.

### GET /health
Returns database connection status.

---

## Natural Language Parsing

### How it works
The parser (`src/utils/nlParser.js`) is entirely rule-based — no AI or LLMs. It normalises the query to lowercase, removes punctuation, then applies ordered regex extractions. Each match is consumed before the next rule runs.

### Extraction order
1. `between N and M` → min_age + max_age
2. `above N` / `over N` / `older than N` → min_age
3. `below N` / `under N` / `younger than N` → max_age
4. `aged N` → exact age (sets both min and max)
5. `young` → min_age=16, max_age=24
6. Age group keywords → age_group
7. Gender keywords → gender
8. Country name or demonym → country_id

### Supported keywords

**Gender**
| Words | Filter |
|---|---|
| male, males, man, men, boy, boys | gender=male |
| female, females, woman, women, girl, girls | gender=female |
| male and female, both, everyone | no gender filter |

**Age groups**
| Words | Filter |
|---|---|
| child, children, kid, kids | age_group=child |
| teenager, teenagers, teen, teens | age_group=teenager |
| adult, adults | age_group=adult |
| senior, seniors, elderly, elder | age_group=senior |
| young | min_age=16, max_age=24 |

**Age comparisons**
| Pattern | Filter |
|---|---|
| above 30, over 30 | min_age=30 |
| below 25, under 25 | max_age=25 |
| between 20 and 35 | min_age=20, max_age=35 |
| aged 28 | min_age=28, max_age=28 |

**Countries:** Nigeria (NG), Ghana (GH), Kenya (KE), Angola (AO), Tanzania (TZ), Uganda (UG), Ethiopia (ET), Cameroon (CM), Senegal (SN), South Africa (ZA), and 40+ more including demonyms.

### Example mappings
```
"young males"                        → gender=male, min_age=16, max_age=24
"females above 30"                   → gender=female, min_age=30
"people from angola"                 → country_id=AO
"adult males from kenya"             → gender=male, age_group=adult, country_id=KE
"male and female teenagers above 17" → age_group=teenager, min_age=17
```

---

## Limitations

| Limitation | Detail |
|---|---|
| No negation | "not from nigeria" is not handled |
| No typo correction | "nigria" will not match Nigeria |
| Single age group | "teenagers and adults" only captures first match |
| No French/Portuguese | Only English queries work |
| Bare ISO codes | "people from NG" (ISO code in query) not recognised |
| Ambiguous "old" | Not handled — use "senior" or "elderly" instead |

---

## Architecture

```
insighta-api/
├── data/
│   └── profiles.json        ← 2026 seed profiles
├── scripts/
│   └── seed.js              ← idempotent seed script
├── src/
│   ├── index.js             ← Express app + DB init + server
│   ├── db.js                ← pg connection pool
│   ├── routes/
│   │   └── profiles.js      ← all three endpoints
│   ├── middleware/
│   │   └── validate.js      ← query param validation
│   └── utils/
│       ├── nlParser.js      ← rule-based NL parser
│       └── uuidv7.js        ← UUID v7 generator
├── .env.example
├── .gitignore
├── railway.json
└── README.md
```

## Performance
- 6 B-tree indexes on all filterable columns
- COUNT and SELECT run as parallel Promise.all
- Seed uses batch inserts of 100 rows per transaction
- ON CONFLICT (name) DO NOTHING prevents duplicates on re-seed
