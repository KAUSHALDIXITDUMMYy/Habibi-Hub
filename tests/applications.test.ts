import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getEventApplications,
  handleApplicationTransition,
} from '../src/services/applicationsService.js';
import { prisma } from '../src/lib/prisma.js';

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    event: {
      findUnique: vi.fn(),
    },
    application: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    position: {
      update: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(prisma)),
  },
}));

describe('Phase 4.3 Applications Service Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getEventApplications', () => {
    it('throws 404 error if event does not exist', async () => {
      (prisma.event.findUnique as any).mockResolvedValue(null);

      await expect(getEventApplications(999)).rejects.toThrow('Event with ID 999 not found');
    });

    it('returns enriched applications with talent, position slotNumber, and bookingId', async () => {
      const mockEvent = { eventId: 1 };
      const mockApplications = [
        {
          applicationId: 10,
          eventId: 1,
          positionId: 100,
          talentId: 50,
          status: 'Applied',
          talent: { talentId: 50, firstName: 'John', lastName: 'Doe' },
          position: { positionId: 100, slotNumber: 1 },
        },
      ];
      const mockBookings = [
        { bookingId: 200, positionId: 100, talentId: 50, status: 'Confirmed' },
      ];

      (prisma.event.findUnique as any).mockResolvedValue(mockEvent);
      (prisma.application.findMany as any).mockResolvedValue(mockApplications);
      (prisma.booking.findMany as any).mockResolvedValue(mockBookings);

      const result = await getEventApplications(1);

      expect(result.length).toBe(1);
      expect(result[0].applicationId).toBe(10);
      expect(result[0].slotNumber).toBe(1);
      expect(result[0].bookingId).toBe(200);
      expect(result[0].bookingStatus).toBe('Confirmed');
    });
  });

  describe('handleApplicationTransition', () => {
    it('executes state machine transition and returns enriched application state', async () => {
      const mockInitialApp = {
        applicationId: 10,
        eventId: 1,
        positionId: 100,
        talentId: 50,
        status: 'Applied',
        position: { positionId: 100, slotNumber: 1 },
        talent: { talentId: 50, firstName: 'John' },
        event: { eventId: 1 },
      };

      const mockUpdatedApp = {
        ...mockInitialApp,
        status: 'Reviewed',
      };

      (prisma.application.findUnique as any).mockResolvedValue(mockInitialApp);
      (prisma.application.update as any).mockResolvedValue(mockUpdatedApp);
      (prisma.booking.findFirst as any).mockResolvedValue(null);

      const result = await handleApplicationTransition(10, {
        status: 'Reviewed',
        actor: 'ops_user',
        note: 'Resume reviewed',
      });

      expect(result.fromStatus).toBe('Applied');
      expect(result.toStatus).toBe('Reviewed');
      expect(result.application.slotNumber).toBe(1);
    });
  });
});
