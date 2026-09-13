import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getNotifications,
  resolveNotification,
  getDashboardSummary,
  getMetricsByType,
} from '../src/services/dashboardService.js';
import { prisma } from '../src/lib/prisma.js';

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    notification: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      groupBy: vi.fn(),
    },
    event: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    application: {
      groupBy: vi.fn(),
      count: vi.fn(),
    },
    position: {
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    talent: {
      aggregate: vi.fn(),
    },
    platformMapping: {
      groupBy: vi.fn(),
    },
  },
}));

describe('Phase 4.6 Notifications, Dashboard Summary & Metrics Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getNotifications & resolveNotification', () => {
    it('returns unresolved notifications by default', async () => {
      (prisma.notification.findMany as any).mockResolvedValue([
        { notificationId: 1, type: 'event.cancelled', resolved: false, severity: 'High' },
      ]);
      (prisma.notification.count as any).mockResolvedValue(1);

      const result = await getNotifications({ status: 'unresolved' });
      expect(result.total).toBe(1);
      expect(result.data[0].resolved).toBe(false);
    });

    it('marks notification as resolved', async () => {
      (prisma.notification.findUnique as any).mockResolvedValue({ notificationId: 10, resolved: false });
      (prisma.notification.update as any).mockResolvedValue({ notificationId: 10, resolved: true });

      const resolved = await resolveNotification(10);
      expect(resolved.resolved).toBe(true);
    });
  });

  describe('getDashboardSummary', () => {
    it('calculates today staffing %, open alert counts, and pipeline summary', async () => {
      (prisma.event.findMany as any).mockResolvedValue([
        {
          eventId: 1,
          program: 'Demo Day',
          city: 'Dallas',
          startTime: '09:00 AM',
          client: { companyName: 'Client A' },
          positions: [{ status: 'Confirmed' }, { status: 'Open' }],
          platformMappings: [],
        },
      ]);

      (prisma.notification.count as any)
        .mockResolvedValueOnce(3) // openAlerts
        .mockResolvedValueOnce(1); // criticalAlerts

      (prisma.application.groupBy as any).mockResolvedValue([
        { status: 'Applied', _count: { status: 10 } },
        { status: 'Reviewed', _count: { status: 5 } },
      ]);

      const summary = await getDashboardSummary();

      expect(summary.todayEventsCount).toBe(1);
      expect(summary.staffingPercentage).toBe(50);
      expect(summary.unresolvedNotificationsCount).toBe(3);
      expect(summary.criticalAlertsCount).toBe(1);
      expect(summary.pipeline['Applied']).toBe(10);
    });
  });

  describe('getMetricsByType', () => {
    it('returns staffing metrics', async () => {
      (prisma.position.count as any).mockResolvedValue(10);
      (prisma.position.groupBy as any).mockResolvedValue([
        { status: 'Confirmed', _count: { status: 6 } },
        { status: 'Open', _count: { status: 4 } },
      ]);
      (prisma.talent.aggregate as any).mockResolvedValue({
        _sum: { noShowCount: 1, completedJobsCount: 15 },
      });

      const metrics = await getMetricsByType('staffing');

      expect(metrics.type).toBe('staffing');
      expect(metrics.totalPositions).toBe(10);
      expect(metrics.filledCount).toBe(6);
      expect(metrics.fillRatePercentage).toBe(60);
    });

    it('returns recruiting metrics', async () => {
      (prisma.application.count as any).mockResolvedValue(20);
      (prisma.application.groupBy as any)
        .mockResolvedValueOnce([{ status: 'Applied', _count: { status: 20 } }])
        .mockResolvedValueOnce([{ platformSource: 'IS-Demos', _count: { platformSource: 20 } }]);

      const metrics = await getMetricsByType('recruiting');

      expect(metrics.type).toBe('recruiting');
      expect(metrics.totalApplications).toBe(20);
    });

    it('returns operations metrics', async () => {
      (prisma.event.count as any)
        .mockResolvedValueOnce(15) // totalEvents
        .mockResolvedValueOnce(12) // activeEvents
        .mockResolvedValueOnce(3); // cancelledEvents

      (prisma.platformMapping.groupBy as any).mockResolvedValue([
        { postStatus: 'Posted', _count: { postStatus: 10 } },
      ]);

      (prisma.notification.groupBy as any).mockResolvedValue([
        { resolved: false, _count: { resolved: 5 } },
      ]);

      const metrics = await getMetricsByType('operations');

      expect(metrics.type).toBe('operations');
      expect(metrics.totalEvents).toBe(15);
      expect(metrics.activeEvents).toBe(12);
      expect(metrics.cancelledEvents).toBe(3);
    });
  });
});
