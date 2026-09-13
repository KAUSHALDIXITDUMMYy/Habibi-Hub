import { Router } from 'express';
import {
  upsertPlatformConfig,
  getPlatformConfig,
  listPlatformConfigs,
} from '../services/platformConfigService.js';

export const platformConfigRouter = Router();

// GET /hub/v1/platform-config
platformConfigRouter.get('/', async (_req, res, next) => {
  try {
    const configs = await listPlatformConfigs();
    res.json(configs);
  } catch (err) {
    next(err);
  }
});

// GET /hub/v1/platform-config/:platform
platformConfigRouter.get('/:platform', async (req, res, next) => {
  try {
    const config = await getPlatformConfig(req.params.platform);
    res.json(config);
  } catch (err: any) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

// PUT /hub/v1/platform-config/:platform
platformConfigRouter.put('/:platform', async (req, res, next) => {
  try {
    const { apiKeyRef, baseUrl, scopes } = req.body || {};
    const config = await upsertPlatformConfig(req.params.platform, {
      apiKeyRef,
      baseUrl,
      scopes,
    });
    res.json(config);
  } catch (err: any) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});
