import { prisma } from '../lib/prisma.js';

export interface GetNotificationsQuery {
  status?: 'unresolved' | 'resolved' | 'all';
  severity?: string;
  page?: number;
  limit?: number;
}

export async function getNotifications(query: GetNotificationsQuery) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.max(1, Math.min(100, query.limit || 50));
  const skip = (page - 1) * limit;

  const where: any = {};

  if (query.status === 'unresolved' || !query.status) {
    where.resolved = false;
  } else if (query.status === 'resolved') {
    where.resolved = true;
  }

  if (query.severity) {
    where.severity = { equals: query.severity, mode: 'insensitive' };
  }

  const [data, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip,
      take: limit,
      orderBy: { timestamp: 'desc' },
      include: {
        event: true,
        talent: true,
      },
    }),
    prisma.notification.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function resolveNotification(notificationId: number) {
  const notification = await prisma.notification.findUnique({
    where: { notificationId },
  });

  if (!notification) {
    throw Object.assign(new Error(`Notification with ID ${notificationId} not found`), { status: 404 });
  }

  return prisma.notification.update({
    where: { notificationId },
    data: { resolved: true },
    include: {
      event: true,
      talent: true,
    },
  });
}

export async function getDashboardSummary() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDate = new Date(todayStr);
  const tomorrow = new Date(todayDate);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [todayEvents, openAlerts, criticalAlerts, applications] = await Promise.all([
    prisma.event.findMany({
      where: {
        eventDate: { gte: todayDate, lt: tomorrow },
        jobCancelled: false,
      },
      include: {
        client: true,
        positions: true,
        platformMappings: true,
      },
    }),
    prisma.notification.count({
      where: { resolved: false },
    }),
    prisma.notification.count({
      where: {
        resolved: false,
        severity: { in: ['High', 'Critical'] },
      },
    }),
    prisma.application.groupBy({
      by: ['status'],
      _count: { status: true },
    }),
  ]);

  let totalSlotsToday = 0;
  let filledSlotsToday = 0;

  const todayList = todayEvents.map((event) => {
    const total = event.positions.length;
    const filled = event.positions.filter((p) =>
      ['Booked', 'Confirmed', 'CheckedIn', 'Completed'].includes(p.status)
    ).length;

    totalSlotsToday += total;
    filledSlotsToday += filled;

    const pct = total > 0 ? Math.round((filled / total) * 100) : 0;

    return {
      eventId: event.eventId,
      program: event.program,
      city: event.city,
      startTime: event.startTime,
      clientName: event.client?.companyName ?? null,
      staffing: { filled, total, pct },
      posting: {
        ISDemos: event.platformMappings.find((m) => m.platform === 'isdemos')?.postStatus ?? 'NotPosted',
        PopBookings: event.platformMappings.find((m) => m.platform === 'popbookings')?.postStatus ?? 'NotPosted',
        TrustedHerd: event.platformMappings.find((m) => m.platform === 'trustedherd')?.postStatus ?? 'NotPosted',
      },
    };
  });

  const overallStaffingPct =
    totalSlotsToday > 0 ? Math.round((filledSlotsToday / totalSlotsToday) * 100) : 0;

  const pipeline: Record<string, number> = {};
  applications.forEach((item) => {
    pipeline[item.status] = item._count.status;
  });

  return {
    date: todayStr,
    todayEventsCount: todayEvents.length,
    staffingPercentage: overallStaffingPct,
    unresolvedNotificationsCount: openAlerts,
    criticalAlertsCount: criticalAlerts,
    today: todayList,
    pipeline,
  };
}

export async function getMetricsByType(type: 'staffing' | 'recruiting' | 'operations') {
  if (type === 'staffing') {
    const [totalPositions, positionsByStatus, talentStats] = await Promise.all([
      prisma.position.count(),
      prisma.position.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      prisma.talent.aggregate({
        _sum: {
          noShowCount: true,
          completedJobsCount: true,
        },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    positionsByStatus.forEach((p) => {
      statusCounts[p.status] = p._count.status;
    });

    const filledCount =
      (statusCounts['Booked'] || 0) +
      (statusCounts['Confirmed'] || 0) +
      (statusCounts['CheckedIn'] || 0) +
      (statusCounts['Completed'] || 0);

    const fillRate = totalPositions > 0 ? Math.round((filledCount / totalPositions) * 100) : 0;

    return {
      type: 'staffing',
      totalPositions,
      filledCount,
      openSlots: statusCounts['Open'] || 0,
      fillRatePercentage: fillRate,
      statusCounts,
      totalCompletedJobs: talentStats._sum.completedJobsCount || 0,
      totalNoShows: talentStats._sum.noShowCount || 0,
    };
  }

  if (type === 'recruiting') {
    const [totalApplications, applicationsByStatus, applicationsBySource] = await Promise.all([
      prisma.application.count(),
      prisma.application.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      prisma.application.groupBy({
        by: ['platformSource'],
        _count: { platformSource: true },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    applicationsByStatus.forEach((a) => {
      statusCounts[a.status] = a._count.status;
    });

    const sourceCounts: Record<string, number> = {};
    applicationsBySource.forEach((s) => {
      sourceCounts[s.platformSource] = s._count.platformSource;
    });

    return {
      type: 'recruiting',
      totalApplications,
      statusCounts,
      sourceCounts,
      completedCount: statusCounts['Completed'] || 0,
      declinedCount: statusCounts['Declined'] || 0,
    };
  }

  if (type === 'operations') {
    const [totalEvents, activeEvents, cancelledEvents, platformMappings, alertStats] = await Promise.all([
      prisma.event.count(),
      prisma.event.count({ where: { jobCancelled: false } }),
      prisma.event.count({ where: { jobCancelled: true } }),
      prisma.platformMapping.groupBy({
        by: ['postStatus'],
        _count: { postStatus: true },
      }),
      prisma.notification.groupBy({
        by: ['resolved'],
        _count: { resolved: true },
      }),
    ]);

    const postingStatusCounts: Record<string, number> = {};
    platformMappings.forEach((m) => {
      postingStatusCounts[m.postStatus] = m._count.postStatus;
    });

    const alertCounts: Record<string, number> = {};
    alertStats.forEach((a) => {
      alertCounts[a.resolved ? 'resolved' : 'unresolved'] = a._count.resolved;
    });

    return {
      type: 'operations',
      totalEvents,
      activeEvents,
      cancelledEvents,
      postingStatusCounts,
      notifications: alertCounts,
    };
  }

  throw Object.assign(new Error(`Invalid metrics type '${type}'. Valid types: staffing, recruiting, operations`), {
    status: 400,
  });
}
