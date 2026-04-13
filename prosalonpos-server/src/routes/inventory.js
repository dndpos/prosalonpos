/**
 * ProSalonPOS — Inventory Routes
 * Products, product categories, and suppliers.
 * All endpoints require JWT authentication.
 *
 * Store expects:
 *   GET  /products           → { products: [...] }
 *   POST /products           → { product: {...} }
 *   PUT  /products/:id       → { product: {...} }
 *   POST /products/:id/adjust → { product: {...} }
 *   GET  /suppliers          → { suppliers: [...] }
 *   POST /suppliers          → { supplier: {...} }
 *   PUT  /suppliers/:id      → { supplier: {...} }
 *   GET  /categories         → { categories: [...] }
 *   POST /categories         → { category: {...} }
 *   PUT  /categories/:id     → { category: {...} }
 *   DELETE /categories/:id   → { category: {...} }
 */
import { Router } from 'express';
import prisma from '../config/database.js';
import { emit } from '../utils/emit.js';

var router = Router();

/**
 * Format a product from Prisma into the shape the frontend expects.
 * DB uses stock_qty / low_stock_qty; frontend uses stock_quantity / low_stock_threshold.
 * We return BOTH so either name works.
 */
function formatProduct(p) {
  var obj = Object.assign({}, p);
  obj.stock_quantity = p.stock_qty;
  obj.low_stock_threshold = p.low_stock_qty;
  return obj;
}

// ════════════════════════════════════════════
// PRODUCTS
// ════════════════════════════════════════════

// ── GET /products — List all products ──
router.get('/products', async function(req, res, next) {
  try {
    var products = await prisma.product.findMany({
      where: { salon_id: req.salon_id },
      include: { category: true, supplier: true },
      orderBy: [{ category_id: 'asc' }, { position: 'asc' }]
    });
    res.json({ products: products.map(formatProduct) });
  } catch (err) { next(err); }
});

// ── GET /products/:id — Single product ──
router.get('/products/:id', async function(req, res, next) {
  try {
    var product = await prisma.product.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id },
      include: { category: true, supplier: true }
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ product: formatProduct(product) });
  } catch (err) { next(err); }
});

// ── POST /products — Create product ──
router.post('/products', async function(req, res, next) {
  try {
    var d = req.body;
    var product = await prisma.product.create({
      data: {
        salon_id: req.salon_id,
        category_id: d.category_id,
        name: d.name,
        sku: d.sku || null,
        barcode: d.barcode || null,
        price_cents: d.price_cents || 0,
        cost_cents: d.cost_cents || 0,
        stock_qty: d.stock_qty != null ? d.stock_qty : (d.stock_quantity || 0),
        low_stock_qty: d.low_stock_qty != null ? d.low_stock_qty : (d.low_stock_threshold || 5),
        supplier_id: d.supplier_id || null,
        active: d.active !== false,
        position: d.position || 0,
      },
      include: { category: true, supplier: true }
    });
    emit(req, 'inventory:created');
    res.status(201).json({ product: formatProduct(product) });
  } catch (err) { next(err); }
});

// ── PUT /products/:id — Update product ──
router.put('/products/:id', async function(req, res, next) {
  try {
    var existing = await prisma.product.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id }
    });
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    var d = req.body;
    var updateData = {};
    var fields = ['name', 'sku', 'barcode', 'price_cents', 'cost_cents',
      'stock_qty', 'low_stock_qty', 'category_id', 'supplier_id',
      'active', 'position'];
    fields.forEach(function(f) {
      if (d[f] !== undefined) updateData[f] = d[f];
    });
    // Accept frontend field name aliases
    if (d.stock_quantity !== undefined && updateData.stock_qty === undefined) {
      updateData.stock_qty = d.stock_quantity;
    }
    if (d.low_stock_threshold !== undefined && updateData.low_stock_qty === undefined) {
      updateData.low_stock_qty = d.low_stock_threshold;
    }
    updateData.version = { increment: 1 };

    var product = await prisma.product.update({
      where: { id: req.params.id },
      data: updateData,
      include: { category: true, supplier: true }
    });
    emit(req, 'inventory:updated');
    res.json({ product: formatProduct(product) });
  } catch (err) { next(err); }
});

// ── POST /products/:id/adjust — Adjust stock quantity ──
router.post('/products/:id/adjust', async function(req, res, next) {
  try {
    var existing = await prisma.product.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id }
    });
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    var quantity = req.body.quantity || 0;
    var newQty = Math.max(0, existing.stock_qty + quantity);

    var product = await prisma.product.update({
      where: { id: req.params.id },
      data: { stock_qty: newQty, version: { increment: 1 } },
      include: { category: true, supplier: true }
    });
    emit(req, 'inventory:updated');
    res.json({ product: formatProduct(product) });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// SUPPLIERS
// ════════════════════════════════════════════

// ── GET /suppliers — List all suppliers ──
router.get('/suppliers', async function(req, res, next) {
  try {
    var suppliers = await prisma.supplier.findMany({
      where: { salon_id: req.salon_id },
      orderBy: { name: 'asc' }
    });
    res.json({ suppliers: suppliers });
  } catch (err) { next(err); }
});

// ── POST /suppliers — Create supplier ──
router.post('/suppliers', async function(req, res, next) {
  try {
    var d = req.body;
    var supplier = await prisma.supplier.create({
      data: {
        salon_id: req.salon_id,
        name: d.name,
        contact: d.contact || null,
        phone: d.phone || null,
        email: d.email || null,
        active: d.active !== false,
      }
    });
    emit(req, 'inventory:supplier-created');
    res.status(201).json({ supplier: supplier });
  } catch (err) { next(err); }
});

// ── PUT /suppliers/:id — Update supplier ──
router.put('/suppliers/:id', async function(req, res, next) {
  try {
    var existing = await prisma.supplier.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id }
    });
    if (!existing) return res.status(404).json({ error: 'Supplier not found' });

    var d = req.body;
    var updateData = {};
    var fields = ['name', 'contact', 'phone', 'email', 'active'];
    fields.forEach(function(f) {
      if (d[f] !== undefined) updateData[f] = d[f];
    });
    updateData.version = { increment: 1 };

    var supplier = await prisma.supplier.update({
      where: { id: req.params.id },
      data: updateData
    });
    emit(req, 'inventory:supplier-updated');
    res.json({ supplier: supplier });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// PRODUCT CATEGORIES
// ════════════════════════════════════════════

// ── GET /categories — List product categories ──
router.get('/categories', async function(req, res, next) {
  try {
    var categories = await prisma.productCategory.findMany({
      where: { salon_id: req.salon_id },
      orderBy: { position: 'asc' }
    });
    res.json({ categories: categories });
  } catch (err) { next(err); }
});

// ── POST /categories — Create product category ──
router.post('/categories', async function(req, res, next) {
  try {
    var d = req.body;
    var category = await prisma.productCategory.create({
      data: {
        salon_id: req.salon_id,
        name: d.name,
        position: d.position || 0,
        active: d.active !== false,
      }
    });
    emit(req, 'inventory:category-created');
    res.status(201).json({ category: category });
  } catch (err) { next(err); }
});

// ── PUT /categories/:id — Update product category ──
router.put('/categories/:id', async function(req, res, next) {
  try {
    var existing = await prisma.productCategory.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id }
    });
    if (!existing) return res.status(404).json({ error: 'Category not found' });

    var d = req.body;
    var updateData = {};
    var fields = ['name', 'position', 'active', 'taxable'];
    fields.forEach(function(f) {
      if (d[f] !== undefined) updateData[f] = d[f];
    });
    updateData.version = { increment: 1 };

    var category = await prisma.productCategory.update({
      where: { id: req.params.id },
      data: updateData
    });
    emit(req, 'inventory:category-updated');
    res.json({ category: category });
  } catch (err) { next(err); }
});

// ── DELETE /categories/:id — Delete product category ──
router.delete('/categories/:id', async function(req, res, next) {
  try {
    var existing = await prisma.productCategory.findFirst({
      where: { id: req.params.id, salon_id: req.salon_id }
    });
    if (!existing) return res.status(404).json({ error: 'Category not found' });

    // Check if any products use this category
    var productCount = await prisma.product.count({
      where: { category_id: req.params.id }
    });
    if (productCount > 0) {
      return res.status(400).json({ error: 'Cannot delete category with ' + productCount + ' products. Move or delete them first.' });
    }

    await prisma.productCategory.delete({ where: { id: req.params.id } });
    emit(req, 'inventory:category-deleted');
    res.json({ category: existing });
  } catch (err) { next(err); }
});

export default router;
