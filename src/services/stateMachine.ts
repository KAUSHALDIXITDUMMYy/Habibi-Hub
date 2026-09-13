import { PrismaClient, Prisma } from '@prisma/client';
import { eventBus } from '../events/eventBus.js';

export type ApplicationStatus =
  | 'Applied'
  | 'Reviewed'
  | 'Selected'
  | 'BookingSent'
  | 'BookedPendingConfirmation'
  | 'TalentConfirmed'
  | 'ConfirmationEmailSent'
  | 'FinalCheckinPending'
  | 'CheckedIn'
  | 'ReportingPending'
  | 'Completed'
  | 'Declined'
  | 'Cancelled'
  | 'ReplacementRequired'
  | 'NoShow';

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'Applied',
  'Reviewed',
  'Selected',
  'BookingSent',
  'BookedPendingConfirmation',
  'TalentConfirmed',
  'ConfirmationEmailSent',
  'FinalCheckinPending',
  'CheckedIn',
  'ReportingPending',
  'Completed',
  'Declined',
  'Cancelled',
  'ReplacementRequired',
  'NoShow',
];

// Legal transition matrix matching Design Document §2
export const TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  Applied: ['Reviewed'],
  Reviewed: ['Selected'],
  Selected: ['BookingSent'],
  BookingSent: ['BookedPendingConfirmation', 'Declined'],
  BookedPendingConfirmation: ['TalentConfirmed', 'Declined'],
  TalentConfirmed: ['ConfirmationEmailSent', 'Cancelled'],
  ConfirmationEmailSent: ['FinalCheckinPending', 'Cancelled'],
  FinalCheckinPending: ['CheckedIn', 'NoShow', 'Cancelled'],
  CheckedIn: ['ReportingPending'],
  ReportingPending: ['Completed'],
  Declined: [],
  Cancelled: ['ReplacementRequired'],
  ReplacementRequired: ['Selected'],
  NoShow: ['ReplacementRequired'],
  Completed: [],
};

// Implied position slot status based on application state
export const POSITION_EFFECT: Partial<Record<ApplicationStatus, string>> = {
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

export class IllegalStateTransitionError extends Error {
  public readonly status = 422;
  constructor(public fromStatus: string, public toStatus: string) {
    super(`Illegal state transition from '${fromStatus}' to '${toStatus}'`);
    this.name = 'IllegalStateTransitionError';
  }
}

export class ApplicationNotFoundError extends Error {
  public readonly status = 404;
  constructor(public applicationId: number) {
    super(`Application with ID ${applicationId} not found`);
    this.name = 'ApplicationNotFoundError';
  }
}

export interface TransitionOptions {
  actor?: string;
  note?: string;
}

export function canTransition(fromStatus: ApplicationStatus, toStatus: ApplicationStatus): boolean {
  const allowed = TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

/**
 * Executes a pipeline status transition atomically within a database transaction.
 */
export async function transitionApplication(
  client: PrismaClient | Prisma.TransactionClient,
  applicationId: number,
  toStatus: ApplicationStatus,
  options: TransitionOptions = {}
) {
  if ('$transaction' in client) {
    return (client as PrismaClient).$transaction((tx) =>
      executeTransition(tx, applicationId, toStatus, options)
    );
  }
  return executeTransition(client, applicationId, toStatus, options);
}

async function executeTransition(
  tx: Prisma.TransactionClient,
  applicationId: number,
  toStatus: ApplicationStatus,
  options: TransitionOptions = {}
) {
  const actor = options.actor || 'system';
  const note = options.note || '';

  const application = await tx.application.findUnique({
    where: { applicationId },
    include: { position: true, talent: true, event: true }
  });

  if (!application) {
    throw new ApplicationNotFoundError(applicationId);
  }

  const fromStatus = application.status as ApplicationStatus;

  // Idempotent guard
  if (fromStatus === toStatus) {
    return {
      application,
      fromStatus,
      toStatus,
      actor,
      note
    };
  }

  // Validate transition legality
  if (!canTransition(fromStatus, toStatus)) {
    throw new IllegalStateTransitionError(fromStatus, toStatus);
  }

  const effect = POSITION_EFFECT[toStatus];

  // Perform atomic updates in transaction
  const updatedApplication = await tx.application.update({
    where: { applicationId },
    data: {
      status: toStatus,
      statusChangedAt: new Date(),
    },
    include: {
      position: true,
      talent: true,
      event: true
    }
  });

  // Update associated Position slot state if applicable
  if (effect && application.positionId) {
    await tx.position.update({
      where: { positionId: application.positionId },
      data: {
        status: effect,
        assignedTalentId: effect === 'Open' ? null : application.talentId,
      }
    });
  }

  // Emit domain events on status changes
  eventBus.emitDomainEvent('application.status_changed', {
    application: updatedApplication,
    fromStatus,
    toStatus,
    actor,
    note
  });

  const payload = {
    applicationId: updatedApplication.applicationId,
    eventId: updatedApplication.eventId,
    talentId: updatedApplication.talentId,
    positionId: updatedApplication.positionId,
  };

  if (toStatus === 'TalentConfirmed') {
    eventBus.emitDomainEvent('application.talent_confirmed', payload);
  } else if (toStatus === 'Declined') {
    eventBus.emitDomainEvent('application.declined', payload);
  } else if (toStatus === 'CheckedIn') {
    eventBus.emitDomainEvent('shift.checked_in', payload);
  } else if (toStatus === 'NoShow') {
    eventBus.emitDomainEvent('shift.no_show', payload);
  } else if (toStatus === 'ReplacementRequired') {
    eventBus.emitDomainEvent('position.replacement_required', {
      eventId: updatedApplication.eventId,
      positionId: updatedApplication.positionId,
      previousTalentId: updatedApplication.talentId,
    });
  }

  return {
    application: updatedApplication,
    fromStatus,
    toStatus,
    actor,
    note
  };
}
