import { Router } from 'express';
import {
  getEventApplications,
  handleApplicationTransition,
} from '../services/applicationsService.js';
import { ApplicationStatus } from '../services/stateMachine.js';

export const applicationsRouter = Router();

// GET /hub/v1/events/:id/applications
export async function listEventApplicationsHandler(req: any, res: any, next: any) {
  try {
    const eventId = Number(req.params.id);
    if (isNaN(eventId)) {
      return res.status(400).json({ error: 'Invalid event ID' });
    }
    const applications = await getEventApplications(eventId);
    res.json(applications);
  } catch (err) {
    next(err);
  }
}

// PATCH /hub/v1/applications/:id
applicationsRouter.patch('/:id', async (req, res, next) => {
  try {
    const applicationId = Number(req.params.id);
    if (isNaN(applicationId)) {
      return res.status(400).json({ error: 'Invalid application ID' });
    }

    const { status, actor, note } = req.body || {};
    if (!status) {
      return res.status(400).json({ error: 'status field is required' });
    }

    const result = await handleApplicationTransition(applicationId, {
      status: status as ApplicationStatus,
      actor,
      note,
    });

    res.json(result);
  } catch (err: any) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});
