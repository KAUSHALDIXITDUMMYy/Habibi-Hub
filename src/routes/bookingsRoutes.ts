import { Router } from 'express';
import {
  createBooking,
  updateBooking,
  deleteBooking,
} from '../services/bookingsService.js';

export const bookingsRouter = Router();

// POST /hub/v1/bookings
bookingsRouter.post('/', async (req, res, next) => {
  try {
    const { positionId, talentId, externalBookingId, isDemosShiftId, paymentAgreementRequired } = req.body || {};

    if (!positionId || !talentId) {
      return res.status(400).json({ error: 'positionId and talentId are required' });
    }

    const booking = await createBooking({
      positionId: Number(positionId),
      talentId: Number(talentId),
      externalBookingId,
      isDemosShiftId: isDemosShiftId ? Number(isDemosShiftId) : undefined,
      paymentAgreementRequired,
    });

    res.status(201).json(booking);
  } catch (err: any) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

// PATCH /hub/v1/bookings/:id
bookingsRouter.patch('/:id', async (req, res, next) => {
  try {
    const bookingId = Number(req.params.id);
    if (isNaN(bookingId)) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }

    const updated = await updateBooking(bookingId, req.body || {});
    res.json(updated);
  } catch (err: any) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

// DELETE /hub/v1/bookings/:id
bookingsRouter.delete('/:id', async (req, res, next) => {
  try {
    const bookingId = Number(req.params.id);
    if (isNaN(bookingId)) {
      return res.status(400).json({ error: 'Invalid booking ID' });
    }

    const result = await deleteBooking(bookingId);
    res.json(result);
  } catch (err: any) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});
