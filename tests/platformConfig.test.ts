import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  upsertPlatformConfig,
  getPlatformConfig,
  listPlatformConfigs,
} from '../src/services/platformConfigService.js';
import { prisma } from '../src/lib/prisma.js';

vi.mock('../src/lib/prisma.js', () => ({
  prisma: {
    platformConfig: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe('Phase 4.7 Platform Config Service Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('upsertPlatformConfig', () => {
    it('throws 400 for unsupported platform', async () => {
      await expect(
        upsertPlatformConfig('unsupported_platform', { baseUrl: 'https://api.example.com' })
      ).rejects.toThrow("Unsupported platform 'unsupported_platform'");
    });

    it('upserts config for valid platform (isdemos)', async () => {
      const mockConfig = {
        platform: 'isdemos',
        apiKeyRef: 'ISDEMOS_KEY_REF',
        baseUrl: 'https://api.isdemos.com/v1',
        scopes: { 'jobs.read': true },
      };

      (prisma.platformConfig.upsert as any).mockResolvedValue(mockConfig);

      const result = await upsertPlatformConfig('isdemos', {
        apiKeyRef: 'ISDEMOS_KEY_REF',
        baseUrl: 'https://api.isdemos.com/v1',
        scopes: { 'jobs.read': true },
      });

      expect(prisma.platformConfig.upsert).toHaveBeenCalledWith({
        where: { platform: 'isdemos' },
        update: {
          apiKeyRef: 'ISDEMOS_KEY_REF',
          baseUrl: 'https://api.isdemos.com/v1',
          scopes: { 'jobs.read': true },
        },
        create: {
          platform: 'isdemos',
          apiKeyRef: 'ISDEMOS_KEY_REF',
          baseUrl: 'https://api.isdemos.com/v1',
          scopes: { 'jobs.read': true },
        },
      });

      expect(result.platform).toBe('isdemos');
    });
  });

  describe('getPlatformConfig', () => {
    it('throws 404 if config is not found', async () => {
      (prisma.platformConfig.findUnique as any).mockResolvedValue(null);

      await expect(getPlatformConfig('popbookings')).rejects.toThrow(
        "Platform configuration for 'popbookings' not found"
      );
    });

    it('returns config for supported platform', async () => {
      (prisma.platformConfig.findUnique as any).mockResolvedValue({
        platform: 'trustedherd',
        baseUrl: 'https://api.trustedherd.com',
      });

      const config = await getPlatformConfig('trustedherd');
      expect(config.platform).toBe('trustedherd');
    });
  });

  describe('listPlatformConfigs', () => {
    it('returns all platform configurations', async () => {
      (prisma.platformConfig.findMany as any).mockResolvedValue([
        { platform: 'isdemos' },
        { platform: 'popbookings' },
      ]);

      const configs = await listPlatformConfigs();
      expect(configs.length).toBe(2);
    });
  });
});
