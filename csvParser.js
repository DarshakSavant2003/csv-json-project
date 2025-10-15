// csvParser.js
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { insertUsersBatch } = require('./db');

const DEFAULT_BATCH_SIZE = process.env.BATCH_SIZE ? parseInt(process.env.BATCH_SIZE) : 1000;

/**
 * Parse a CSV line to an array of fields supporting quoted fields and escaped quotes.
 * RFC4180-ish parser (handles "value, with, commas" and double quotes "")
 */
function parseCsvLine(line) {
  const fields = [];
  let i = 0;
  const N = line.length;
  while (i < N) {
    let ch = line[i];
    if (ch === '"') {
      // quoted field
      i++;
      let field = '';
      while (i < N) {
        if (line[i] === '"') {
          // if next is also a quote -> escaped quote
          if (i + 1 < N && line[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          } else {
            // end of quoted field
            i++;
            break;
          }
        } else {
          field += line[i];
          i++;
        }
      }
      // skip spaces until comma or EOL
      while (i < N && line[i] !== ',') {
        if (/\s/.test(line[i])) i++;
        else i++;
      }
      fields.push(field);
      if (i < N && line[i] === ',') i++;
    } else {
      // unquoted field
      let start = i;
      while (i < N && line[i] !== ',') i++;
      let field = line.slice(start, i).trim();
      fields.push(field);
      if (i < N && line[i] === ',') i++;
    }
  }
  return fields;
}

function setNested(obj, pathArr, value) {
  let cur = obj;
  for (let i = 0; i < pathArr.length; i++) {
    const key = pathArr[i];
    if (i === pathArr.length - 1) {
      cur[key] = value;
    } else {
      if (cur[key] === undefined || typeof cur[key] !== 'object' || cur[key] === null) {
        cur[key] = {};
      }
      cur = cur[key];
    }
  }
}

/**
 * Given headers array and values array, returns row object:
 * { name, age, address (object|null), additional_info (object|null) }
 */
function mapRow(headers, values) {
  const rowVals = headers.map((_, idx) => (idx < values.length ? values[idx] : ''));

  const address = {};
  const additional_info = {};
  let firstName = null;
  let lastName = null;
  let age = null;

  for (let i = 0; i < headers.length; i++) {
    const rawHeader = headers[i].trim();
    if (rawHeader === '') continue;
    const valRaw = rowVals[i] === undefined ? '' : rowVals[i].trim();
    const val = valRaw === '' ? null : coerceValue(valRaw);

    if (rawHeader === 'name.firstName') {
      firstName = val ? String(val) : '';
    } else if (rawHeader === 'name.lastName') {
      lastName = val ? String(val) : '';
    } else if (rawHeader === 'age') {
      if (val === null) {
        age = null;
      } else {
        const parsed = parseInt(val, 10);
        age = Number.isNaN(parsed) ? null : parsed;
      }
    } else if (rawHeader.startsWith('address.')) {
      const path = rawHeader.split('.').slice(1);
      setNested(address, path, val);
    } else {
      if (rawHeader.includes('.')) {
        const path = rawHeader.split('.');
        setNested(additional_info, path, val);
      } else {
        additional_info[rawHeader] = val;
      }
    }
  }

  if ((firstName === null || lastName === null || age === null) || firstName === undefined || lastName === undefined) {
    return null;
  }

  const name = `${String(firstName).trim()} ${String(lastName).trim()}`.trim();

  return {
    name,
    age,
    address: Object.keys(address).length ? address : null,
    additional_info: Object.keys(additional_info).length ? additional_info : null
  };
}

function coerceValue(s) {
  if (s === null) return null;
  if (s === '') return null;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
  const low = s.toLowerCase();
  if (low === 'true') return true;
  if (low === 'false') return false;
  return s;
}

/**
 * Main streaming function to process CSV file
 * Also exports all parsed data to data/converted.json
 */
async function processCsvFile(filePath, options = {}) {
  const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
  if (!fs.existsSync(filePath)) throw new Error(`CSV file not found: ${filePath}`);

  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let headers = null;
  let batch = [];
  let inserted = 0;
  let skipped = 0;
  let totalLines = 0;
  const allRows = []; // store parsed rows for JSON export

  for await (const rawLine of rl) {
    const line = rawLine.replace(/\r$/, '');
    if (line.trim() === '') continue;

    if (!headers) {
      headers = parseCsvLine(line).map(h => h.trim());
      continue;
    }

    totalLines++;
    const values = parseCsvLine(line);
    const mapped = mapRow(headers, values);
    if (mapped === null) {
      skipped++;
      continue;
    }

    allRows.push(mapped); // ✅ collect for JSON
    batch.push(mapped);

    if (batch.length >= batchSize) {
      await insertUsersBatch(batch);
      inserted += batch.length;
      batch = [];
    }
  }

  if (batch.length > 0) {
    await insertUsersBatch(batch);
    inserted += batch.length;
  }

  // ✅ SAVE JSON FILE
  try {
    const outputDir = path.join(__dirname, 'data');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonOutputPath = path.join(outputDir, `converted_${timestamp}.json`);
    fs.writeFileSync(jsonOutputPath, JSON.stringify(allRows, null, 2), 'utf8');
    console.log(`✅ Converted JSON saved to: ${jsonOutputPath}`);
  } catch (err) {
    console.error('❌ Error saving JSON file:', err);
  }

  return { inserted, skipped, totalLines };
}

module.exports = {
  processCsvFile,
  parseCsvLine,
  mapRow
};
