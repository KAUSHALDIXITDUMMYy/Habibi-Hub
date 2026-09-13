import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';

export interface ListEventsQuery {
  status?: string;
  scope?: 'today' | 'upcoming' | 'past' | 'all';
  clientId?: number;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export function calculateStaffing(positions: { status: string }[]) {
  const total = positions.length;
  const filled = positions.filter((p) =>
    ['Booked', 'Confirmed', 'CheckedIn', 'Completed'].includes(p.status)
  ).length;
  const percentage = total > 0 ? Math.round((filled / total) * 100) : 0;
  return { filled, total, percentage };
}

export async function listEvents(query: ListEventsQuery) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.max(1, Math.min(100, query.limit || 20));
  const skip = (page - 1) * limit;

  const where: Prisma.EventWhereInput = {};

  if (query.clientId) {
    where.companyId = query.clientId;
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDate = new Date(todayStr);

  if (query.scope === 'today') {
    const tomorrow = new Date(todayDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    where.eventDate = { gte: todayDate, lt: tomorrow };
  } else if (query.scope === 'upcoming') {
    const tomorrow = new Date(todayDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    where.eventDate = { gte: tomorrow };
  } else if (query.scope === 'past') {
    where.eventDate = { lt: todayDate };
  }

  if (query.startDate || query.endDate) {
    where.eventDate = {
      ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
      ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
    };
  }

  if (query.status === 'Cancelled') {
    where.jobCancelled = true;
  } else if (query.status === 'Active') {
    where.jobCancelled = false;
  }

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      skip,
      take: limit,
      orderBy: { eventDate: 'asc' },
      include: {
        client: true,
        positions: true,
        platformMappings: true,
      },
    }),
    prisma.event.count({ where }),
  ]);

  const data = events.map((event) => {
    const staffing = calculateStaffing(event.positions);
    return {
      ...event,
      clientName: event.client?.companyName ?? null,
      staffing,
      staffingPercentage: staffing.percentage,
      posting: {
        ISDemos: event.platformMappings.find((m) => m.platform === 'isdemos')?.postStatus ?? 'NotPosted',
        PopBookings: event.platformMappings.find((m) => m.platform === 'popbookings')?.postStatus ?? 'NotPosted',
        TrustedHerd: event.platformMappings.find((m) => m.platform === 'trustedherd')?.postStatus ?? 'NotPosted',
      },
    };
  });

  return { data, total, page, limit };
}

export interface CreateEventInput {
  companyId: number;
  program: string;
  siteNumber?: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  payRate: number;
  positionsRequired: number;
  requirements?: string;
  dressCode?: string;
  instructions?: string;
}

export async function createEvent(input: CreateEventInput) {
  if (input.positionsRequired < 1 || input.positionsRequired > 50) {
    throw Object.assign(new Error('positionsRequired must be between 1 and 50'), { status: 400 });
  }

  return prisma.$transaction(async (tx) => {
    const event = await tx.event.create({
      data: {
        companyId: input.companyId,
        program: input.program,
        siteNumber: input.siteNumber || 'MAIN',
        address: input.address,
        city: input.city,
        state: input.state,
        zip: input.zip,
        eventDate: new Date(input.eventDate),
        startTime: input.startTime,
        endTime: input.endTime,
        payRate: input.payRate,
        positionsRequired: input.positionsRequired,
        requirements: input.requirements || null,
        dressCode: input.dressCode || null,
        instructions: input.instructions || null,
      },
      include: {
        client: true,
      },
    });

    const positionData = [];
    for (let slot = 1; slot <= input.positionsRequired; slot++) {
      positionData.push({
        eventId: event.eventId,
        slotNumber: slot,
        status: 'Open',
        assignedTalentId: null,
      });
    }

    await tx.position.createMany({
      data: positionData,
    });

    const positions = await tx.position.findMany({
      where: { eventId: event.eventId },
    });

    const staffing = calculateStaffing(positions);

    return {
      ...event,
      clientName: event.client?.companyName ?? null,
      positions,
      staffing,
      staffingPercentage: staffing.percentage,
    };
  });
}

export async function getEventById(eventId: number) {
  const event = await prisma.event.findUnique({
    where: { eventId },
    include: {
      client: true,
      positions: {
        include: {
          assignedTalent: true,
          booking: true,
        },
      },
      applications: {
        include: {
          talent: true,
          position: true,
        },
      },
      platformMappings: true,
    },
  });

  if (!event) {
    throw Object.assign(new Error(`Event with ID ${eventId} not found`), { status: 404 });
  }

  const staffing = calculateStaffing(event.positions);

  return {
    ...event,
    clientName: event.client?.companyName ?? null,
    staffing,
    staffingPercentage: staffing.percentage,
    posting: {
      ISDemos: event.platformMappings.find((m) => m.platform === 'isdemos')?.postStatus ?? 'NotPosted',
      PopBookings: event.platformMappings.find((m) => m.platform === 'popbookings')?.postStatus ?? 'NotPosted',
      TrustedHerd: event.platformMappings.find((m) => m.platform === 'trustedherd')?.postStatus ?? 'NotPosted',
    },
  };
}

export async function updateEvent(eventId: number, input: Partial<CreateEventInput>) {
  const existing = await prisma.event.findUnique({
    where: { eventId },
    include: { positions: true },
  });

  if (!existing) {
    throw Object.assign(new Error(`Event with ID ${eventId} not found`), { status: 404 });
  }

  const data: Prisma.EventUpdateInput = {};

  if (input.program !== undefined) data.program = input.program;
  if (input.address !== undefined) data.address = input.address;
  if (input.city !== undefined) data.city = input.city;
  if (input.state !== undefined) data.state = input.state;
  if (input.zip !== undefined) data.zip = input.zip;
  if (input.eventDate !== undefined) data.eventDate = new Date(input.eventDate);
  if (input.startTime !== undefined) data.startTime = input.startTime;
  if (input.endTime !== undefined) data.endTime = input.endTime;
  if (input.payRate !== undefined) data.payRate = input.payRate;
  if (input.requirements !== undefined) data.requirements = input.requirements;
  if (input.dressCode !== undefined) data.dressCode = input.dressCode;
  if (input.instructions !== undefined) data.instructions = input.instructions;

  if (input.positionsRequired !== undefined) {
    data.positionsRequired = input.positionsRequired;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.event.update({
      where: { eventId },
      data,
      include: {
        client: true,
        positions: true,
      },
    });

    if (input.positionsRequired !== undefined && input.positionsRequired > existing.positionsRequired) {
      const additional = [];
      for (let slot = existing.positionsRequired + 1; slot <= input.positionsRequired; slot++) {
        additional.push({
          eventId,
          slotNumber: slot,
          status: 'Open',
          assignedTalentId: null,
        });
      }
      await tx.position.createMany({ data: additional });
    }

    const positions = await tx.position.findMany({ where: { eventId } });
    const staffing = calculateStaffing(positions);

    return {
      ...updated,
      clientName: updated.client?.companyName ?? null,
      positions,
      staffing,
      staffingPercentage: staffing.percentage,
    };
  });
}

export async function triggerPlatformPost(eventId: number, platform?: string) {
  const event = await prisma.event.findUnique({ where: { eventId } });
  if (!event) {
    throw Object.assign(new Error(`Event with ID ${eventId} not found`), { status: 404 });
  }

  const targetPlatforms = platform
    ? [platform.toLowerCase()]
    : ['isdemos', 'popbookings', 'trustedherd'];

  const results = [];
  for (const plat of targetPlatforms) {
    const mapping = await prisma.platformMapping.upsert({
      where: {
        eventId_platform: {
          eventId,
          platform: plat,
        },
      },
      update: {
        postStatus: 'Posted',
        externalId: `${plat.toUpperCase()}-${event.eventId}-${Date.now().toString().slice(-4)}`,
        lastSyncedAt: new Date(),
      },
      create: {
        eventId,
        platform: plat,
        postStatus: 'Posted',
        externalId: `${plat.toUpperCase()}-${event.eventId}-${Date.now().toString().slice(-4)}`,
        lastSyncedAt: new Date(),
      },
    });
    results.push(mapping);
  }

  return { eventId, platformMappings: results };
}

export async function cancelEvent(eventId: number, actor: string = 'ops') {
  return prisma.$transaction(async (tx) => {
    const event = await tx.event.findUnique({ where: { eventId } });
    if (!event) {
      throw Object.assign(new Error(`Event with ID ${eventId} not found`), { status: 404 });
    }

    const updatedEvent = await tx.event.update({
      where: { eventId },
      data: { jobCancelled: true },
    });

    // Update all non-completed positions to Cancelled
    await tx.position.updateMany({
      where: { eventId, status: { not: 'Completed' } },
      data: { status: 'Cancelled', assignedTalentId: null },
    });

    // Cascade applications to Cancelled
    const updatedApps = await tx.application.updateMany({
      where: {
        eventId,
        status: { notIn: ['Completed', 'Declined', 'Cancelled'] },
      },
      data: {
        status: 'Cancelled',
        statusChangedAt: new Date(),
      },
    });

    // Create high-priority notification alert
    await tx.notification.create({
      data: {
        type: 'event.cancelled',
        severity: 'High',
        eventId,
        requiredAction: `"${event.program}" cancelled — ${updatedApps.count} application(s) and position slots updated by ${actor}.`,
      },
    });

    return {
      success: true,
      eventId,
      cancelledPositionsCount: updatedEvent.positionsRequired,
      cancelledApplicationsCount: updatedApps.count,
    };
  });
}

export async function getEventPositions(eventId: number) {
  const event = await prisma.event.findUnique({ where: { eventId } });
  if (!event) {
    throw Object.assign(new Error(`Event with ID ${eventId} not found`), { status: 404 });
  }

  return prisma.position.findMany({
    where: { eventId },
    include: {
      assignedTalent: true,
      booking: true,
    },
    orderBy: { slotNumber: 'asc' },
  });
}

export async function updatePositionStatus(positionId: number, status: string, assignedTalentId?: number | null) {
  const position = await prisma.position.findUnique({ where: { positionId } });
  if (!position) {
    throw Object.assign(new Error(`Position with ID ${positionId} not found`), { status: 404 });
  }

  const data: Prisma.PositionUpdateInput = { status };
  if (assignedTalentId !== undefined) {
    data.assignedTalent = assignedTalentId ? { connect: { talentId: assignedTalentId } } : { disconnect: true };
  }

  return prisma.position.update({
    where: { positionId },
    data,
    include: {
      assignedTalent: true,
    },
  });
}
