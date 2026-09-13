import { Router } from 'express';
import {
  searchTalent,
  getTalentById,
  createTalent,
  getTalentCommunications,
} from '../services/talentService.js';

export const talentRouter = Router();

// GET /hub/v1/talent
talentRouter.get('/', async (req, res, next) => {
  try {
    const query = {
      search: req.query.search as string | undefined,
      homeMarket: req.query.homeMarket as string | undefined,
      source: req.query.source as string | undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 20,
    };
    const result = await searchTalent(query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /hub/v1/talent (With mandatory email/phone deduplication check)
talentRouter.post('/', async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, homeMarket, source, pbProfileUrl, thProfileUrl, notes } = req.body || {};

    if (!firstName || !lastName || !email || !phone) {
      return res.status(400).json({ error: 'firstName, lastName, email, and phone are required' });
    }

    const talent = await createTalent({
      firstName,
      lastName,
      email,
      phone,
      homeMarket,
      source,
      pbProfileUrl,
      thProfileUrl,
      notes,
    });

    res.status(201).json(talent);
  } catch (err: any) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

// GET /hub/v1/talent/:id
talentRouter.get('/:id', async (req, res, next) => {
  try {
    const talentId = Number(req.params.id);
    if (isNaN(talentId)) {
      return res.status(400).json({ error: 'Invalid talent ID' });
    }
    const talent = await getTalentById(talentId);
    res.json(talent);
  } catch (err: any) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

// GET /hub/v1/talent/:id/communications
talentRouter.get('/:id/communications', async (req, res, next) => {
  try {
    const talentId = Number(req.params.id);
    if (isNaN(talentId)) {
      return res.status(400).json({ error: 'Invalid talent ID' });
    }
    const logs = await getTalentCommunications(talentId);
    res.json(logs);
  } catch (err: any) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});
