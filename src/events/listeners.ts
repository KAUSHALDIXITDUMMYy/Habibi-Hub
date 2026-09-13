import { eventBus } from './eventBus.js';
import { PrismaClient } from '@prisma/client';

export function registerDomainEventListeners(prisma: PrismaClient) {
  console.log('📡 Registering internal domain event listeners...');

  // 1. Talent Confirmed → Create confirmation email stub & clear alerts
  eventBus.onDomainEvent('application.talent_confirmed', async (data) => {
    console.log(`[Event: application.talent_confirmed] Candidate ${data.talentId} confirmed for event ${data.eventId}`);
    try {
      // Find booking or create confirmation email entry
      const booking = await prisma.booking.findUnique({ where: { positionId: data.positionId } });
      if (booking) {
        await prisma.confirmationEmail.create({
          data: {
            bookingId: booking.bookingId,
            deliveryStatus: 'delivered'
          }
        });
      }
    } catch (err) {
      console.error('Error handling application.talent_confirmed:', err);
    }
  });

  // 2. Declined → Log comms
  eventBus.onDomainEvent('application.declined', async (data) => {
    console.log(`[Event: application.declined] Candidate ${data.talentId} declined application ${data.applicationId}`);
  });

  // 3. Shift Checked In → Clear checkin_missing alerts
  eventBus.onDomainEvent('shift.checked_in', async (data) => {
    console.log(`[Event: shift.checked_in] Candidate ${data.talentId} checked in for event ${data.eventId}`);
    try {
      await prisma.notification.updateMany({
        where: {
          eventId: data.eventId,
          talentId: data.talentId,
          type: 'checkin_missing',
          resolved: false
        },
        data: { resolved: true }
      });
    } catch (err) {
      console.error('Error handling shift.checked_in:', err);
    }
  });

  // 4. Shift No Show → Raise No-Show Notification Alert
  eventBus.onDomainEvent('shift.no_show', async (data) => {
    console.log(`[Event: shift.no_show] Candidate ${data.talentId} marked as No-Show for event ${data.eventId}`);
    try {
      await prisma.notification.create({
        data: {
          type: 'no_show',
          severity: 'High',
          eventId: data.eventId,
          talentId: data.talentId,
          requiredAction: `No-Show recorded for Talent ID ${data.talentId}. Review inbox to select replacement.`
        }
      });
      // Increment noShowCount
      await prisma.talent.update({
        where: { talentId: data.talentId },
        data: { noShowCount: { increment: 1 } }
      });
    } catch (err) {
      console.error('Error handling shift.no_show:', err);
    }
  });

  // 5. Position Replacement Required → Raise Notification Alert
  eventBus.onDomainEvent('position.replacement_required', async (data) => {
    console.log(`[Event: position.replacement_required] Replacement needed for position ${data.positionId} on event ${data.eventId}`);
    try {
      await prisma.notification.create({
        data: {
          type: 'replacement_required',
          severity: 'High',
          eventId: data.eventId,
          talentId: data.previousTalentId || null,
          requiredAction: `Replacement required for Position ID ${data.positionId}. Review applicant inbox.`
        }
      });
    } catch (err) {
      console.error('Error handling position.replacement_required:', err);
    }
  });
}
