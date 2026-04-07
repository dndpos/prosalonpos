/** Pro Salon POS — Commission Rules Engine (Session 27)
 *
 * Pure calculation logic. No UI, no React.
 * Implements the full commission resolution priority from Session 14:
 *   1. Per-tech + per-item rate (most specific)
 *   2. Per-tech + per-category rate
 *   3. Per-tech + flat rate
 *   4. Location + per-item rate
 *   5. Location + per-category rate
 *   6. Location + flat rate (least specific)
 *
 * If tiered rates are enabled, the tier percentage replaces the flat rate
 * at whichever level it applies. Per-item and per-category overrides
 * still take precedence over the tiered rate.
 *
 * Retail product commission is ONLY calculated when retail_commission_enabled
 * is true in salon settings. Default is OFF — salons do not pay commission
 * on product sales unless the owner explicitly turns it on.
 */

// ═══════════════════════════════════════════
// RESOLVE COMMISSION RATE FOR A SINGLE LINE ITEM
// ═══════════════════════════════════════════

/**
 * Find the applicable commission percentage for a single service or product.
 *
 * @param {Object} params
 * @param {string} params.staffId         - Tech who performed/sold
 * @param {string} params.itemId          - service_catalog_id or product_id
 * @param {string[]} params.categoryIds   - Category IDs the item belongs to
 * @param {string} params.appliesTo       - 'service' or 'retail'
 * @param {Object[]} params.rules         - All CommissionRule records
 * @param {number|null} params.tieredPct  - Tiered rate for this tech (if applicable), replaces flat
 * @returns {number} Commission percentage (e.g. 40 = 40%)
 */
export function resolveCommissionRate(params) {
  var staffId = params.staffId;
  var itemId = params.itemId;
  var categoryIds = params.categoryIds || [];
  var appliesTo = params.appliesTo;
  var rules = params.rules || [];
  var tieredPct = params.tieredPct;

  // Filter rules to this appliesTo type
  var applicable = rules.filter(function(r) { return r.applies_to === appliesTo; });

  // Priority 1: Per-tech + per-item
  var match = applicable.find(function(r) {
    return r.staff_id === staffId && r.scope === 'item' &&
      (r.service_catalog_id === itemId || r.product_id === itemId);
  });
  if (match) return match.percentage;

  // Priority 2: Per-tech + per-category (check all categories the item belongs to)
  for (var ci = 0; ci < categoryIds.length; ci++) {
    match = applicable.find(function(r) {
      return r.staff_id === staffId && r.scope === 'category' && r.category_id === categoryIds[ci];
    });
    if (match) return match.percentage;
  }

  // Priority 3: Per-tech + flat rate
  match = applicable.find(function(r) {
    return r.staff_id === staffId && r.scope === 'flat';
  });
  if (match) return match.percentage;

  // Priority 4: Location + per-item
  match = applicable.find(function(r) {
    return !r.staff_id && r.scope === 'item' &&
      (r.service_catalog_id === itemId || r.product_id === itemId);
  });
  if (match) return match.percentage;

  // Priority 5: Location + per-category
  for (var ci2 = 0; ci2 < categoryIds.length; ci2++) {
    match = applicable.find(function(r) {
      return !r.staff_id && r.scope === 'category' && r.category_id === categoryIds[ci2];
    });
    if (match) return match.percentage;
  }

  // Priority 6: Location + flat rate
  // If tiered rates are enabled and we have a tiered percentage, it replaces the flat rate
  if (tieredPct !== null && tieredPct !== undefined) {
    return tieredPct;
  }
  match = applicable.find(function(r) {
    return !r.staff_id && r.scope === 'flat';
  });
  if (match) return match.percentage;

  return 0;
}


// ═══════════════════════════════════════════
// RESOLVE TIERED PERCENTAGE
// ═══════════════════════════════════════════

/**
 * Determine the tiered commission percentage based on total revenue in the pay period.
 * Tiers are evaluated against cumulative service revenue.
 *
 * @param {number} totalRevenueCents - Total service revenue for this tech in the pay period
 * @param {Object[]} tiers - CommissionTier records (sorted by position)
 * @returns {number|null} Tiered percentage, or null if no tiers configured
 */
export function resolvetieredPct(totalRevenueCents, tiers) {
  if (!tiers || tiers.length === 0) return null;

  // Sort by position ascending (should already be, but be safe)
  var sorted = tiers.slice().sort(function(a, b) { return a.position - b.position; });

  // Find the highest tier the tech qualifies for
  var result = sorted[0].percentage; // Default to lowest tier
  for (var i = 0; i < sorted.length; i++) {
    if (totalRevenueCents >= sorted[i].min_revenue_cents) {
      result = sorted[i].percentage;
    }
  }
  return result;
}


// ═══════════════════════════════════════════
// GET TIERS FOR A SPECIFIC TECH
// ═══════════════════════════════════════════

/**
 * Get the applicable tier brackets for a tech.
 * Per-tech tiers override location tiers.
 *
 * @param {string} staffId
 * @param {Object[]} allTiers - All CommissionTier records
 * @param {string} tierMode - 'uniform' or 'per_tech'
 * @returns {Object[]} Applicable tier records
 */
export function getTiersForStaff(staffId, allTiers, tierMode) {
  if (!allTiers || allTiers.length === 0) return [];

  if (tierMode === 'per_tech') {
    // Look for per-tech tiers first
    var techTiers = allTiers.filter(function(t) { return t.staff_id === staffId; });
    if (techTiers.length > 0) return techTiers;
  }

  // Fall back to location tiers (staff_id is null)
  return allTiers.filter(function(t) { return !t.staff_id; });
}


// ═══════════════════════════════════════════
// MAIN: CALCULATE COMMISSION FOR A TECH
// ═══════════════════════════════════════════

/**
 * Calculate total commission earnings for a technician over a pay period.
 *
 * @param {Object} params
 * @param {Object} params.staff            - Staff record
 * @param {Object[]} params.serviceLines   - Service lines for this tech in the period
 *   Each: { service_catalog_id, price_cents, category_ids }
 * @param {Object[]} params.productSales   - Product sales for this tech in the period
 *   Each: { product_id, price_cents, category_ids }
 * @param {Object[]} params.rules          - All CommissionRule records
 * @param {Object[]} params.tiers          - All CommissionTier records
 * @param {Object} params.settings         - Salon settings object
 * @param {Object[]} params.services       - Service catalog (for looking up category_ids)
 * @returns {Object} { service_commission, retail_commission, total_commission, details[] }
 */
export function calculateCommission(params) {
  var staff = params.staff;
  var serviceLines = params.serviceLines || [];
  var productSales = params.productSales || [];
  var rules = params.rules || [];
  var tiers = params.tiers || [];
  var settings = params.settings || {};
  var services = params.services || [];

  var commissionEnabled = settings.commission_enabled !== false; // default true for backward compat
  if (!commissionEnabled) {
    return { service_commission: 0, retail_commission: 0, total_commission: 0, details: [] };
  }

  var tieredEnabled = !!settings.commission_tiered_enabled;
  var tierMode = settings.commission_tier_mode || 'uniform';
  var details = [];

  // ── Service commission ──
  var serviceCommission = 0;

  // Calculate total service revenue first (needed for tiered evaluation)
  var totalServiceRevenue = 0;
  serviceLines.forEach(function(sl) { totalServiceRevenue += sl.price_cents || 0; });

  // Resolve tiered percentage if enabled
  var tieredPct = null;
  if (tieredEnabled) {
    var staffTiers = getTiersForStaff(staff.id, tiers, tierMode);
    tieredPct = resolvetieredPct(totalServiceRevenue, staffTiers);
  }

  // Calculate commission per service line
  serviceLines.forEach(function(sl) {
    // Look up category_ids from service catalog if not on the line
    var catIds = sl.category_ids;
    if (!catIds) {
      var svc = services.find(function(s) { return s.id === sl.service_catalog_id; });
      catIds = svc ? svc.category_ids : [];
    }

    var pct = resolveCommissionRate({
      staffId: staff.id,
      itemId: sl.service_catalog_id,
      categoryIds: catIds,
      appliesTo: 'service',
      rules: rules,
      tieredPct: tieredPct,
    });

    var amount = Math.round(sl.price_cents * pct / 100);
    serviceCommission += amount;

    details.push({
      type: 'service',
      item_id: sl.service_catalog_id,
      price_cents: sl.price_cents,
      rate_pct: pct,
      commission_cents: amount,
    });
  });

  // ── Retail commission ──
  // IMPORTANT: Only calculated when retail_commission_enabled is ON.
  // Default is OFF — most salons do NOT pay commission on product sales.
  var retailCommission = 0;

  if (settings.retail_commission_enabled && productSales.length > 0) {
    productSales.forEach(function(ps) {
      var pct = resolveCommissionRate({
        staffId: staff.id,
        itemId: ps.product_id,
        categoryIds: ps.category_ids || [],
        appliesTo: 'retail',
        rules: rules,
        tieredPct: null, // Tiers do NOT apply to retail — service only
      });

      var amount = Math.round(ps.price_cents * pct / 100);
      retailCommission += amount;

      details.push({
        type: 'retail',
        item_id: ps.product_id,
        price_cents: ps.price_cents,
        rate_pct: pct,
        commission_cents: amount,
      });
    });
  }

  return {
    service_commission: serviceCommission,
    retail_commission: retailCommission,
    total_commission: serviceCommission + retailCommission,
    details: details,
  };
}


// ═══════════════════════════════════════════
// BACKWARD COMPATIBILITY: SIMPLE FLAT RATE
// ═══════════════════════════════════════════

/**
 * Fallback for when no commission rules are configured.
 * Uses the legacy staff.commission_pct field (simple flat rate).
 * This ensures existing payroll calculations still work during the
 * transition from simple flat rates to the full rules engine.
 *
 * @param {number} grossSalesCents - Total gross sales
 * @param {number} commissionPct   - Flat commission percentage from staff record
 * @returns {number} Commission amount in cents
 */
export function calculateSimpleCommission(grossSalesCents, commissionPct) {
  return Math.round(grossSalesCents * (commissionPct || 0) / 100);
}
