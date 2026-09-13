import { prisma } from '../lib/prisma.js';
import { transitionApplication, ApplicationStatus } from './stateMachine.js';

export async function getEventApplications(eventId: number) {
  const event = await prisma.event.findUnique({ where: { eventId } });
  if (!event) {
    throw Object.assign(new Error(`Event with ID ${eventId} not found`), { status: 404 });
  }

  const applications = await prisma.application.findMany({
    where: { eventId },
    include: {
      talent: true,
      position: true,
      event: true,
    },
    orderBy: { appliedAt: 'desc' },
  });

  const positionIds = applications.map((a) => a.positionId);
  const bookings = await prisma.booking.findMany({
    where: {
      positionId: { in: positionIds },
      status: { not: 'Cancelled' },
    },
  });

  return applications.map((app) => {
    const booking = bookings.find((b) => b.positionId === app.positionId && b.talentId === app.talentId) || null;
    return {
      ...app,
      slotNumber: app.position?.slotNumber ?? null,
      bookingId: booking?.bookingId ?? null,
      bookingStatus: booking?.status ?? null,
    };
  });
}

export interface TransitionApplicationInput {
  status: ApplicationStatus;
  actor?: string;
  note?: string;
}

export async function handleApplicationTransition(
  applicationId: number,
  input: TransitionApplicationInput
) {
  const result = await transitionApplication(prisma, applicationId, input.status, {
    actor: input.actor || 'ops',
    note: input.note || '',
  });

  const booking = await prisma.booking.findFirst({
    where: {
      positionId: result.application.positionId,
      talentId: result.application.talentId,
      status: { not: 'Cancelled' },
    },
  });

  return {
    ...result,
    application: {
      ...result.application,
      slotNumber: result.application.position?.slotNumber ?? null,
      bookingId: booking?.bookingId ?? null,
    },
  };
}
