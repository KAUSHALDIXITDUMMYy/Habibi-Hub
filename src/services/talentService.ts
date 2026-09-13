import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';

export interface SearchTalentQuery {
  search?: string;
  homeMarket?: string;
  source?: string;
  page?: number;
  limit?: number;
}

export class DuplicateTalentError extends Error {
  public readonly status = 409;
  constructor(field: string, value: string) {
    super(`Talent with ${field} '${value}' already exists.`);
    this.name = 'DuplicateTalentError';
  }
}

export async function searchTalent(query: SearchTalentQuery) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.max(1, Math.min(100, query.limit || 20));
  const skip = (page - 1) * limit;

  const where: Prisma.TalentWhereInput = {};

  if (query.homeMarket) {
    where.homeMarket = { contains: query.homeMarket, mode: 'insensitive' };
  }

  if (query.source) {
    where.source = { equals: query.source, mode: 'insensitive' };
  }

  if (query.search) {
    const s = query.search.trim();
    where.OR = [
      { firstName: { contains: s, mode: 'insensitive' } },
      { lastName: { contains: s, mode: 'insensitive' } },
      { email: { contains: s, mode: 'insensitive' } },
      { phone: { contains: s, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.talent.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.talent.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function getTalentById(talentId: number) {
  const talent = await prisma.talent.findUnique({
    where: { talentId },
    include: {
      applications: {
        include: {
          event: true,
          position: true,
        },
        orderBy: { appliedAt: 'desc' },
      },
      bookings: {
        include: {
          position: {
            include: {
              event: true,
            },
          },
        },
        orderBy: { confirmedAt: 'desc' },
      },
      communicationLogs: {
        orderBy: { timestamp: 'desc' },
      },
    },
  });

  if (!talent) {
    throw Object.assign(new Error(`Talent with ID ${talentId} not found`), { status: 404 });
  }

  return talent;
}

export interface CreateTalentInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  homeMarket?: string;
  source?: string;
  pbProfileUrl?: string;
  thProfileUrl?: string;
  notes?: string;
}

export async function createTalent(input: CreateTalentInput) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedPhone = input.phone.trim();

  // Deduplication Check
  const existingByEmail = await prisma.talent.findFirst({
    where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
  });

  if (existingByEmail) {
    throw new DuplicateTalentError('email', normalizedEmail);
  }

  const existingByPhone = await prisma.talent.findFirst({
    where: { phone: normalizedPhone },
  });

  if (existingByPhone) {
    throw new DuplicateTalentError('phone', normalizedPhone);
  }

  return prisma.talent.create({
    data: {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      homeMarket: input.homeMarket?.trim() || null,
      source: input.source?.trim() || 'Internal',
      pbProfileUrl: input.pbProfileUrl || null,
      thProfileUrl: input.thProfileUrl || null,
      notes: input.notes || null,
    },
  });
}

export async function getTalentCommunications(talentId: number) {
  const talent = await prisma.talent.findUnique({ where: { talentId } });
  if (!talent) {
    throw Object.assign(new Error(`Talent with ID ${talentId} not found`), { status: 404 });
  }

  return prisma.communicationLog.findMany({
    where: { talentId },
    orderBy: { timestamp: 'desc' },
  });
}
