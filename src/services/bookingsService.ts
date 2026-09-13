import { prisma } from '../lib/prisma.js';

export interface CreateBookingInput {
  positionId: number;
  talentId: number;
  externalBookingId?: string;
  isDemosShiftId?: number;
  paymentAgreementRequired?: boolean;
}

export async function createBooking(input: CreateBookingInput) {
  const position = await prisma.position.findUnique({
    where: { positionId: input.positionId },
  });

  if (!position) {
    throw Object.assign(new Error(`Position with ID ${input.positionId} not found`), { status: 404 });
  }

  const talent = await prisma.talent.findUnique({
    where: { talentId: input.talentId },
  });

  if (!talent) {
    throw Object.assign(new Error(`Talent with ID ${input.talentId} not found`), { status: 404 });
  }

  const existingBooking = await prisma.booking.findUnique({
    where: { positionId: input.positionId },
  });

  if (existingBooking) {
    throw Object.assign(
      new Error(`Position ${input.positionId} already has an active booking (ID: ${existingBooking.bookingId})`),
      { status: 409 }
    );
  }

  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.create({
      data: {
        positionId: input.positionId,
        talentId: input.talentId,
        externalBookingId: input.externalBookingId || null,
        isDemosShiftId: input.isDemosShiftId || null,
        paymentAgreementRequired: input.paymentAgreementRequired ?? false,
        status: 'Confirmed',
      },
      include: {
        position: {
          include: {
            event: true,
          },
        },
        talent: true,
      },
    });

    await tx.position.update({
      where: { positionId: input.positionId },
      data: {
        status: 'Confirmed',
        assignedTalentId: input.talentId,
      },
    });

    return booking;
  });
}

export interface UpdateBookingInput {
  status?: string;
  talentId?: number;
  paymentAgreementAccepted?: boolean;
}

export async function updateBooking(bookingId: number, input: UpdateBookingInput) {
  const booking = await prisma.booking.findUnique({
    where: { bookingId },
  });

  if (!booking) {
    throw Object.assign(new Error(`Booking with ID ${bookingId} not found`), { status: 404 });
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.booking.update({
      where: { bookingId },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.talentId ? { talentId: input.talentId } : {}),
        ...(input.paymentAgreementAccepted !== undefined
          ? { paymentAgreementAccepted: input.paymentAgreementAccepted }
          : {}),
      },
      include: {
        position: true,
        talent: true,
      },
    });

    if (input.talentId && input.talentId !== booking.talentId) {
      await tx.position.update({
        where: { positionId: booking.positionId },
        data: { assignedTalentId: input.talentId },
      });
    }

    return updated;
  });
}

export async function deleteBooking(bookingId: number) {
  const booking = await prisma.booking.findUnique({
    where: { bookingId },
  });

  if (!booking) {
    throw Object.assign(new Error(`Booking with ID ${bookingId} not found`), { status: 404 });
  }

  return prisma.$transaction(async (tx) => {
    await tx.booking.delete({
      where: { bookingId },
    });

    await tx.position.update({
      where: { positionId: booking.positionId },
      data: {
        status: 'Open',
        assignedTalentId: null,
      },
    });

    return { success: true, bookingId, positionId: booking.positionId };
  });
}
