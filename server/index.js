import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDb } from './db.js';
import { registerEngine } from './notifications.js';
import { api } from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);

loadDb();          // build/seed the store on boot
registerEngine();  // notification engine subscribes to state-machine transitions

const app = express();
app.use(express.json());

// Internal Hub API (design doc §5.1)
app.use('/hub/v1', api);

// Ops dashboard — swap for the React scaffold (Frontend lane, M1)
app.use(express.static(path.join(__dirname, '..', 'public')));

// JSON error envelope
app.use((err, _req, res, _next) => {
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`LXP Hub MVP running → http://localhost:${PORT}`);
  console.log(`API base: http://localhost:${PORT}/hub/v1 — try GET /hub/v1/dashboard/summary`);
});
