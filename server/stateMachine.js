// Candidate pipeline state machine (design doc §2).
// One universal status per Application, shared across every source.
// Every automation reacts to a state change — never to a platform-specific event.

import { loadDb, commit, now } from './db.js';

export const STATUSES = [
  'Applied', 'Reviewed', 'Selected', 'BookingSent', 'BookedPendingConfirmation',
  'TalentConfirmed', 'ConfirmationEmailSent', 'FinalCheckinPending',
  'CheckedIn', 'ReportingPending', 'Completed',
  'Declined', 'Cancelled', 'ReplacementRequired', 'NoShow',
];

// Legal transitions — mirrors the state diagram.
const TRANSITIONS = {
  Applied: ['Reviewed'],
  Reviewed: ['Selected'],
  Selected: ['BookingSent'],
  BookingSent: ['BookedPendingConfirmation', 'Declined'],
  BookedPendingConfirmation: ['TalentConfirmed', 'Declined'],
  TalentConfirmed: ['ConfirmationEmailSent', 'Cancelled'],
  ConfirmationEmailSent: ['FinalCheckinPending', 'Cancelled'],
  // pragmatic addition: cancelling at the gate is a real ops move
  FinalCheckinPending: ['CheckedIn', 'NoShow', 'Cancelled'],
  CheckedIn: ['ReportingPending'],
  ReportingPending: ['Completed'],
  Declined: [],
  Cancelled: ['ReplacementRequired'],
  ReplacementRequired: ['Selected'], // replacement loops back into selection
  NoShow: ['ReplacementRequired'],
  Completed: [],
};

// Slot state implied by an application reaching a given status.
const POSITION_EFFECT = {
  BookingSent: 'Booked',
  BookedPendingConfirmation: 'Booked',
  TalentConfirmed: 'Confirmed',
  ConfirmationEmailSent: 'Confirmed',
  FinalCheckinPending: 'Confirmed',
  CheckedIn: 'CheckedIn',
  ReportingPending: 'CheckedIn',
  Completed: 'Completed',
  Declined: 'Open',
  Cancelled: 'Open',
  ReplacementRequired: 'Open',
  NoShow: 'Open',
};

// Post-transition side-effect hooks (notification engine registers here).
const handlers = [];
export function onTransition(fn) {
  handlers.push(fn);
}

export function canTransition(fromStatus, toStatus) {
  return (TRANSITIONS[fromStatus] ?? []).includes(toStatus);
}

export function applyTransition(applicationId, toStatus, { actor = 'system', note = '' } = {}) {
  const db = loadDb();
  const application = db.applications.find((a) => a.applicationId === applicationId);
  if (!application) throw Object.assign(new Error('Application not found'), { status: 404 });
  if (application.status === toStatus) return application; // idempotent

  if (!canTransition(application.status, toStatus)) {
    throw Object.assign(
      new Error(`Illegal transition ${application.status} → ${toStatus}`),
      { status: 422, from: application.status, to: toStatus },
    );
  }

  const fromStatus = application.status;
  application.status = toStatus;
  application.statusChangedAt = now();

  db.statusHistory.push({
    historyId: nextHistoryId(db),
    applicationId,
    fromStatus,
    toStatus,
    actor,
    note,
    timestamp: now(),
  });

  // Keep the slot in step with the pipeline.
  const effect = POSITION_EFFECT[toStatus];
  if (effect) {
    const position = db.positions.find((p) => p.positionId === application.positionId);
    if (position) {
      position.status = effect;
      position.assignedTalentId =
        effect === 'Open' ? null : application.talentId;
    }
  }

  commit();
  // `application.<from>_<to}`-style domain event for the notification engine.
  for (const fn of handlers) {
    fn({ application, fromStatus, toStatus, actor, note });
  }
  return application;
}

function nextHistoryId(db) {
  db.sequences.history = (db.sequences.history ?? 0) + 1;
  return db.sequences.history;
}
