// db.js
console.log('PG_PASSWORD:', process.env.PG_PASSWORD);

const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const pool = new Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT ? parseInt(process.env.PG_PORT) : 5432,
  database: process.env.PG_DATABASE,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  // optional: increase pool size for concurrency
  max: 20
});

async function insertUsersBatch(rows) {
  // rows: array of objects { name, age, address (object|null), additional_info (object|null) }
  if (!rows || rows.length === 0) return;

  const columns = ['"name"', 'age', 'address', 'additional_info'];

  // build parameterized multi-row insert
  // INSERT INTO users ("name", age, address, additional_info) VALUES ($1,$2,$3,$4),($5,$6,$7,$8),...
  const values = [];
  const valuePlaceholders = rows.map((r, i) => {
    const base = i * 4;
    values.push(r.name);
    values.push(r.age);
    values.push(r.address ? JSON.stringify(r.address) : null);
    values.push(r.additional_info ? JSON.stringify(r.additional_info) : null);
    return `($${base + 1}, $${base + 2}, $${base + 3}::jsonb, $${base + 4}::jsonb)`;
  }).join(',');

  const query = `INSERT INTO public.users (${columns.join(',')}) VALUES ${valuePlaceholders};`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(query, values);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function countTotalUsers() {
  const res = await pool.query('SELECT count(*)::int as cnt FROM public.users');
  return res.rows[0].cnt;
}

async function disconnect() {
  await pool.end();
}

module.exports = {
  insertUsersBatch,
  countTotalUsers,
  disconnect,
  pool
};
