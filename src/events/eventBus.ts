import { EventEmitter } from 'events';
import { Application, Position, Talent, Event } from '@prisma/client';

export type DomainEventMap = {
  'application.status_changed': {
    application: Application & { position?: Position | null; talent?: Talent | null; event?: Event | null };
    fromStatus: string;
    toStatus: string;
    actor: string;
    note?: string;
  };
  'application.talent_confirmed': {
    applicationId: number;
    eventId: number;
    talentId: number;
    positionId: number;
  };
  'application.declined': {
    applicationId: number;
    eventId: number;
    talentId: number;
    positionId: number;
  };
  'shift.checked_in': {
    applicationId: number;
    eventId: number;
    talentId: number;
    positionId: number;
  };
  'shift.no_show': {
    applicationId: number;
    eventId: number;
    talentId: number;
    positionId: number;
  };
  'position.replacement_required': {
    eventId: number;
    positionId: number;
    previousTalentId?: number | null;
  };
};

export type DomainEventName = keyof DomainEventMap;

class HubEventBus extends EventEmitter {
  public emitDomainEvent<K extends DomainEventName>(
    event: K,
    payload: DomainEventMap[K]
  ): boolean {
    return this.emit(event, payload);
  }

  public onDomainEvent<K extends DomainEventName>(
    event: K,
    listener: (payload: DomainEventMap[K]) => void
  ): this {
    this.on(event, listener as (...args: any[]) => void);
    return this;
  }
}

export const eventBus = new HubEventBus();
