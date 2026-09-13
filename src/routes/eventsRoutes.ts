import { Router } from 'express';
import { listEventApplicationsHandler } from './applicationsRoutes.js';
import {
  listEvents,
  createEvent,
  getEventById,
  updateEvent,
  triggerPlatformPost,
  cancelEvent,
  getEventPositions,
  updatePositionStatus,
} from '../services/eventsService.js';

export const eventsRouter = Router();

// GET /hub/v1/events
eventsRouter.get('/', async (req, res, next) => {
  try {
    const query = {
      status: req.query.status as string | undefined,
      scope: req.query.scope as any,
      clientId: req.query.clientId ? Number(req.query.clientId) : undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 20,
    };
    const result = await listEvents(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /hub/v1/events
eventsRouter.post('/', async (req, res, next) => {
  try {
    const {
      companyId,
      program,
      siteNumber,
      address,
      city,
      state,
      zip,
      eventDate,
      startTime,
      endTime,
      payRate,
      positionsRequired,
      requirements,
      dressCode,
      instructions,
    } = req.body || {};

    if (!companyId || !program || !eventDate || !positionsRequired) {
      return res.status(400).json({ error: 'companyId, program, eventDate, and positionsRequired are required' });
    }

    const event = await createEvent({
      companyId: Number(companyId),
      program: String(program),
      siteNumber,
      address: String(address || ''),
      city: String(city || ''),
      state: String(state || ''),
      zip: String(zip || ''),
      eventDate: String(eventDate),
      startTime: String(startTime || '09:00 AM'),
      endTime: String(endTime || '05:00 PM'),
      payRate: Number(payRate || 0),
      positionsRequired: Number(positionsRequired),
      requirements,
      dressCode,
      instructions,
    });

    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
});

// GET /hub/v1/events/:id
eventsRouter.get('/:id', async (req, res, next) => {
  try {
    const eventId = Number(req.params.id);
    if (isNaN(eventId)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }
    const event = await getEventById(eventId);
    res.json(event);
  } catch (err) {
    next(err);
  }
});

// PUT /hub/v1/events/:id
eventsRouter.put('/:id', async (req, res, next) => {
  try {
    const eventId = Number(req.params.id);
    if (isNaN(eventId)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }
    const updated = await updateEvent(eventId, req.body || {});
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// POST /hub/v1/events/:id/post
eventsRouter.post('/:id/post', async (req, res, next) => {
  try {
    const eventId = Number(req.params.id);
    if (isNaN(eventId)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }
    const platform = req.body?.platform || (req.query.platform as string | undefined);
    const result = await triggerPlatformPost(eventId, platform);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /hub/v1/events/:id/post-retry
eventsRouter.post('/:id/post-retry', async (req, res, next) => {
  try {
    const eventId = Number(req.params.id);
    const platform = (req.query.platform as string) || req.body?.platform;
    if (!platform) {
      return res.status(400).json({ error: 'platform parameter is required for retry' });
    }
    const result = await triggerPlatformPost(eventId, platform);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /hub/v1/events/:id/cancel
eventsRouter.post('/:id/cancel', async (req, res, next) => {
  try {
    const eventId = Number(req.params.id);
    if (isNaN(eventId)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }
    const actor = req.body?.actor || 'ops';
    const result = await cancelEvent(eventId, actor);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /hub/v1/events/:id/positions
eventsRouter.get('/:id/positions', async (req, res, next) => {
  try {
    const eventId = Number(req.params.id);
    if (isNaN(eventId)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }
    const positions = await getEventPositions(eventId);
    res.json(positions);
  } catch (err) {
    next(err);
  }
});

// GET /hub/v1/events/:id/applications
eventsRouter.get('/:id/applications', listEventApplicationsHandler);

export const positionsRouter = Router();

// PATCH /hub/v1/positions/:id
positionsRouter.patch('/:id', async (req, res, next) => {
  try {
    const positionId = Number(req.params.id);
    if (isNaN(positionId)) {
      return res.status(400).json({ error: 'Invalid position ID' });
    }
    const { status, assignedTalentId } = req.body || {};
    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }
    const updated = await updatePositionStatus(positionId, status, assignedTalentId);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});
