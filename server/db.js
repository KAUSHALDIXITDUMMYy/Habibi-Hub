// JSON-file data store — the MVP persistence layer.
// Deliberately behind a small repository boundary so it can be swapped for
// PostgreSQL + migrations (Backend Core lane, M1) without touching routes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSeed } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

let db = null;

export function loadDb() {
  if (db) return db;
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } else {
    db = buildSeed();
    persist();
  }
  return db;
}

export function persist() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// Write-through helper: call after any mutation batch.
export function commit() {
  persist();
  return true;
}

export function resetDb() {
  db = buildSeed();
  persist();
  return db;
}

export function nextId(entity) {
  const d = loadDb();
  d.sequences[entity] = (d.sequences[entity] ?? 0) + 1;
  return d.sequences[entity];
}

export const now = () => new Date().toISOString();
