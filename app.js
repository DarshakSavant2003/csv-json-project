// app.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const { processCsvFile } = require('./csvParser');
const { countTotalUsers, disconnect } = require('./db');

const app = express();

app.use(express.json());

const CSV_PATH = process.env.CSV_PATH || path.join(__dirname, 'data', 'sample.csv');
const PORT = process.env.PORT || 3000;

function computeAgeDistribution(counts) {
  // counts: array of ages (or we can query DB). Here we'll compute from DB counts.
  // This helper will be used after inserting to compute distribution from DB by scanning ages.
  // But to keep it simple we will query DB for counts grouped by ranges.
  // Implementation below in the route.
}

// route to trigger CSV import (useful to call manually)
app.post('/import', async (req, res) => {
  try {
    const filePath = req.body.csvPath || CSV_PATH;
    console.log(`Starting import from ${filePath} ...`);
    const { inserted, skipped, totalLines } = await processCsvFile(filePath, { batchSize: parseInt(process.env.BATCH_SIZE || 1000) });

    // Compute age distribution from DB
    // Query DB grouped into the required four buckets
    const { pool } = require('./db');
    const q = `
      SELECT
        SUM(CASE WHEN age < 20 THEN 1 ELSE 0 END) AS lt20,
        SUM(CASE WHEN age >= 20 AND age <= 40 THEN 1 ELSE 0 END) AS between20_40,
        SUM(CASE WHEN age > 40 AND age <= 60 THEN 1 ELSE 0 END) AS between40_60,
        SUM(CASE WHEN age > 60 THEN 1 ELSE 0 END) AS gt60,
        COUNT(*) AS total
      FROM public.users;
    `;
    const resp = await pool.query(q);
    const row = resp.rows[0];
    const total = parseInt(row.total, 10) || 0;
    const dist = {
      '<20': total ? Math.round((row.lt20 / total) * 100) : 0,
      '20-40': total ? Math.round((row.between20_40 / total) * 100) : 0,
      '40-60': total ? Math.round((row.between40_60 / total) * 100) : 0,
      '>60': total ? Math.round((row.gt60 / total) * 100) : 0
    };

    console.log('Age-Group % Distribution');
    console.log(`< 20 : ${dist['<20']}`);
    console.log(`20 to 40 : ${dist['20-40']}`);
    console.log(`40 to 60 : ${dist['40-60']}`);
    console.log(`> 60 : ${dist['>60']}`);

    res.json({ inserted, skipped, totalLines, dist });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('CSV → JSON importer. POST /import { csvPath (optional) }');
});

const server = app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
  // Optionally auto-run import at startup:
  if (process.env.AUTO_IMPORT && process.env.AUTO_IMPORT.toLowerCase() === 'true') {
    (async () => {
      try {
        console.log('AUTO_IMPORT enabled: starting import at startup.');
        const result = await processCsvFile(CSV_PATH, { batchSize: parseInt(process.env.BATCH_SIZE || 1000) });
        console.log('AUTO_IMPORT result', result);
        // print distribution similarly as in /import
        const { pool } = require('./db');
        const q = `
          SELECT
            SUM(CASE WHEN age < 20 THEN 1 ELSE 0 END) AS lt20,
            SUM(CASE WHEN age >= 20 AND age <= 40 THEN 1 ELSE 0 END) AS between20_40,
            SUM(CASE WHEN age > 40 AND age <= 60 THEN 1 ELSE 0 END) AS between40_60,
            SUM(CASE WHEN age > 60 THEN 1 ELSE 0 END) AS gt60,
            COUNT(*) AS total
          FROM public.users;
        `;
        const resp = await pool.query(q);
        const row = resp.rows[0];
        const total = parseInt(row.total, 10) || 0;
        const dist = {
          '<20': total ? Math.round((row.lt20 / total) * 100) : 0,
          '20-40': total ? Math.round((row.between20_40 / total) * 100) : 0,
          '40-60': total ? Math.round((row.between40_60 / total) * 100) : 0,
          '>60': total ? Math.round((row.gt60 / total) * 100) : 0
        };
        console.log('Age-Group % Distribution');
        console.log(`< 20 : ${dist['<20']}`);
        console.log(`20 to 40 : ${dist['20-40']}`);
        console.log(`40 to 60 : ${dist['40-60']}`);
        console.log(`> 60 : ${dist['>60']}`);
      } catch (e) {
        console.error('AUTO_IMPORT failed', e);
      }
    })();
  }
});

// graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await require('./db').disconnect();
  server.close(() => process.exit(0));
});

module.exports = app;
