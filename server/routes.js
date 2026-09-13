// Internal Hub API (design doc §5.1) + a clearly-marked dev/poller simulator.
// The /dev endpoints stand in for the Integration lane's real watermark poller
// (§4.3) so the operational loop can be exercised without external platforms.

import express from 'express';
import { eventsRouter, positionsRouter } from '../src/routes/eventsRoutes.js';
import { applicationsRouter } from '../src/routes/applicationsRoutes.js';
import { talentRouter } from '../src/routes/talentRoutes.js';
import { bookingsRouter } from '../src/routes/bookingsRoutes.js';
import { dashboardRouter, notificationsRouter, metricsRouter } from '../src/routes/dashboardRoutes.js';
import { platformConfigRouter } from '../src/routes/platformConfigRoutes.js';
import { loadDb, commit, nextId, now, resetDb } from './db.js';
import { STATUSES, applyTransition } from './stateMachine.js';
import { resolveNotification, createNotification } from './notifications.js';
import { postJob, createBooking } from './integrations.js';

export const api = express.Router();

api.use('/events', eventsRouter);
api.use('/positions', positionsRouter);
api.use('/applications', applicationsRouter);
api.use('/talent', talentRouter);
api.use('/bookings', bookingsRouter);
api.use('/dashboard', dashboardRouter);
api.use('/notifications', notificationsRouter);
api.use('/metrics', metricsRouter);
api.use('/platform-config', platformConfigRouter);

const todayStr = () => new Date().toISOString().slice(0, 10);
const num = (v) => Number(v);

function findOrFail(collection, key, id, label) {
  const row = loadDb()[collection].find((r) => r[key] === num(id));
  if (!row) throw Object.assign(new Error(`${label} not found`), { status: 404 });
  return row;
}

function staffingOf(eventId) {
  const db = loadDb();
  const positions = db.positions.filter((p) => p.eventId === num(eventId));
  const filled = positions.filter((p) => ['Booked', 'Confirmed', 'CheckedIn', 'Completed'].includes(p.status)).length;
  return { filled, total: positions.length, pct: positions.length ? Math.round((filled / positions.length) * 100) : 0 };
}

function enrichApplication(a) {
  const db = loadDb();
  const t = db.talent.find((x) => x.talentId === a.talentId) ?? null;
  const p = db.positions.find((x) => x.positionId === a.positionId) ?? null;
  const b = db.bookings.find((x) => x.positionId === a.positionId && x.talentId === a.talentId && x.status !== 'Cancelled') ?? null;
  return { ...a, talent: t && { ...t }, slotNumber: p?.slotNumber ?? null, bookingId: b?.bookingId ?? null };
}

function eventSummary(e) {
  const db = loadDb();
  const maps = db.platformMappings.filter((m) => m.eventId === e.eventId);
  return {
    ...e,
    clientName: db.clients.find((c) => c.companyId === e.companyId)?.companyName ?? null,
    staffing: staffingOf(e.eventId),
    posting: {
      ISDemos: maps.find((m) => m.platform === 'IS-Demos')?.postStatus ?? 'NotPosted',
      PopBookings: maps.find((m) => m.platform === 'PopBookings')?.postStatus ?? 'NotPosted',
      TrustedHerd: maps.find((m) => m.platform === 'TrustedHerd')?.postStatus ?? 'NotPosted',
    },
    openApplicants: db.applications.filter((a) => a.eventId === e.eventId && a.status === 'Applied').length,
  };
}

// ---- reference ------------------------------------------------------------

api.get('/reference', (_req, res) => {
  res.json({ statuses: STATUSES, platforms: ['IS-Demos', 'PopBookings', 'TrustedHerd'] });
});

// ---- dashboard ------------------------------------------------------------

api.get('/dashboard/summary', (_req, res) => {
  const db = loadDb();
  const t = todayStr();
  const todays = db.events.filter((e) => e.eventDate === t && !e.jobCancelled).map(eventSummary);
  const pipeline = {};
  for (const a of db.applications) pipeline[a.status] = (pipeline[a.status] ?? 0) + 1;
  res.json({
    date: t,
    today: todays.map((e) => ({ eventId: e.eventId, program: e.program, city: e.city, startTime: e.startTime, staffing: e.staffing, posting: e.posting })),
    upcoming: db.events.filter((e) => e.eventDate > t && !e.jobCancelled).length,
    openAlerts: db.notifications.filter((n) => !n.resolved).length,
    pipeline,
  });
});

// ---- events ---------------------------------------------------------------

api.get('/events', (req, res) => {
  const db = loadDb();
  const t = todayStr();
  let events = [...db.events];
  const scope = req.query.scope ?? 'all';
  if (scope === 'today') events = events.filter((e) => e.eventDate === t);
  if (scope === 'upcoming') events = events.filter((e) => e.eventDate > t);
  if (scope === 'past') events = events.filter((e) => e.eventDate < t);
  events.sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  res.json(events.map(eventSummary));
});

api.post('/events', (req, res) => {
  const b = req.body ?? {};
  for (const f of ['companyId', 'program', 'eventDate', 'positionsRequired']) {
    if (b[f] === undefined) throw Object.assign(new Error(`Missing field: ${f}`), { status: 400 });
  }
  const db = loadDb();
  const event = {
    eventId: nextId('event'),
    companyId: num(b.companyId),
    program: String(b.program),
    siteNumber: b.siteNumber ?? null,
    address: b.address ?? null, city: b.city ?? null, state: b.state ?? null, zip: b.zip ?? null,
    eventDate: b.eventDate,
    startTime: b.startTime ?? '09:00', endTime: b.endTime ?? '15:00',
    payRate: Number(b.payRate ?? 0),
    positionsRequired: num(b.positionsRequired),
    requirements: b.requirements ?? '', dressCode: b.dressCode ?? '', instructions: b.instructions ?? '',
    jobCancelled: false, createdAt: now(),
  };
  if (event.positionsRequired < 1 || event.positionsRequired > 20) {
    throw Object.assign(new Error('positionsRequired must be 1–20'), { status: 400 });
  }
  db.events.push(event);
  const existing = db.positions.filter((p) => p.eventId === event.eventId).length;
  for (let slot = existing + 1; slot <= event.positionsRequired; slot++) {
    db.positions.push({ positionId: nextId('position'), eventId: event.eventId, slotNumber: slot, status: 'Open', assignedTalentId: null });
  }
  commit();
  res.status(201).json(eventSummary(event));
});

api.get('/events/:id', (req, res) => {
  const event = findOrFail('events', 'eventId', req.params.id, 'Event');
  const db = loadDb();
  const positions = db.positions
    .filter((p) => p.eventId === event.eventId)
    .map((p) => ({
      ...p,
      talent: db.talent.find((t) => t.talentId === p.assignedTalentId) ?? null,
      booking: db.bookings.find((b) => b.positionId === p.positionId && b.status !== 'Cancelled') ?? null,
    }));
  res.json({
    ...eventSummary(event),
    positions,
    applications: db.applications.filter((a) => a.eventId === event.eventId).map(enrichApplication),
  });
});

api.post('/events/:id/post', (req, res) => {
  res.json(postJob(req.params.id, req.body?.platform ? { onlyPlatform: req.body.platform } : {}));
});

api.post('/events/:id/post/retry', (req, res) => {
  const platform = req.body?.platform;
  if (!platform) throw Object.assign(new Error('platform required'), { status: 400 });
  res.json(postJob(req.params.id, { onlyPlatform: platform }));
});

api.post('/events/:id/cancel', (req, res) => {
  const db = loadDb();
  const event = findOrFail('events', 'eventId', req.params.id, 'Event');
  event.jobCancelled = true;
  const affected = [];
  const TERMINAL = ['Completed', 'Declined', 'Cancelled'];
  for (const a of db.applications.filter((a) => a.eventId === event.eventId && !TERMINAL.includes(a.status))) {
    // Event-level cancel is an admin cascade, not a pipeline move — booked
    // applicants exit through Cancelled→ReplacementRequired, early-stage
    // applicants are voided directly with a history entry.
    if (['TalentConfirmed', 'ConfirmationEmailSent', 'FinalCheckinPending'].includes(a.status)) {
      try { applyTransition(a.applicationId, 'Cancelled', { actor: req.body?.actor ?? 'ops', note: 'event cancelled' }); } catch { /* skip */ }
    } else {
      db.statusHistory.push({
        historyId: (db.sequences.history += 1),
        applicationId: a.applicationId, fromStatus: a.status, toStatus: 'Cancelled',
        actor: req.body?.actor ?? 'ops', note: 'event cancelled (cascade)', timestamp: now(),
      });
      a.status = 'Cancelled';
      a.statusChangedAt = now();
    }
    affected.push(a.applicationId);
  }
  for (const p of db.positions.filter((p) => p.eventId === event.eventId)) {
    if (p.status !== 'Completed') { p.status = 'Cancelled'; p.assignedTalentId = null; }
  }
  createNotification({
    type: 'event.cancelled', severity: 'high', eventId: event.eventId,
    requiredAction: `"${event.program}" cancelled — ${affected.length} applicant(s) and all open slots updated.`,
  });
  commit();
  res.json({ ...eventSummary(event), cancelledApplications: affected });
});

// ---- applications (the pipeline) -------------------------------------------

api.get('/events/:id/applications', (req, res) => {
  const event = findOrFail('events', 'eventId', req.params.id, 'Event');
  res.json(loadDb().applications.filter((a) => a.eventId === event.eventId).map(enrichApplication));
});

api.patch('/applications/:id', (req, res) => {
  const to = req.body?.status;
  if (!to) throw Object.assign(new Error('status required'), { status: 400 });
  if (['BookingSent', 'BookedPendingConfirmation', 'TalentConfirmed', 'ConfirmationEmailSent', 'FinalCheckinPending'].includes(to)) {
    throw Object.assign(new Error(`${to} is reached via POST /bookings or the platform sync, not manually`), { status: 422 });
  }
  const app = applyTransition(num(req.params.id), to, { actor: req.body?.actor ?? 'ops', note: req.body?.note ?? '' });
  res.json(enrichApplication(app));
});

// ---- bookings (§4.2 — wraps the IS-Demos call) ------------------------------

api.post('/bookings', (req, res) => {
  const applicationId = num(req.body?.applicationId);
  const db = loadDb();
  const app = findOrFail('applications', 'applicationId', applicationId, 'Application');
  if (!['Selected', 'ReplacementRequired'].includes(app.status)) {
    throw Object.assign(new Error(`Application must be Selected (or ReplacementRequired→Selected) before booking; current: ${app.status}`), { status: 422 });
  }
  let position = findOrFail('positions', 'positionId', app.positionId, 'Position');
  if (position.status !== 'Open') {
    // The slot they applied to got filled — ops books them onto another open slot.
    const db = loadDb();
    const openSlot = db.positions.find((p) => p.eventId === app.eventId && p.status === 'Open');
    if (!openSlot) {
      throw Object.assign(new Error(`Slot ${position.slotNumber} is ${position.status} and no other open slots remain`), { status: 422 });
    }
    app.positionId = openSlot.positionId;
    position = openSlot;
  }
  if (app.status === 'ReplacementRequired') {
    applyTransition(applicationId, 'Selected', { actor: 'ops', note: 're-selected as replacement' });
  }
  const booking = createBooking({ positionId: app.positionId, talentId: app.talentId });
  applyTransition(applicationId, 'BookingSent', { actor: req.body?.actor ?? 'ops', note: `booking ${booking.externalBookingId} sent via IS-Demos` });
  res.status(201).json(booking);
});

api.delete('/bookings/:id', (req, res) => {
  const booking = findOrFail('bookings', 'bookingId', req.params.id, 'Booking');
  const db = loadDb();
  const app = db.applications.find(
    (a) => a.positionId === booking.positionId && a.talentId === booking.talentId &&
      !['Declined', 'Cancelled', 'Completed', 'NoShow'].includes(a.status),
  );
  if (app) {
    applyTransition(app.applicationId, 'Cancelled', { actor: req.body?.actor ?? 'ops', note: 'booking unassigned' });
    applyTransition(app.applicationId, 'ReplacementRequired', { actor: 'ops', note: 'slot reopened' });
  }
  booking.status = 'Cancelled';
  commit();
  res.json(booking);
});

// ---- talent -----------------------------------------------------------------

api.get('/talent', (req, res) => {
  const q = String(req.query.query ?? '').toLowerCase().trim();
  let rows = loadDb().talent;
  if (q) {
    rows = rows.filter((t) =>
      [t.firstName, t.lastName, t.email, t.homeMarket, t.source].join(' ').toLowerCase().includes(q));
  }
  res.json(rows.sort((a, b) => b.completedJobsCount - a.completedJobsCount));
});

api.post('/talent', (req, res) => {
  const b = req.body ?? {};
  const db = loadDb();
  const dupe = db.talent.find((t) => (b.email && t.email === b.email) || (b.phone && t.phone === b.phone));
  if (dupe) return res.status(200).json({ ...dupe, deduplicated: true });
  const t = {
    talentId: nextId('talent'),
    firstName: b.firstName ?? '', lastName: b.lastName ?? '',
    email: b.email ?? null, phone: b.phone ?? null,
    homeMarket: b.homeMarket ?? null, latitude: null, longitude: null,
    source: b.source ?? 'Internal DB', pbProfileUrl: null, thProfileUrl: null, isDemosStaffId: null,
    noShowCount: 0, completedJobsCount: 0, notes: b.notes ?? '',
    lastContactedAt: null, paymentAgreementRequired: Boolean(b.paymentAgreementRequired), active: true,
  };
  db.talent.push(t);
  commit();
  res.status(201).json(t);
});

api.get('/talent/:id', (req, res) => {
  const t = findOrFail('talent', 'talentId', req.params.id, 'Talent');
  const db = loadDb();
  res.json({
    ...t,
    applications: db.applications.filter((a) => a.talentId === t.talentId).map(enrichApplication),
    bookings: db.bookings.filter((b) => b.talentId === t.talentId),
    communications: db.communicationLogs.filter((c) => c.talentId === t.talentId),
  });
});

// ---- notifications (priority queue) -----------------------------------------

api.get('/notifications', (req, res) => {
  const status = req.query.status;
  let rows = [...loadDb().notifications].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  if (status === 'unresolved') rows = rows.filter((n) => !n.resolved);
  if (status === 'resolved') rows = rows.filter((n) => n.resolved);
  const db = loadDb();
  res.json(rows.map((n) => ({
    ...n,
    eventProgram: db.events.find((e) => e.eventId === n.eventId)?.program ?? null,
    talentName: (() => { const t = db.talent.find((x) => x.talentId === n.talentId); return t ? `${t.firstName} ${t.lastName}` : null; })(),
  })));
});

api.patch('/notifications/:id/resolve', (req, res) => {
  res.json(resolveNotification(req.params.id));
});

// ---- DEV ONLY: poller + platform simulator (§3.4/§4.3 stand-in) --------------

const dev = express.Router();
api.use('/dev', dev);

dev.post('/apply', (req, res) => {
  // Simulates applicants flowing in from PB/TH/internal after a job is posted.
  const db = loadDb();
  const event = findOrFail('events', 'eventId', req.body?.eventId, 'Event');
  const already = new Set(db.applications.filter((a) => a.eventId === event.eventId).map((a) => a.talentId));
  const pool = db.talent.filter((t) => t.active && !already.has(t.talentId));
  const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 3));
  const openPositions = db.positions.filter((p) => p.eventId === event.eventId && p.status === 'Open');
  const created = [];
  shuffled.forEach((t, i) => {
    const position = openPositions[i % Math.max(openPositions.length, 1)] ?? db.positions.find((p) => p.eventId === event.eventId);
    const source = ['PopBookings', 'TrustedHerd', 'Internal DB'][Math.floor(Math.random() * 3)];
    const a = {
      applicationId: nextId('application'), eventId: event.eventId,
      positionId: position.positionId, talentId: t.talentId,
      platformSource: source,
      externalApplicationId: source === 'Internal DB' ? null : `${source.slice(0, 2)}-a-${900 + nextId('application')}`,
      status: 'Applied', appliedAt: now(), statusChangedAt: now(),
    };
    db.applications.push(a);
    created.push(enrichApplication(a));
  });
  commit();
  res.status(201).json(created);
});

function bookingContext(bookingId) {
  const booking = findOrFail('bookings', 'bookingId', bookingId, 'Booking');
  const db = loadDb();
  const app = db.applications.find(
    (a) => a.positionId === booking.positionId && a.talentId === booking.talentId &&
      !['Declined', 'Cancelled', 'Completed', 'NoShow'].includes(a.status));
  if (!app) throw Object.assign(new Error('No active application for this booking'), { status: 422 });
  return { booking, app };
}

dev.post('/talent-responds', (req, res) => {
  // Simulates the poller seeing demonstratorAccepted / a decline on the platform.
  const { booking, app } = bookingContext(req.body?.bookingId);
  if (req.body?.accept) {
    if (!['BookingSent'].includes(app.status)) throw Object.assign(new Error(`Application is ${app.status}, expected BookingSent`), { status: 422 });
    applyTransition(app.applicationId, 'BookedPendingConfirmation', { actor: 'poller', note: 'talent accepted on platform' });
  } else {
    applyTransition(app.applicationId, 'Declined', { actor: 'poller', note: 'talent declined on platform' });
  }
  res.json(enrichApplication(app));
});

dev.post('/payment-agreement', (req, res) => {
  const { booking, app } = bookingContext(req.body?.bookingId);
  if (app.status !== 'BookedPendingConfirmation') throw Object.assign(new Error(`Application is ${app.status}, expected BookedPendingConfirmation`), { status: 422 });
  booking.paymentAgreementAccepted = true;
  commit();
  applyTransition(app.applicationId, 'TalentConfirmed', { actor: 'poller', note: 'payment agreement completed on PopBookings' });
  res.json(enrichApplication(app));
});

dev.post('/check-in', (req, res) => {
  // Poller sees workCompleted → true
  const { app } = bookingContext(req.body?.bookingId);
  applyTransition(app.applicationId, 'CheckedIn', { actor: 'poller', note: 'workCompleted=true observed' });
  res.json(enrichApplication(app));
});

dev.post('/no-show', (req, res) => {
  const { app } = bookingContext(req.body?.bookingId);
  applyTransition(app.applicationId, 'NoShow', { actor: 'poller', note: 'shift start passed, no check-in' });
  res.json(enrichApplication(app));
});

dev.post('/report', (req, res) => {
  const { app } = bookingContext(req.body?.bookingId);
  if (app.status === 'CheckedIn') applyTransition(app.applicationId, 'ReportingPending', { actor: 'poller', note: 'shift completed' });
  const fresh = loadDb().applications.find((a) => a.applicationId === app.applicationId);
  applyTransition(app.applicationId, 'Completed', { actor: 'poller', note: 'report submitted on IS-Demos' });
  res.json(enrichApplication(fresh));
});

dev.post('/day-passed', (req, res) => {
  // The §4.3 loop: diff stored shift state, raise alerts for missing check-ins / reports.
  const db = loadDb();
  const event = findOrFail('events', 'eventId', req.body?.eventId, 'Event');
  const fired = [];
  for (const a of db.applications.filter((x) => x.eventId === event.eventId)) {
    if (a.status === 'FinalCheckinPending' && !db.notifications.some((n) => !n.resolved && n.type === 'shift.checkin_missing' && n.eventId === event.eventId && n.talentId === a.talentId)) {
      const t = db.talent.find((x) => x.talentId === a.talentId);
      createNotification({
        type: 'shift.checkin_missing', severity: 'high', eventId: event.eventId, talentId: a.talentId,
        requiredAction: `${t?.firstName ?? 'Talent'} has not checked in for "${event.program}" — call/text now.`,
      });
      fired.push(`checkin_missing:${a.applicationId}`);
    } else if (a.status === 'CheckedIn') {
      applyTransition(a.applicationId, 'ReportingPending', { actor: 'poller', note: 'shift window ended' });
      fired.push(`reporting_pending:${a.applicationId}`);
    } else if (a.status === 'ReportingPending' && !db.notifications.some((n) => !n.resolved && n.type === 'reporting.required' && n.eventId === event.eventId && n.talentId === a.talentId)) {
      const t = db.talent.find((x) => x.talentId === a.talentId);
      createNotification({
        type: 'reporting.required', severity: 'medium', eventId: event.eventId, talentId: a.talentId,
        requiredAction: `Report not submitted by ${t?.firstName ?? 'talent'} for "${event.program}".`,
      });
      fired.push(`reporting_required:${a.applicationId}`);
    }
  }
  res.json({ eventId: event.eventId, fired });
});

dev.post('/reset', (_req, res) => {
  resetDb();
  res.json({ ok: true, note: 'database reseeded' });
});
