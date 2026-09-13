import { Router } from 'express';
import {
  getNotifications,
  resolveNotification,
  getDashboardSummary,
  getMetricsByType,
} from '../services/dashboardService.js';

export const dashboardRouter = Router();

// GET /hub/v1/dashboard/summary
dashboardRouter.get('/summary', async (_req, res, next) => {
  try {
    const summary = await getDashboardSummary();
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

export const notificationsRouter = Router();

// GET /hub/v1/notifications
notificationsRouter.get('/', async (req, res, next) => {
  try {
    const query = {
      status: req.query.status as any,
      severity: req.query.severity as string | undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 50,
    };
    const result = await getNotifications(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// PATCH /hub/v1/notifications/:id/resolve
notificationsRouter.patch('/:id/resolve', async (req, res, next) => {
  try {
    const notificationId = Number(req.params.id);
    if (isNaN(notificationId)) {
      return res.status(400).json({ error: 'Invalid notification ID' });
    }
    const resolved = await resolveNotification(notificationId);
    res.json(resolved);
  } catch (err: any) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

export const metricsRouter = Router();

// GET /hub/v1/metrics/:type
metricsRouter.get('/:type', async (req, res, next) => {
  try {
    const type = req.params.type as 'staffing' | 'recruiting' | 'operations';
    const metrics = await getMetricsByType(type);
    res.json(metrics);
  } catch (err: any) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});
