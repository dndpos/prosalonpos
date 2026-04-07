/**
 * reportsUtils.js — Utility functions for Reports module
 * Session 88: Extracted from reportsMockData.js (non-mock helpers only)
 */

import { useStaffStore } from '../../lib/stores/staffStore';

// Helper: get staff display name — reads from staffStore
export function getStaffName(staffId) {
  var staff = useStaffStore.getState().staff || [];
  var s = staff.find(function(st) { return st.id === staffId; });
  return s ? s.display_name : staffId;
}

// Payment method labels + colors
export var PAYMENT_LABELS = { cash: 'Cash', credit: 'Credit Card', gift: 'Gift Card', zelle: 'Zelle', package: 'Package' };
export var PAYMENT_COLORS = { cash: '#22C55E', credit: '#38BDF8', gift: '#F59E0B', zelle: '#8B5CF6', package: '#A855F7' };
