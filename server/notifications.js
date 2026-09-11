// Notification engine — reacts to pipeline state changes (design doc §3.3/§4.2).
// Owns: confirmation emails, alerts for the priority queue, follow-up escalations.
// In the full build this also syncs Google Sheets staffing counts and real email.

import { loadDb, commit, nextId, now } from './db.js';
import { onTransition, applyTransition } from './stateMachine.js';

export function createNotification({ type, severity, eventId = null, talentId = null, requiredAction = '', assignedTeamMember = 'Kaushal' }) {
  const db = loadDb();
  const n = {
    notificationId: nextId('notification'),
    type, severity, eventId, talentId,
    timestamp: now(),
    assignedTeamMember,
    resolved: false,
    requiredAction,
  };
  db.notifications.push(n);
  commit();
  console.log(`[notification] ${severity.toUpperCase()} ${type} — ${requiredAction}`);
  return n;
}

export function resolveNotification(id) {
  const db = loadDb();
  const n = db.notifications.find((x) => x.notificationId === Number(id));
  if (!n) throw Object.assign(new Error('Notification not found'), { status: 404 });
  n.resolved = true;
  commit();
  return n;
}

function logComm(talentId, content) {
  const db = loadDb();
  db.communicationLogs.push({
    logId: nextId('log'),
    talentId,
    channel: 'email',
    direction: 'out',
    content,
    timestamp: now(),
    teamMember: 'system',
  });
  commit();
}

export function registerEngine() {
  onTransition(({ application, fromStatus, toStatus }) => {
    const db = loadDb();
    const talent = db.talent.find((t) => t.talentId === application.talentId);
    const booking = db.bookings.find(
      (b) => b.positionId === application.positionId && b.talentId === application.talentId,
    );
    const event = db.events.find((e) => e.eventId === application.eventId);

    switch (toStatus) {
      case 'BookedPendingConfirmation': {
        // §3.1 — no payment agreement required ⇒ straight to confirmed (green)
        if (booking && !booking.paymentAgreementRequired) {
          applyTransition(application.applicationId, 'TalentConfirmed', { actor: 'engine', note: 'no payment agreement required' });
        }
        break;
      }

      case 'TalentConfirmed': {
        if (booking) {
          booking.status = 'Confirmed';
          booking.confirmedAt = now();
        }
        // Hub owns the confirmation email (§6 gap table confirms this is by design)
        db.confirmationEmails.push({
          emailId: nextId('email'),
          bookingId: booking?.bookingId ?? null,
          sentAt: now(),
          deliveryStatus: 'sent (stub)',
        });
        if (talent) {
          logComm(talent.talentId, `Booking confirmation — ${event?.program ?? 'event'}, slot ${application.positionId}`);
        }
        commit();
        console.log(`[engine] confirmation email sent for application #${application.applicationId} (sheet sync stubbed)`);
        applyTransition(application.applicationId, 'ConfirmationEmailSent', { actor: 'engine', note: 'confirmation email recorded' });
        break;
      }

      case 'ConfirmationEmailSent': {
        applyTransition(application.applicationId, 'FinalCheckinPending', { actor: 'engine', note: 'awaiting event day' });
        break;
      }

      case 'CheckedIn': {
        if (booking) { booking.status = 'CheckedIn'; commit(); }
        break;
      }

      case 'Completed': {
        if (booking) { booking.status = 'Completed'; commit(); }
        if (talent) { talent.completedJobsCount += 1; commit(); }
        break;
      }

      case 'NoShow': {
        if (booking) { booking.status = 'NoShow'; commit(); }
        if (talent) { talent.noShowCount += 1; commit(); }
        createNotification({
          type: 'shift.no_show', severity: 'high',
          eventId: application.eventId, talentId: application.talentId,
          requiredAction: `${talent?.firstName ?? 'Talent'} ${talent?.lastName ?? ''} no-showed "${event?.program ?? 'event'}" — slot reopened, find a replacement.`,
        });
        applyTransition(application.applicationId, 'ReplacementRequired', { actor: 'engine', note: 'no-show cascade' });
        break;
      }

      case 'ReplacementRequired': {
        createNotification({
          type: 'replacement.required', severity: 'high',
          eventId: application.eventId, talentId: application.talentId,
          requiredAction: `Replacement needed for "${event?.program ?? 'event'}" — slot ${application.positionId} is back in the applicant pool.`,
        });
        break;
      }

      case 'Declined': {
        if (booking) { booking.status = 'Cancelled'; commit(); }
        if (fromStatus === 'BookingSent' || fromStatus === 'BookedPendingConfirmation') {
          createNotification({
            type: 'booking.declined', severity: 'medium',
            eventId: application.eventId, talentId: application.talentId,
            requiredAction: `${talent?.firstName ?? 'Talent'} declined "${event?.program ?? 'event'}" — pick another applicant.`,
          });
        }
        break;
      }

      case 'Cancelled': {
        if (booking) { booking.status = 'Cancelled'; commit(); }
        break;
      }

      default:
        break;
    }
  });
}
