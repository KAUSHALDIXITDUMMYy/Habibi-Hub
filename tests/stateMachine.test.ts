import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  canTransition,
  transitionApplication,
  IllegalStateTransitionError,
  ApplicationNotFoundError,
  APPLICATION_STATUSES,
  TRANSITIONS,
  POSITION_EFFECT,
  ApplicationStatus,
} from '../src/services/stateMachine.js';
import { eventBus } from '../src/events/eventBus.js';

describe('Candidate Pipeline State Machine Engine', () => {
  describe('canTransition & TRANSITIONS matrix', () => {
    it('defines transitions for every valid application status', () => {
      APPLICATION_STATUSES.forEach((status) => {
        expect(TRANSITIONS).toHaveProperty(status);
        expect(Array.isArray(TRANSITIONS[status])).toBe(true);
      });
    });

    it('validates legal transitions correctly according to technical spec §2', () => {
      // Linear happy path
      expect(canTransition('Applied', 'Reviewed')).toBe(true);
      expect(canTransition('Reviewed', 'Selected')).toBe(true);
      expect(canTransition('Selected', 'BookingSent')).toBe(true);
      expect(canTransition('BookingSent', 'BookedPendingConfirmation')).toBe(true);
      expect(canTransition('BookedPendingConfirmation', 'TalentConfirmed')).toBe(true);
      expect(canTransition('TalentConfirmed', 'ConfirmationEmailSent')).toBe(true);
      expect(canTransition('ConfirmationEmailSent', 'FinalCheckinPending')).toBe(true);
      expect(canTransition('FinalCheckinPending', 'CheckedIn')).toBe(true);
      expect(canTransition('CheckedIn', 'ReportingPending')).toBe(true);
      expect(canTransition('ReportingPending', 'Completed')).toBe(true);

      // Branching / exception paths
      expect(canTransition('BookingSent', 'Declined')).toBe(true);
      expect(canTransition('BookedPendingConfirmation', 'Declined')).toBe(true);
      expect(canTransition('TalentConfirmed', 'Cancelled')).toBe(true);
      expect(canTransition('ConfirmationEmailSent', 'Cancelled')).toBe(true);
      expect(canTransition('FinalCheckinPending', 'Cancelled')).toBe(true);
      expect(canTransition('FinalCheckinPending', 'NoShow')).toBe(true);
      expect(canTransition('Cancelled', 'ReplacementRequired')).toBe(true);
      expect(canTransition('NoShow', 'ReplacementRequired')).toBe(true);
      expect(canTransition('ReplacementRequired', 'Selected')).toBe(true);
    });

    it('rejects illegal state transitions', () => {
      // Forward skips
      expect(canTransition('Applied', 'Completed')).toBe(false);
      expect(canTransition('Applied', 'CheckedIn')).toBe(false);
      expect(canTransition('Applied', 'BookedPendingConfirmation')).toBe(false);

      // Backward transitions from terminal / immutable states
      expect(canTransition('Completed', 'Applied')).toBe(false);
      expect(canTransition('Declined', 'Applied')).toBe(false);
      expect(canTransition('Declined', 'Selected')).toBe(false);

      // Invalid branch transitions
      expect(canTransition('Applied', 'NoShow')).toBe(false);
      expect(canTransition('CheckedIn', 'Cancelled')).toBe(false);
    });
  });

  describe('transitionApplication with Prisma Client', () => {
    let mockPrisma: any;

    beforeEach(() => {
      vi.restoreAllMocks();

      mockPrisma = {
        application: {
          findUnique: vi.fn(),
          update: vi.fn(),
        },
        position: {
          update: vi.fn(),
        },
      };
    });

    it('throws ApplicationNotFoundError when application is not found', async () => {
      mockPrisma.application.findUnique.mockResolvedValue(null);

      await expect(
        transitionApplication(mockPrisma, 999, 'Reviewed')
      ).rejects.toThrow(ApplicationNotFoundError);
      
      expect(mockPrisma.application.findUnique).toHaveBeenCalledWith({
        where: { applicationId: 999 },
        include: { position: true, talent: true, event: true },
      });
    });

    it('is idempotent and returns existing application if fromStatus === toStatus', async () => {
      const mockApp = {
        applicationId: 1,
        status: 'Applied',
        eventId: 10,
        positionId: 20,
        talentId: 30,
      };

      mockPrisma.application.findUnique.mockResolvedValue(mockApp);

      const result = await transitionApplication(mockPrisma, 1, 'Applied');

      expect(result.application).toEqual(mockApp);
      expect(result.fromStatus).toBe('Applied');
      expect(result.toStatus).toBe('Applied');
      expect(mockPrisma.application.update).not.toHaveBeenCalled();
      expect(mockPrisma.position.update).not.toHaveBeenCalled();
    });

    it('throws IllegalStateTransitionError for invalid state transition', async () => {
      const mockApp = {
        applicationId: 1,
        status: 'Applied',
        eventId: 10,
        positionId: 20,
        talentId: 30,
      };

      mockPrisma.application.findUnique.mockResolvedValue(mockApp);

      await expect(
        transitionApplication(mockPrisma, 1, 'Completed')
      ).rejects.toThrow(IllegalStateTransitionError);

      expect(mockPrisma.application.update).not.toHaveBeenCalled();
    });

    it('executes valid state transition, updates DB records, and emits eventBus events', async () => {
      const initialApp = {
        applicationId: 1,
        status: 'Applied',
        eventId: 10,
        positionId: 20,
        talentId: 30,
      };

      const updatedApp = {
        ...initialApp,
        status: 'Reviewed',
      };

      mockPrisma.application.findUnique.mockResolvedValue(initialApp);
      mockPrisma.application.update.mockResolvedValue(updatedApp);

      const emitSpy = vi.spyOn(eventBus, 'emitDomainEvent');

      const result = await transitionApplication(mockPrisma, 1, 'Reviewed', {
        actor: 'user_123',
        note: 'Reviewed qualifications',
      });

      expect(mockPrisma.application.update).toHaveBeenCalledWith({
        where: { applicationId: 1 },
        data: {
          status: 'Reviewed',
          statusChangedAt: expect.any(Date),
        },
        include: {
          position: true,
          talent: true,
          event: true,
        },
      });

      expect(emitSpy).toHaveBeenCalledWith('application.status_changed', {
        application: updatedApp,
        fromStatus: 'Applied',
        toStatus: 'Reviewed',
        actor: 'user_123',
        note: 'Reviewed qualifications',
      });

      expect(result.toStatus).toBe('Reviewed');
    });

    it('updates position status side-effects and emits specialized domain events for TalentConfirmed', async () => {
      const initialApp = {
        applicationId: 2,
        status: 'BookedPendingConfirmation',
        eventId: 10,
        positionId: 20,
        talentId: 30,
      };

      const updatedApp = {
        ...initialApp,
        status: 'TalentConfirmed',
      };

      mockPrisma.application.findUnique.mockResolvedValue(initialApp);
      mockPrisma.application.update.mockResolvedValue(updatedApp);

      const emitSpy = vi.spyOn(eventBus, 'emitDomainEvent');

      await transitionApplication(mockPrisma, 2, 'TalentConfirmed');

      // Verify position update for POSITION_EFFECT['TalentConfirmed'] = 'Confirmed'
      expect(mockPrisma.position.update).toHaveBeenCalledWith({
        where: { positionId: 20 },
        data: {
          status: 'Confirmed',
          assignedTalentId: 30,
        },
      });

      expect(emitSpy).toHaveBeenCalledWith('application.talent_confirmed', {
        applicationId: 2,
        eventId: 10,
        talentId: 30,
        positionId: 20,
      });
    });

    it('clears position assignedTalentId when transitioning to ReplacementRequired', async () => {
      const initialApp = {
        applicationId: 3,
        status: 'NoShow',
        eventId: 10,
        positionId: 20,
        talentId: 30,
      };

      const updatedApp = {
        ...initialApp,
        status: 'ReplacementRequired',
      };

      mockPrisma.application.findUnique.mockResolvedValue(initialApp);
      mockPrisma.application.update.mockResolvedValue(updatedApp);

      const emitSpy = vi.spyOn(eventBus, 'emitDomainEvent');

      await transitionApplication(mockPrisma, 3, 'ReplacementRequired');

      // POSITION_EFFECT['ReplacementRequired'] = 'Open' -> assignedTalentId should be null
      expect(mockPrisma.position.update).toHaveBeenCalledWith({
        where: { positionId: 20 },
        data: {
          status: 'Open',
          assignedTalentId: null,
        },
      });

      expect(emitSpy).toHaveBeenCalledWith('position.replacement_required', {
        eventId: 10,
        positionId: 20,
        previousTalentId: 30,
      });
    });
  });
});
