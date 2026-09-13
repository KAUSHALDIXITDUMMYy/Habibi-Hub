import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';

export const VALID_PLATFORMS = ['isdemos', 'popbookings', 'trustedherd'] as const;
export type SupportedPlatform = (typeof VALID_PLATFORMS)[number];

export interface UpsertPlatformConfigInput {
  apiKeyRef?: string;
  baseUrl?: string;
  scopes?: Record<string, any>;
}

export function isSupportedPlatform(platform: string): platform is SupportedPlatform {
  return VALID_PLATFORMS.includes(platform.toLowerCase() as SupportedPlatform);
}

export async function upsertPlatformConfig(platformStr: string, input: UpsertPlatformConfigInput) {
  const normalizedPlatform = platformStr.toLowerCase();
  if (!isSupportedPlatform(normalizedPlatform)) {
    throw Object.assign(
      new Error(`Unsupported platform '${platformStr}'. Supported platforms: ${VALID_PLATFORMS.join(', ')}`),
      { status: 400 }
    );
  }

  return prisma.platformConfig.upsert({
    where: { platform: normalizedPlatform },
    update: {
      ...(input.apiKeyRef !== undefined ? { apiKeyRef: input.apiKeyRef } : {}),
      ...(input.baseUrl !== undefined ? { baseUrl: input.baseUrl } : {}),
      ...(input.scopes !== undefined ? { scopes: input.scopes } : {}),
    },
    create: {
      platform: normalizedPlatform,
      apiKeyRef: input.apiKeyRef || null,
      baseUrl: input.baseUrl || null,
      scopes: input.scopes ?? Prisma.JsonNull,
    },
  });
}

export async function getPlatformConfig(platformStr: string) {
  const normalizedPlatform = platformStr.toLowerCase();
  if (!isSupportedPlatform(normalizedPlatform)) {
    throw Object.assign(
      new Error(`Unsupported platform '${platformStr}'. Supported platforms: ${VALID_PLATFORMS.join(', ')}`),
      { status: 400 }
    );
  }

  const config = await prisma.platformConfig.findUnique({
    where: { platform: normalizedPlatform },
  });

  if (!config) {
    throw Object.assign(new Error(`Platform configuration for '${normalizedPlatform}' not found`), { status: 404 });
  }

  return config;
}

export async function listPlatformConfigs() {
  return prisma.platformConfig.findMany();
}
