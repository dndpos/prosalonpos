/**
 * ProSalonPOS — Services & Categories Routes
 * Handles service catalog CRUD and category management.
 * Junction table handles multi-category assignment (TD-001 fix).
 */
import { Router } from 'express';
import prisma from '../config/database.js';
import { emit } from '../utils/emit.js';

var router = Router();

// ════════════════════════════════════════════
// CATEGORIES
// ════════════════════════════════════════════

// ── GET /categories — List all categories ──
router.get('/categories', async function(req, res, next) {
  try {
    var cats = await prisma.serviceCategory.findMany({
      where: { salon_id: req.salon_id },
      orderBy: { position: 'asc' }
    });
    res.json({ categories: cats });
  } catch (err) { next(err); }
});

// ── POST /categories — Create category ──
router.post('/categories', async function(req, res, next) {
  try {
    var data = req.body;
    var cat = await prisma.serviceCategory.create({
      data: {
        salon_id: req.salon_id,
        name: data.name,
        calendar_color: data.calendar_color || '#3B82F6',
        position: data.position || 0,
        active: data.active !== false
      }
    });
    emit(req, 'category:created');
    res.status(201).json({ category: cat });
  } catch (err) { next(err); }
});

// ── PUT /categories/:id — Update category ──
router.put('/categories/:id', async function(req, res, next) {
  try {
    var existing = await prisma.serviceCategory.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id }
    });
    if (!existing) return res.status(404).json({ error: 'Category not found' });

    var cat = await prisma.serviceCategory.update({
      where: { id: req.params.id },
      data: Object.assign({}, req.body, { version: { increment: 1 } })
    });
    emit(req, 'category:updated');
    res.json({ category: cat });
  } catch (err) { next(err); }
});

// ── DELETE /categories/:id — Soft delete ──
router.delete('/categories/:id', async function(req, res, next) {
  try {
    var cat = await prisma.serviceCategory.update({
      where: { id: req.params.id },
      data: { active: false, version: { increment: 1 } }
    });
    emit(req, 'category:deleted');
    res.json({ category: cat });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// SERVICES
// ════════════════════════════════════════════

// ── GET / — List all services with their category_ids ──
router.get('/', async function(req, res, next) {
  try {
    var services = await prisma.serviceCatalog.findMany({
      where: { salon_id: req.salon_id },
      include: { category_links: true },
      orderBy: { position: 'asc' }
    });

    // Map to frontend shape: add category_ids array
    var result = services.map(function(s) {
      var obj = Object.assign({}, s);
      obj.category_ids = s.category_links.map(function(l) { return l.category_id; });
      delete obj.category_links;
      return obj;
    });

    res.json({ services: result });
  } catch (err) { next(err); }
});

// ── POST / — Create service ──
router.post('/', async function(req, res, next) {
  try {
    var data = req.body;
    var svc = await prisma.serviceCatalog.create({
      data: {
        salon_id: req.salon_id,
        name: data.name,
        calendar_color: data.calendar_color || '#3B82F6',
        default_duration_minutes: data.default_duration_minutes || 30,
        price_cents: data.price_cents || 0,
        product_cost_cents: data.product_cost_cents || 0,
        open_price: data.open_price || false,
        requires_room: data.requires_room || false,
        active: data.active !== false,
        online_booking_enabled: data.online_booking_enabled !== false,
        description: data.description || '',
        position: data.position || 0,
      }
    });

    // Create category links
    if (data.category_ids && data.category_ids.length > 0) {
      await prisma.serviceCatalogCategory.createMany({
        data: data.category_ids.map(function(catId, i) {
          return { service_catalog_id: svc.id, category_id: catId, position: i };
        })
      });
    }

    emit(req, 'service:created');
    svc.category_ids = data.category_ids || [];
    res.status(201).json({ service: svc });
  } catch (err) { next(err); }
});

// ── PUT /:id — Update service ──
router.put('/:id', async function(req, res, next) {
  try {
    var existing = await prisma.serviceCatalog.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id }
    });
    if (!existing) return res.status(404).json({ error: 'Service not found' });

    var data = req.body;
    var updateData = {};
    var fields = ['name', 'calendar_color', 'default_duration_minutes', 'price_cents',
      'product_cost_cents', 'open_price', 'requires_room', 'active',
      'online_booking_enabled', 'description', 'position'];

    fields.forEach(function(f) {
      if (data[f] !== undefined) updateData[f] = data[f];
    });
    updateData.version = { increment: 1 };

    var svc = await prisma.serviceCatalog.update({
      where: { id: req.params.id },
      data: updateData
    });

    // Update category links if provided
    if (data.category_ids) {
      await prisma.serviceCatalogCategory.deleteMany({
        where: { service_catalog_id: req.params.id }
      });
      if (data.category_ids.length > 0) {
        await prisma.serviceCatalogCategory.createMany({
          data: data.category_ids.map(function(catId, i) {
            return { service_catalog_id: req.params.id, category_id: catId, position: i };
          })
        });
      }
    }

    emit(req, 'service:updated');
    svc.category_ids = data.category_ids || [];
    res.json({ service: svc });
  } catch (err) { next(err); }
});

// ── DELETE /:id — Soft delete ──
router.delete('/:id', async function(req, res, next) {
  try {
    var svc = await prisma.serviceCatalog.update({
      where: { id: req.params.id },
      data: { active: false, version: { increment: 1 } }
    });
    emit(req, 'service:deleted');
    res.json({ service: svc });
  } catch (err) { next(err); }
});

export default router;
