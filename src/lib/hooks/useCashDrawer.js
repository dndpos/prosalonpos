import { useState } from 'react';

/**
 * useCashDrawer — Cash Drawer session state management (Session 36)
 * Extracted from App.jsx in Session 109.
 */
export default function useCashDrawer() {
  var [drawerSession, setDrawerSession] = useState(null);
  var [showCashierModal, setShowCashierModal] = useState(false);
  var [cashierStaff, setCashierStaff] = useState(null);

  function handleDrawerOpen(startingCents, staff) {
    setDrawerSession({
      id: 'drawer-' + Date.now(),
      cashier_id: staff ? staff.id : 'unknown',
      cashier_name: staff ? staff.display_name : 'Unknown',
      opened_at: Date.now(),
      closed_at: null,
      starting_cents: startingCents,
      reported_cents: null,
      cash_payments: [],
      status: 'open',
    });
  }

  function handleDrawerClose(reportedCents) {
    setDrawerSession(function(prev) {
      if (!prev) return null;
      return Object.assign({}, prev, { closed_at: Date.now(), reported_cents: reportedCents, status: 'closed' });
    });
  }

  function handleDrawerDismiss() {
    if (drawerSession && drawerSession.status === 'closed') setDrawerSession(null);
    setShowCashierModal(false);
  }

  function handleCashPaymentTracked(amountCents, ticketId) {
    setDrawerSession(function(prev) {
      if (!prev || prev.status !== 'open') return prev;
      return Object.assign({}, prev, {
        cash_payments: prev.cash_payments.concat([{ ticket_id: ticketId || 'unknown', amount_cents: amountCents, timestamp: Date.now() }]),
      });
    });
  }

  return {
    drawerSession: drawerSession,
    showCashierModal: showCashierModal,
    setShowCashierModal: setShowCashierModal,
    cashierStaff: cashierStaff,
    setCashierStaff: setCashierStaff,
    handleDrawerOpen: handleDrawerOpen,
    handleDrawerClose: handleDrawerClose,
    handleDrawerDismiss: handleDrawerDismiss,
    handleCashPaymentTracked: handleCashPaymentTracked,
  };
}
