import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createBooking,
  updateBooking,
  deleteBooking,
} from '../src/services/bookingsService.js';
import { prisma } from '../src/lib/prisma.js';

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    position: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    talent: {
      findUnique: vi.fn(),
    },
    booking: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(prisma)),
  },
}));

describe('Phase 4.5 Bookings Management Service Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('createBooking', () => {
    it('throws 404 if position does not exist', async () => {
      (prisma.position.findUnique as any).mockResolvedValue(null);

      await expect(
        createBooking({ positionId: 999, talentId: 10 })
      ).rejects.toThrow('Position with ID 999 not found');
    });

    it('throws 404 if talent does not exist', async () => {
      (prisma.position.findUnique as any).mockResolvedValue({ positionId: 1 });
      (prisma.talent.findUnique as any).mockResolvedValue(null);

      await expect(
        createBooking({ positionId: 1, talentId: 999 })
      ).rejects.toThrow('Talent with ID 999 not found');
    });

    it('throws 409 if position already has an active booking', async () => {
      (prisma.position.findUnique as any).mockResolvedValue({ positionId: 1 });
      (prisma.talent.findUnique as any).mockResolvedValue({ talentId: 10 });
      (prisma.booking.findUnique as any).mockResolvedValue({ bookingId: 50, positionId: 1 });

      await expect(
        createBooking({ positionId: 1, talentId: 10 })
      ).rejects.toThrow('Position 1 already has an active booking');
    });

    it('creates booking and updates position status to Confirmed', async () => {
      (prisma.position.findUnique as any).mockResolvedValue({ positionId: 1 });
      (prisma.talent.findUnique as any).mockResolvedValue({ talentId: 10 });
      (prisma.booking.findUnique as any).mockResolvedValue(null);
      (prisma.booking.create as any).mockResolvedValue({
        bookingId: 100,
        positionId: 1,
        talentId: 10,
        status: 'Confirmed',
      });

      const booking = await createBooking({ positionId: 1, talentId: 10 });

      expect(prisma.booking.create).toHaveBeenCalled();
      expect(prisma.position.update).toHaveBeenCalledWith({
        where: { positionId: 1 },
        data: {
          status: 'Confirmed',
          assignedTalentId: 10,
        },
      });
      expect(booking.bookingId).toBe(100);
    });
  });

  describe('updateBooking', () => {
    it('throws 404 if booking does not exist', async () => {
      (prisma.booking.findUnique as any).mockResolvedValue(null);

      await expect(
        updateBooking(999, { status: 'Confirmed' })
      ).rejects.toThrow('Booking with ID 999 not found');
    });

    it('updates booking details', async () => {
      (prisma.booking.findUnique as any).mockResolvedValue({ bookingId: 100, talentId: 10 });
      (prisma.booking.update as any).mockResolvedValue({
        bookingId: 100,
        status: 'Completed',
        paymentAgreementAccepted: true,
      });

      const updated = await updateBooking(100, { paymentAgreementAccepted: true });
      expect(updated.paymentAgreementAccepted).toBe(true);
    });
  });

  describe('deleteBooking', () => {
    it('deletes booking and resets position status to Open with null assignedTalentId', async () => {
      (prisma.booking.findUnique as any).mockResolvedValue({ bookingId: 100, positionId: 5 });

      const result = await deleteBooking(100);

      expect(prisma.booking.delete).toHaveBeenCalledWith({ where: { bookingId: 100 } });
      expect(prisma.position.update).toHaveBeenCalledWith({
        where: { positionId: 5 },
        data: {
          status: 'Open',
          assignedTalentId: null,
        },
      });
      expect(result.success).toBe(true);
    });
  });
});
