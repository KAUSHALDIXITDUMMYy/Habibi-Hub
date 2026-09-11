// Stub platform integrations (design doc §4.1, §5.2).
// These mimic the real contracts so the operational loop works end-to-end:
//   - IS-Demos: REST API (documented) — POST /jobs, POST /bookings
//   - PopBookings / TrustedHerd: session-based, spec pending (§6)
// The Integration lane replaces these with real clients; everything else
// in the Hub talks only to this module.

import { loadDb, commit, nextId, now } from './db.js';
import { createNotification } from './notifications.js';

const PLATFORMS = ['IS-Demos', 'PopBookings', 'TrustedHerd'];

// --- stub adapters ---------------------------------------------------------

const isDemos = {
  name: 'IS-Demos',
  // POST /api/v1/jobs — job + states + chains + shifts in one call
  postJob(event) {
    return { ok: true, externalId: `job-${92800 + event.eventId}`, detail: '201 Created, shifts[] returned' };
  },
  // POST /api/v1/bookings {shiftId, staffId} — a booking is a shift with a staffId
  createBooking({ shiftId, staffId }) {
    return { ok: true, bookingId: 73100 + shiftId, detail: `201 bookingId for staff ${staffId}` };
  },
};

const popbookings = {
  name: 'PopBookings',
  postJob(event) {
    return { ok: true, externalId: String(73900 + event.eventId), detail: 'session publish ok' };
  },
};

// TrustedHerd is the deliberately unreliable one — fails on first attempt,
// succeeds on retry. Exists to demo the "retry failed platform ONLY" rule (§5.3).
const trustedHerd = {
  name: 'TrustedHerd',
  postJob(event, retryCount) {
    if (retryCount === 0) {
      return { ok: false, externalId: null, detail: 'session expired mid-publish' };
    }
    return { ok: true, externalId: String(18200 + event.eventId), detail: 'retried publish ok' };
  },
};

const adapters = { 'IS-Demos': isDemos, PopBookings: popbookings, TrustedHerd: trustedHerd };

// --- POST JOB orchestrator (§4.1) ------------------------------------------

export function postJob(eventId, { onlyPlatform = null } = {}) {
  const db = loadDb();
  const event = db.events.find((e) => e.eventId === Number(eventId));
  if (!event) throw Object.assign(new Error('Event not found'), { status: 404 });
  if (event.jobCancelled) throw Object.assign(new Error('Event is cancelled'), { status: 422 });

  const results = [];
  for (const platform of PLATFORMS) {
    if (onlyPlatform && platform !== onlyPlatform) continue;

    let mapping = db.platformMappings.find((m) => m.eventId === event.eventId && m.platform === platform);
    if (mapping?.postStatus === 'Posted') {
      results.push({ platform, status: 'Posted', externalId: mapping.externalId, detail: 'already posted — skipped' });
      continue; // never re-post a platform that already succeeded
    }
    if (!mapping) {
      mapping = { mappingId: nextId('mapping'), eventId: event.eventId, platform, externalId: null, postStatus: 'Pending', lastSyncedAt: now(), retryCount: 0 };
      db.platformMappings.push(mapping);
    }

    const res = adapters[platform].postJob(event, mapping.retryCount);
    mapping.retryCount += 1;
    mapping.lastSyncedAt = now();
    mapping.postStatus = res.ok ? 'Posted' : 'Failed';
    if (res.ok) mapping.externalId = res.externalId;
    results.push({ platform, status: mapping.postStatus, externalId: mapping.externalId, detail: res.detail });

    if (!res.ok) {
      const alreadyAlerted = db.notifications.some(
        (n) => !n.resolved && n.type === 'platform.post_failed' && n.eventId === event.eventId,
      );
      if (!alreadyAlerted) {
        createNotification({
          type: 'platform.post_failed', severity: 'medium',
          eventId: event.eventId, talentId: null, assignedTeamMember: 'Abhay',
          requiredAction: `${platform} posting failed for "${event.program}" — retry that platform only.`,
        });
      }
    }
  }
  commit();
  return results;
}

// --- booking (§4.2) ---------------------------------------------------------

export function createBooking({ positionId, talentId }) {
  const db = loadDb();
  const talent = db.talent.find((t) => t.talentId === talentId);
  if (!talent) throw Object.assign(new Error('Talent not found'), { status: 404 });

  // Resolve IS-Demos staffId (GET /staff/by-email in the real client)
  const staffId = talent.isDemosStaffId ?? 4000 + talent.talentId;
  const res = isDemos.createBooking({ shiftId: 73000 + positionId, staffId });
  if (!res.ok) throw Object.assign(new Error('IS-Demos booking failed'), { status: 502 });

  const booking = {
    bookingId: nextId('booking'),
    positionId,
    talentId,
    isDemosShiftId: res.bookingId,
    externalBookingId: String(res.bookingId),
    status: 'Sent',
    paymentAgreementRequired: Boolean(talent.paymentAgreementRequired),
    paymentAgreementAccepted: false,
    confirmedAt: null,
  };
  db.bookings.push(booking);
  commit();
  return booking;
}
