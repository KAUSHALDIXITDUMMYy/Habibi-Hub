import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  searchTalent,
  getTalentById,
  createTalent,
  DuplicateTalentError,
  getTalentCommunications,
} from '../src/services/talentService.js';
import { prisma } from '../src/lib/prisma.js';

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    talent: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    communicationLog: {
      findMany: vi.fn(),
    },
  },
}));

describe('Phase 4.4 Talent Management & Deduplication Service Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('searchTalent', () => {
    it('returns paginated talent records matching search criteria', async () => {
      const mockTalent = [
        { talentId: 1, firstName: 'Sarah', lastName: 'Connor', email: 'sarah@example.com', phone: '555-0199' },
      ];

      (prisma.talent.findMany as any).mockResolvedValue(mockTalent);
      (prisma.talent.count as any).mockResolvedValue(1);

      const result = await searchTalent({ search: 'Sarah', page: 1, limit: 10 });

      expect(result.total).toBe(1);
      expect(result.data.length).toBe(1);
      expect(result.data[0].firstName).toBe('Sarah');
    });
  });

  describe('getTalentById', () => {
    it('throws 404 when talent is not found', async () => {
      (prisma.talent.findUnique as any).mockResolvedValue(null);

      await expect(getTalentById(999)).rejects.toThrow('Talent with ID 999 not found');
    });

    it('returns full talent profile with applications and bookings', async () => {
      const mockProfile = {
        talentId: 5,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        applications: [],
        bookings: [],
        communicationLogs: [],
      };

      (prisma.talent.findUnique as any).mockResolvedValue(mockProfile);

      const result = await getTalentById(5);
      expect(result.talentId).toBe(5);
    });
  });

  describe('createTalent with Deduplication', () => {
    it('creates new talent when email and phone are unique', async () => {
      (prisma.talent.findFirst as any).mockResolvedValue(null);
      (prisma.talent.create as any).mockResolvedValue({
        talentId: 10,
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@example.com',
        phone: '555-1234',
      });

      const result = await createTalent({
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@example.com',
        phone: '555-1234',
      });

      expect(prisma.talent.create).toHaveBeenCalled();
      expect(result.talentId).toBe(10);
    });

    it('throws DuplicateTalentError (409) if email already exists', async () => {
      (prisma.talent.findFirst as any).mockResolvedValueOnce({
        talentId: 1,
        email: 'duplicate@example.com',
      });

      await expect(
        createTalent({
          firstName: 'New',
          lastName: 'User',
          email: 'duplicate@example.com',
          phone: '555-9999',
        })
      ).rejects.toThrow(DuplicateTalentError);
    });

    it('throws DuplicateTalentError (409) if phone already exists', async () => {
      (prisma.talent.findFirst as any)
        .mockResolvedValueOnce(null) // email check passes
        .mockResolvedValueOnce({ talentId: 2, phone: '555-1234' }); // phone check fails

      await expect(
        createTalent({
          firstName: 'New',
          lastName: 'User',
          email: 'unique@example.com',
          phone: '555-1234',
        })
      ).rejects.toThrow(DuplicateTalentError);
    });
  });

  describe('getTalentCommunications', () => {
    it('returns communication logs for given talent ID', async () => {
      (prisma.talent.findUnique as any).mockResolvedValue({ talentId: 1 });
      (prisma.communicationLog.findMany as any).mockResolvedValue([
        { logId: 100, channel: 'SMS', direction: 'Outbound', content: 'Job offer sent' },
      ]);

      const logs = await getTalentCommunications(1);
      expect(logs.length).toBe(1);
      expect(logs[0].channel).toBe('SMS');
    });
  });
});
