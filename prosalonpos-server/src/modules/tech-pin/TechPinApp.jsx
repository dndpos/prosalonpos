import { useState, useCallback } from 'react';

/**
 * Tech PIN — Micro-frontend: PIN Entry
 * src/modules/tech-pin/TechPinApp.jsx
 *
 * Standalone station screen — tech enters their PIN to identify themselves.
 * Used at stations where the salon prefers security over quick avatar taps.
 *
 * Flow:
 *   1. PIN numpad fills the screen
 *   2. Tech enters their 4-digit PIN
 *   3. System matches PIN to staff record
 *   4. → Next destination (TBD — logic undefined, placeholder confirmation for now)
 *
 * Rules:
 *   - Staff-facing, dark theme
 *   - ProSalonPOS branded
 *   - Desktop + tablet responsive
 *   - Big touch-friendly numpad keys (no <button> or <input> — div onClick only)
 *   - Calculator layout: 7-8-9 top, 4-5-6 middle, 1-2-3 bottom
 *   - Shows dots for entered digits (masked)
 *   - Phase 2: data comes from backend. Phase 1: mock data.
 */

import { useStaffStore } from '../../lib/stores/staffStore';
import AreaTag from '../../components/ui/AreaTag';

// Dark theme palette (staff-facing)
var T = {
  bg: '#0B1120',
  surface: '#131B2E',
  card: '#1A2340',
  cardHover: '#213055',
  text: '#F1F5F9',
  textSoft: '#94A3B8',
  textMuted: '#64748B',
  border: '#1E2D45',
  brand: '#3B82F6',
  brandSoft: 'rgba(59,130,246,0.15)',
  success: '#22C55E',
  successSoft: 'rgba(34,197,94,0.15)',
  danger: '#EF4444',
  dangerSoft: 'rgba(239,68,68,0.15)',
  chrome: '#1E293B',
  chromeDark: '#15202F',
};

var AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#06B6D4', '#84CC16'];

function getInitials(name) {
  if (!name) return '?';
  var parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

var PIN_LENGTH = 4;

export default function TechPinApp({ onTechSelected, onExit, stationMode, activeAppointments }) {
  var [digits, setDigits] = useState('');
  var [error, setError] = useState('');
  var [matchedTech, setMatchedTech] = useState(null);
  var allStaff = useStaffStore(function(s) { return s.staff; });

  var activeStaff = allStaff.filter(function(s) { return s.active; });

  var mode = stationMode || 'checkout';

  var handleDigit = useCallback(function(d) {
    setError('');
    setDigits(function(prev) {
      if (prev.length >= PIN_LENGTH) return prev;
      var next = prev + d;

      // Auto-submit on 4th digit
      if (next.length === PIN_LENGTH) {
        var found = activeStaff.find(function(s) { return s.pin === next; });
        if (found) {
          setMatchedTech(found);
        } else {
          setError('PIN not recognized');
          // Clear after brief delay
          setTimeout(function() {
            setDigits('');
            setError('');
          }, 1200);
        }
      }

      return next;
    });
  }, [activeStaff]);

  var handleBackspace = useCallback(function() {
    setError('');
    setDigits(function(prev) { return prev.slice(0, -1); });
  }, []);

  var handleClear = useCallback(function() {
    setError('');
    setDigits('');
  }, []);

  function handleConfirm() {
    if (onTechSelected) {
      onTechSelected(matchedTech);
    }
    setMatchedTech(null);
    setDigits('');
  }

  function handleCancel() {
    setMatchedTech(null);
    setDigits('');
  }

  // Numpad layout: calculator style (7-8-9 top)
  var rows = [
    ['7', '8', '9'],
    ['4', '5', '6'],
    ['1', '2', '3'],
    ['C', '0', '⌫'],
  ];

  var keySize = 72;
  var keyGap = 8;

  return (
    <div style={{
      minHeight: '100vh',
      background: T.bg,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        padding: '24px 32px',
        borderBottom: '1px solid ' + T.border,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: '-0.02em' }}>ProSalonPOS</div>
          <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>
            {mode === 'calendar' ? 'Enter your PIN to view your schedule' : 'Enter your PIN to start a sale'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {onExit && (
            <div onClick={onExit}
              style={{ fontSize: 13, color: T.textMuted, cursor: 'pointer', padding: '6px 14px', borderRadius: 6, border: '1px solid ' + T.border, userSelect: 'none' }}
              onMouseEnter={function(e) { e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = T.text; }}
              onMouseLeave={function(e) { e.currentTarget.style.color = T.textMuted; e.currentTarget.style.borderColor = T.border; }}
            >← Exit</div>
          )}
          <div style={{
            fontSize: 13,
            color: T.textMuted,
            background: T.surface,
            padding: '6px 14px',
            borderRadius: 6,
            border: '1px solid ' + T.border,
          }}>
            Tech Station
          </div>
        </div>
      </div>

      {/* PIN Entry Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
        padding: '32px',
      }}>
        {/* Lock icon */}
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: T.brandSoft,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24,
        }}>🔒</div>

        {/* PIN dots */}
        <div style={{ display: 'flex', gap: 16 }}>
          {Array.from({ length: PIN_LENGTH }).map(function(_, i) {
            var filled = i < digits.length;
            var hasError = error && digits.length === PIN_LENGTH;
            return (
              <div key={i} style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                border: hasError
                  ? '2px solid ' + T.danger
                  : filled
                    ? '2px solid ' + T.brand
                    : '2px solid ' + T.textMuted,
                background: hasError
                  ? T.danger
                  : filled
                    ? T.brand
                    : 'transparent',
                transition: 'all 0.15s ease',
              }} />
            );
          })}
        </div>

        {/* Error message */}
        <div style={{
          height: 20,
          fontSize: 13,
          color: error ? T.danger : 'transparent',
          fontWeight: 500,
          transition: 'color 0.15s ease',
        }}>
          {error || 'placeholder'}
        </div>

        {/* Numpad */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: keyGap,
        }}>
          {rows.map(function(row, ri) {
            return (
              <div key={ri} style={{ display: 'flex', gap: keyGap }}>
                {row.map(function(key) {
                  var isAction = key === 'C' || key === '⌫';
                  var isClear = key === 'C';
                  var isBackspace = key === '⌫';

                  return (
                    <div
                      key={key}
                      onClick={function() {
                        if (isClear) handleClear();
                        else if (isBackspace) handleBackspace();
                        else handleDigit(key);
                      }}
                      style={{
                        width: keySize,
                        height: keySize,
                        borderRadius: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: isAction ? 18 : 26,
                        fontWeight: 600,
                        color: isClear ? T.danger : isBackspace ? '#F59E0B' : T.text,
                        background: T.chrome,
                        border: '1px solid ' + T.border,
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'all 0.1s ease',
                      }}
                      onMouseEnter={function(e) {
                        e.currentTarget.style.background = T.cardHover;
                      }}
                      onMouseLeave={function(e) {
                        e.currentTarget.style.background = T.chrome;
                      }}
                      onMouseDown={function(e) {
                        e.currentTarget.style.transform = 'scale(0.95)';
                      }}
                      onMouseUp={function(e) {
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      {key}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Matched Tech Confirm Modal */}
      {matchedTech && (function() {
        var appt = (activeAppointments || {})[matchedTech.id];
        var isBusy = !!appt;
        var totalCents = isBusy ? appt.services.reduce(function(s, svc) { return s + (svc.price_cents || 0); }, 0) : 0;
        return (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={handleCancel}
        >
          <div
            style={{
              background: T.surface,
              border: '1px solid ' + T.border,
              borderRadius: 16,
              padding: '36px 40px',
              width: isBusy ? 380 : 340,
              textAlign: 'center',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
            onClick={function(e) { e.stopPropagation(); }}
          >
            {/* Avatar */}
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: AVATAR_COLORS[activeStaff.indexOf(matchedTech) % AVATAR_COLORS.length],
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, fontWeight: 600, color: '#fff',
              margin: '0 auto 16px',
            }}>
              {getInitials(matchedTech.display_name)}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: T.text }}>
              {matchedTech.display_name}
            </div>

            {isBusy ? (
              <>
                <div style={{ fontSize: 14, color: T.textMuted, marginTop: 6 }}>
                  Complete services for
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#38BDF8', marginTop: 4 }}>
                  {appt.clientName}
                </div>
                <div style={{ marginTop: 14, textAlign: 'left', background: T.card, borderRadius: 10, padding: '12px 16px', border: '1px solid ' + T.border }}>
                  {appt.services.map(function(svc, i) {
                    return (
                      <div key={i} style={{position:'relative', display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < appt.services.length - 1 ? '1px solid ' + T.border : 'none' }}>
        <AreaTag id="TECHPIN" />
                        <span style={{ fontSize: 13, color: T.text }}>{svc.name}</span>
                        <span style={{ fontSize: 13, color: T.textSoft, fontWeight: 500 }}>${(svc.price_cents / 100).toFixed(2)}</span>
                      </div>
                    );
                  })}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 4, borderTop: '1px solid ' + T.border }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Total</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#22C55E' }}>${(totalCents / 100).toFixed(2)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  <div onClick={handleCancel}
                    style={{ flex: 1, padding: '12px 0', borderRadius: 8, border: '1px solid ' + T.border, background: 'none', color: T.text, fontSize: 14, fontWeight: 500, cursor: 'pointer', textAlign: 'center' }}
                    onMouseEnter={function(e) { e.currentTarget.style.background = T.card; }}
                    onMouseLeave={function(e) { e.currentTarget.style.background = 'none'; }}
                  >Go Back</div>
                  <div onClick={function() { if (onTechSelected) onTechSelected(matchedTech, appt); setMatchedTech(null); setDigits(''); }}
                    style={{ flex: 1, padding: '12px 0', borderRadius: 8, border: 'none', background: '#22C55E', color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', textAlign: 'center' }}
                    onMouseEnter={function(e) { e.currentTarget.style.background = '#16A34A'; }}
                    onMouseLeave={function(e) { e.currentTarget.style.background = '#22C55E'; }}
                  >Go to Checkout</div>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6, marginBottom: 24 }}>
                  Is this you?
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div onClick={handleCancel}
                    style={{ flex: 1, padding: '12px 0', borderRadius: 8, border: '1px solid ' + T.border, background: 'none', color: T.text, fontSize: 14, fontWeight: 500, cursor: 'pointer', textAlign: 'center' }}
                    onMouseEnter={function(e) { e.currentTarget.style.background = T.card; }}
                    onMouseLeave={function(e) { e.currentTarget.style.background = 'none'; }}
                  >No, Go Back</div>
                  <div onClick={handleConfirm}
                    style={{ flex: 1, padding: '12px 0', borderRadius: 8, border: 'none', background: T.brand, color: '#fff', fontSize: 14, fontWeight: 500, cursor: 'pointer', textAlign: 'center' }}
                    onMouseEnter={function(e) { e.currentTarget.style.background = '#2563EB'; }}
                    onMouseLeave={function(e) { e.currentTarget.style.background = T.brand; }}
                  >Yes, That's Me</div>
                </div>
              </>
            )}
          </div>
        </div>
        );
      })()}
    </div>
  );
}
