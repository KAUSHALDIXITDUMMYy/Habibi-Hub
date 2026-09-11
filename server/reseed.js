import { resetDb } from './db.js';

const db = resetDb();
console.log(`Reseeded: ${db.events.length} events, ${db.applications.length} applications, ${db.notifications.length} notifications.`);
