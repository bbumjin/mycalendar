#!/usr/bin/env node
// Apply supabase/migrations/0001_init.sql to the Supabase Postgres database.
// Requires SUPABASE_DB_URL env var (or PG_PASSWORD with the rest of connection info).
//
// Usage:
//   SUPABASE_DB_URL='postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres' \
//     node scripts/apply-migration.mjs

import { readFileSync } from 'node:fs';
import { Client } from 'pg';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('Missing SUPABASE_DB_URL. Use the Supabase dashboard → Project Settings → Database to find the connection string.');
  process.exit(2);
}

const sqlPath = join(__dirname, '..', 'supabase', 'migrations', '0001_init.sql');
const sql = readFileSync(sqlPath, 'utf8');

const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(sql);
  console.log('Migration applied.');
} finally {
  await client.end();
}
