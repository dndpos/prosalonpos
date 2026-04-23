/**
 * slipEvents.js — cc15 — GET the audit log for a slip barcode.
 *
 * One endpoint: GET /api/v1/slip-events/:shortId
 * Returns every SlipEvent row for the given 8-hex barcode, oldest first.
 * The client's History viewer renders this as a timeline.
 */
import { Router } from 'express';
import prisma from '../config/database.js';

var router = Router();

router.get('/:shortId', async function(req, res, next) {
  try {
    var shortId = (req.params.shortId || '').trim().toLowerCase();
    if (!/^[0-9a-f]{8}$/.test(shortId)) {
      return res.status(400).json({ error: 'shortId must be 8 hex chars' });
    }
    var events = await prisma.slipEvent.findMany({
      where: { salon_id: req.salon_id, short_id: shortId },
      orderBy: { created_at: 'asc' },
    });
    res.json({ shortId: shortId, events: events });
  } catch (err) { next(err); }
});

export default router;
