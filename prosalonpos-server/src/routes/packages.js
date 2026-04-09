/**
 * ProSalonPOS — Service Package Routes
 * Session 62 | Phase 2
 *
 * Business rules:
 *   - No commission on package sales (prepaid)
 *   - Commission earned at redemption at full catalog price
 *   - Package items track remaining count per service
 *   - Redemption decrements remaining; 0 remaining on all items → status 'depleted'
 *   - Expiration checked at redemption time (if enabled)
 *   - Empty assigned_service_ids = can do all services (D-436)
 */
import { Router } from 'express';
import prisma from '../config/database.js';
import { emit } from '../utils/emit.js';

var router = Router();

// ── Helper: format a package template for frontend ──
function formatPackage(pkg) {
  return {
    id: pkg.id,
    salon_id: pkg.salon_id,
    location_id: pkg.location_id,
    name: pkg.name,
    description: pkg.description,
    price_cents: pkg.price_cents,
    expiration_enabled: pkg.expiration_enabled,
    expiration_days: pkg.expiration_days,
    transferable: pkg.transferable,
    refundable: pkg.refundable,
    active: pkg.active,
    created_at: pkg.created_at,
    updated_at: pkg.updated_at,
  };
}

// ── Helper: format a package item for frontend ──
function formatItem(item) {
  return {
    id: item.id,
    package_id: item.package_id,
    service_id: item.service_id,
    service_name: item.service_name,
    quantity: item.quantity,
  };
}

// ── Helper: format a client package for frontend ──
function formatClientPackage(cp) {
  return {
    id: cp.id,
    client_id: cp.client_id,
    client_name: cp.client_name,
    package_id: cp.package_id,
    package_name: cp.package_name,
    price_paid_cents: cp.price_paid_cents,
    purchased_at: cp.purchased_at,
    expires_at: cp.expires_at,
    transferable: cp.transferable,
    refundable: cp.refundable,
    status: cp.status,
    sold_by_staff_id: cp.sold_by_staff_id,
    sold_by_staff_name: cp.sold_by_staff_name,
  };
}

// ── Helper: format a client package item for frontend ──
function formatClientItem(cpi) {
  return {
    id: cpi.id,
    client_package_id: cpi.client_package_id,
    service_id: cpi.service_id,
    service_name: cpi.service_name,
    total_quantity: cpi.total_quantity,
    remaining: cpi.remaining,
  };
}

// ── Helper: format a redemption for frontend ──
function formatRedemption(r) {
  return {
    id: r.id,
    client_package_id: r.client_package_id,
    client_package_item_id: r.client_package_item_id,
    ticket_id: r.ticket_id,
    service_redeemed_id: r.service_redeemed_id,
    service_redeemed_name: r.service_redeemed_name,
    package_service_id: r.package_service_id,
    package_service_name: r.package_service_name,
    upgrade_difference_cents: r.upgrade_difference_cents,
    redeemed_at: r.redeemed_at,
    staff_id: r.staff_id,
    staff_name: r.staff_name,
  };
}

// ════════════════════════════════════════════
// GET / — List all package templates + items
// ════════════════════════════════════════════
router.get('/', async function(req, res, next) {
  try {
    var packages = await prisma.servicePackage.findMany({
      where: { salon_id: req.salon_id },
      include: { items: true },
      orderBy: { created_at: 'desc' },
    });
    var formatted = packages.map(formatPackage);
    var allItems = [];
    packages.forEach(function(pkg) {
      pkg.items.forEach(function(item) {
        allItems.push(formatItem(item));
      });
    });
    res.json({ packages: formatted, packageItems: allItems });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// POST / — Create a package template + items
// Body: { package: {...}, items: [{service_id, service_name, quantity}, ...] }
// ════════════════════════════════════════════
router.post('/', async function(req, res, next) {
  try {
    var pkgData = req.body.package || req.body;
    var items = req.body.items || [];

    var pkg = await prisma.servicePackage.create({
      data: {
        salon_id: req.salon_id,
        location_id: pkgData.location_id || req.salon_id,
        name: pkgData.name,
        description: pkgData.description || null,
        price_cents: pkgData.price_cents || 0,
        expiration_enabled: pkgData.expiration_enabled || false,
        expiration_days: pkgData.expiration_days || null,
        transferable: pkgData.transferable || false,
        refundable: pkgData.refundable !== undefined ? pkgData.refundable : true,
        active: pkgData.active !== undefined ? pkgData.active : true,
        items: {
          create: items.map(function(it) {
            return {
              service_id: it.service_id,
              service_name: it.service_name,
              quantity: it.quantity || 1,
            };
          }),
        },
      },
      include: { items: true },
    });

    var formatted = formatPackage(pkg);
    var formattedItems = pkg.items.map(formatItem);

    emit(req, 'package:created', formatted);
    res.status(201).json({ package: formatted, items: formattedItems });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// PUT /:id — Update a package template + replace items
// Body: { package: {...}, items: [{service_id, service_name, quantity}, ...] }
// ════════════════════════════════════════════
router.put('/:id', async function(req, res, next) {
  try {
    var id = req.params.id;
    var updates = req.body.package || req.body;
    var items = req.body.items;

    // Build update data — only include fields that were sent
    var updateData = {};
    var allowed = ['name', 'description', 'price_cents', 'expiration_enabled', 'expiration_days',
      'transferable', 'refundable', 'active', 'location_id'];
    allowed.forEach(function(key) {
      if (updates[key] !== undefined) updateData[key] = updates[key];
    });

    var pkg = await prisma.servicePackage.update({
      where: { id: id },
      data: updateData,
      include: { items: true },
    });

    // Replace items if sent (delete all + recreate — same pattern as staff assigned_service_ids)
    var formattedItems;
    if (items) {
      await prisma.servicePackageItem.deleteMany({ where: { package_id: id } });
      var created = await Promise.all(items.map(function(it) {
        return prisma.servicePackageItem.create({
          data: {
            package_id: id,
            service_id: it.service_id,
            service_name: it.service_name,
            quantity: it.quantity || 1,
          },
        });
      }));
      formattedItems = created.map(formatItem);
    } else {
      formattedItems = pkg.items.map(formatItem);
    }

    var formatted = formatPackage(pkg);
    emit(req, 'package:updated', formatted);
    res.json({ package: formatted, items: formattedItems });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// GET /client/:clientId — Get client's purchased packages + remaining items
// ════════════════════════════════════════════
router.get('/client/:clientId', async function(req, res, next) {
  try {
    var clientId = req.params.clientId;
    var clientPkgs = await prisma.clientPackage.findMany({
      where: { salon_id: req.salon_id, client_id: clientId, status: 'active' },
      include: { items: true },
      orderBy: { purchased_at: 'desc' },
    });

    var formatted = clientPkgs.map(formatClientPackage);
    var allItems = [];
    clientPkgs.forEach(function(cp) {
      cp.items.forEach(function(cpi) {
        allItems.push(formatClientItem(cpi));
      });
    });

    res.json({ clientPackages: formatted, clientPackageItems: allItems });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// POST /sell — Sell a package to a client
// Body: { client_id, client_name, package_id, price_paid_cents, sold_by_staff_id, sold_by_staff_name }
// ════════════════════════════════════════════
router.post('/sell', async function(req, res, next) {
  try {
    var b = req.body;

    // Look up the package template for defaults
    var template = await prisma.servicePackage.findUnique({
      where: { id: b.package_id },
      include: { items: true },
    });
    if (!template) return res.status(404).json({ error: 'Package template not found' });

    // Calculate expiration
    var expiresAt = null;
    if (template.expiration_enabled && template.expiration_days) {
      var now = new Date();
      expiresAt = new Date(now.getTime() + template.expiration_days * 24 * 60 * 60 * 1000);
    }

    // Create the client package + items in a transaction
    var result = await prisma.$transaction(async function(tx) {
      var cp = await tx.clientPackage.create({
        data: {
          salon_id: req.salon_id,
          client_id: b.client_id,
          client_name: b.client_name || '',
          package_id: b.package_id,
          package_name: template.name,
          price_paid_cents: b.price_paid_cents !== undefined ? b.price_paid_cents : template.price_cents,
          expires_at: expiresAt,
          transferable: template.transferable,
          refundable: template.refundable,
          status: 'active',
          sold_by_staff_id: b.sold_by_staff_id || null,
          sold_by_staff_name: b.sold_by_staff_name || null,
        },
      });

      // Create client package items from template items
      var cpItems = await Promise.all(template.items.map(function(ti) {
        return tx.clientPackageItem.create({
          data: {
            client_package_id: cp.id,
            service_id: ti.service_id,
            service_name: ti.service_name,
            total_quantity: ti.quantity,
            remaining: ti.quantity,
          },
        });
      }));

      return { cp: cp, items: cpItems };
    });

    emit(req, 'package:sold', { clientPackage: formatClientPackage(result.cp) });
    res.status(201).json({
      clientPackage: formatClientPackage(result.cp),
      clientPackageItems: result.items.map(formatClientItem),
    });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// POST /redeem — Redeem a service from a client's package
// Body: { client_package_id, client_package_item_id, ticket_id,
//         service_redeemed_id, service_redeemed_name,
//         package_service_id, package_service_name,
//         upgrade_difference_cents, staff_id, staff_name }
// ════════════════════════════════════════════
router.post('/redeem', async function(req, res, next) {
  try {
    var b = req.body;

    // Look up the client package item
    var cpi = await prisma.clientPackageItem.findUnique({
      where: { id: b.client_package_item_id },
      include: { clientPackage: true },
    });
    if (!cpi) return res.status(404).json({ error: 'Client package item not found' });
    if (cpi.remaining <= 0) return res.status(400).json({ error: 'No remaining uses for this service' });

    // Check expiration
    if (cpi.clientPackage.expires_at && new Date() > new Date(cpi.clientPackage.expires_at)) {
      // Auto-expire the package
      await prisma.clientPackage.update({ where: { id: cpi.client_package_id }, data: { status: 'expired' } });
      return res.status(400).json({ error: 'Package has expired' });
    }

    // Create redemption + decrement remaining in a transaction
    var result = await prisma.$transaction(async function(tx) {
      var redemption = await tx.packageRedemption.create({
        data: {
          client_package_id: b.client_package_id,
          client_package_item_id: b.client_package_item_id,
          ticket_id: b.ticket_id || null,
          service_redeemed_id: b.service_redeemed_id || null,
          service_redeemed_name: b.service_redeemed_name || '',
          package_service_id: b.package_service_id || null,
          package_service_name: b.package_service_name || '',
          upgrade_difference_cents: b.upgrade_difference_cents || 0,
          staff_id: b.staff_id || null,
          staff_name: b.staff_name || null,
        },
      });

      // Decrement remaining
      var updatedItem = await tx.clientPackageItem.update({
        where: { id: b.client_package_item_id },
        data: { remaining: { decrement: 1 } },
      });

      // Check if all items in this client package are depleted
      var allItems = await tx.clientPackageItem.findMany({
        where: { client_package_id: b.client_package_id },
      });
      var allDepleted = allItems.every(function(item) { return item.remaining <= 0; });
      if (allDepleted) {
        await tx.clientPackage.update({ where: { id: b.client_package_id }, data: { status: 'depleted' } });
      }

      return { redemption: redemption, updatedItem: updatedItem };
    });

    emit(req, 'package:redeemed', { redemption: formatRedemption(result.redemption) });
    res.status(201).json({
      redemption: formatRedemption(result.redemption),
      clientPackageItem: formatClientItem(result.updatedItem),
    });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// POST /cleanup — Fix stale active packages where all items are depleted
// One-time or periodic cleanup. Sets status='depleted' where appropriate.
// ════════════════════════════════════════════
router.post('/cleanup', async function(req, res, next) {
  try {
    var activePkgs = await prisma.clientPackage.findMany({
      where: { salon_id: req.salon_id, status: 'active' },
      include: { items: true },
    });
    var fixed = 0;
    for (var i = 0; i < activePkgs.length; i++) {
      var cp = activePkgs[i];
      if (cp.items.length === 0) continue;
      var allDepleted = cp.items.every(function(item) { return item.remaining <= 0; });
      if (allDepleted) {
        await prisma.clientPackage.update({ where: { id: cp.id }, data: { status: 'depleted' } });
        fixed++;
      }
    }
    res.json({ message: 'Cleanup complete', packagesFixed: fixed });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// PUT /client-package/:id/deactivate — Cancel/deactivate a client package
// ════════════════════════════════════════════
router.put('/client-package/:id/deactivate', async function(req, res, next) {
  try {
    var cp = await prisma.clientPackage.update({
      where: { id: req.params.id },
      data: { status: 'cancelled' },
    });
    emit(req, 'package:updated', { clientPackage: formatClientPackage(cp) });
    res.json({ clientPackage: formatClientPackage(cp) });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// DELETE /client-package/:id — Delete a client package and its items/redemptions
// For cleaning up test data only
// ════════════════════════════════════════════
router.delete('/client-package/:id', async function(req, res, next) {
  try {
    var id = req.params.id;
    // Delete redemptions first (foreign key constraint)
    await prisma.packageRedemption.deleteMany({ where: { client_package_id: id } });
    // Delete items
    await prisma.clientPackageItem.deleteMany({ where: { client_package_id: id } });
    // Delete the client package
    await prisma.clientPackage.delete({ where: { id: id } });
    res.json({ deleted: true, id: id });
  } catch (err) { next(err); }
});

// ════════════════════════════════════════════
// DELETE /client-packages/client/:clientId — Delete ALL client packages for a client
// For cleaning up test data only
// ════════════════════════════════════════════
router.delete('/client-packages/client/:clientId', async function(req, res, next) {
  try {
    var clientId = req.params.clientId;
    var pkgs = await prisma.clientPackage.findMany({
      where: { salon_id: req.salon_id, client_id: clientId },
    });
    var count = 0;
    for (var i = 0; i < pkgs.length; i++) {
      await prisma.packageRedemption.deleteMany({ where: { client_package_id: pkgs[i].id } });
      await prisma.clientPackageItem.deleteMany({ where: { client_package_id: pkgs[i].id } });
      await prisma.clientPackage.delete({ where: { id: pkgs[i].id } });
      count++;
    }
    res.json({ deleted: count, client_id: clientId });
  } catch (err) { next(err); }
});

export default router;
