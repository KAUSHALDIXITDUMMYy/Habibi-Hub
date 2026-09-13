import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateStaffing,
  listEvents,
  createEvent,
  getEventById,
  updateEvent,
  triggerPlatformPost,
  cancelEvent,
  getEventPositions,
  updatePositionStatus,
} from '../src/services/eventsService.js';
import { prisma } from '../src/lib/prisma.js';

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    event: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    position: {
      createMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    application: {
      updateMany: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    platformMapping: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(prisma)),
  },
}));

describe('Phase 4.2 Events & Positions Service Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('calculateStaffing helper', () => {
    it('calculates staffing percentage correctly', () => {
      const positions = [
        { status: 'Confirmed' },
        { status: 'Open' },
        { status: 'CheckedIn' },
        { status: 'Open' },
      ];
      const result = calculateStaffing(positions);
      expect(result.filled).toBe(2);
      expect(result.total).toBe(4);
      expect(result.percentage).toBe(50);
    });

    it('handles empty positions list', () => {
      const result = calculateStaffing([]);
      expect(result.filled).toBe(0);
      expect(result.total).toBe(0);
      expect(result.percentage).toBe(0);
    });
  });

  describe('listEvents', () => {
    it('queries events with pagination and calculates staffing', async () => {
      const mockEvent = {
        eventId: 1,
        companyId: 100,
        program: 'Demo Event',
        eventDate: new Date('2026-10-01'),
        jobCancelled: false,
        client: { companyName: 'Acme Corp' },
        positions: [{ status: 'Confirmed' }, { status: 'Open' }],
        platformMappings: [
          { platform: 'isdemos', postStatus: 'Posted' },
        ],
      };

      (prisma.event.findMany as any).mockResolvedValue([mockEvent]);
      (prisma.event.count as any).mockResolvedValue(1);

      const result = await listEvents({ page: 1, limit: 10, scope: 'all' });

      expect(result.total).toBe(1);
      expect(result.data.length).toBe(1);
      expect(result.data[0].clientName).toBe('Acme Corp');
      expect(result.data[0].staffingPercentage).toBe(50);
      expect(result.data[0].posting.ISDemos).toBe('Posted');
      expect(result.data[0].posting.PopBookings).toBe('NotPosted');
    });
  });

  describe('createEvent', () => {
    it('creates event and automatically initializes required position slots', async () => {
      const mockCreatedEvent = {
        eventId: 10,
        companyId: 100,
        program: 'New Product Tour',
        positionsRequired: 3,
        client: { companyName: 'Acme Corp' },
      };

      (prisma.event.create as any).mockResolvedValue(mockCreatedEvent);
      (prisma.position.findMany as any).mockResolvedValue([
        { positionId: 1, eventId: 10, slotNumber: 1, status: 'Open' },
        { positionId: 2, eventId: 10, slotNumber: 2, status: 'Open' },
        { positionId: 3, eventId: 10, slotNumber: 3, status: 'Open' },
      ]);

      const result = await createEvent({
        companyId: 100,
        program: 'New Product Tour',
        address: '123 Main St',
        city: 'Austin',
        state: 'TX',
        zip: '78701',
        eventDate: '2026-10-20',
        startTime: '10:00 AM',
        endTime: '04:00 PM',
        payRate: 25,
        positionsRequired: 3,
      });

      expect(prisma.event.create).toHaveBeenCalled();
      expect(prisma.position.createMany).toHaveBeenCalled();
      expect(result.eventId).toBe(10);
      expect(result.positions.length).toBe(3);
      expect(result.staffingPercentage).toBe(0);
    });

    it('rejects invalid positionsRequired (< 1 or > 50)', async () => {
      await expect(
        createEvent({
          companyId: 100,
          program: 'Invalid',
          address: '',
          city: '',
          state: '',
          zip: '',
          eventDate: '2026-10-20',
          startTime: '',
          endTime: '',
          payRate: 20,
          positionsRequired: 0,
        })
      ).rejects.toThrow('positionsRequired must be between 1 and 50');
    });
  });

  describe('getEventById', () => {
    it('returns detailed event information or throws 404', async () => {

      (prisma.event.findUnique as any).mockResolvedValue(null);
      await expect(getEventById(999)).rejects.toThrow('Event with ID 999 not found');

      const mockEventDetail = {
        eventId: 5,
        companyId: 100,
        program: 'Detail Demo',
        client: { companyName: 'Acme' },
        positions: [{ positionId: 1, status: 'Open' }],
        applications: [],
        platformMappings: [],
      };

      (prisma.event.findUnique as any).mockResolvedValue(mockEventDetail);
      const result = await getEventById(5);
      expect(result.eventId).toBe(5);
      expect(result.clientName).toBe('Acme');
    });
  });

  describe('cancelEvent', () => {
    it('cancels event, updates position slots, cascades applications, and creates notification alert', async () => {
      const mockEvent = { eventId: 7, program: 'Cancelled Expo', positionsRequired: 2 };
      (prisma.event.findUnique as any).mockResolvedValue(mockEvent);
      (prisma.event.update as any).mockResolvedValue({ ...mockEvent, jobCancelled: true });
      (prisma.application.updateMany as any).mockResolvedValue({ count: 4 });

      const result = await cancelEvent(7, 'ops_admin');

      expect(result.success).toBe(true);
      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { eventId: 7 },
        data: { jobCancelled: true },
      });
      expect(prisma.position.updateMany).toHaveBeenCalledWith({
        where: { eventId: 7, status: { not: 'Completed' } },
        data: { status: 'Cancelled', assignedTalentId: null },
      });
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'event.cancelled',
          eventId: 7,
        }),
      });
    });
  });

  describe('updatePositionStatus', () => {
    it('updates position status and assigned talent', async () => {
      const mockPos = { positionId: 12, eventId: 1, slotNumber: 1, status: 'Open' };
      (prisma.position.findUnique as any).mockResolvedValue(mockPos);
      (prisma.position.update as any).mockResolvedValue({
        ...mockPos,
        status: 'Confirmed',
        assignedTalentId: 50,
      });

      const updated = await updatePositionStatus(12, 'Confirmed', 50);
      expect(prisma.position.update).toHaveBeenCalled();
      expect(updated.status).toBe('Confirmed');
    });
  });
});
