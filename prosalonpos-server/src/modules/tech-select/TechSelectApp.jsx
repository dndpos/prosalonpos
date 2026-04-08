import { useState } from 'react';

/**
 * Tech Select — Micro-frontend: Avatar Grid
 * src/modules/tech-select/TechSelectApp.jsx
 *
 * Standalone station screen — tech taps their avatar to identify themselves.
 * Used at dedicated tech stations where quick selection is preferred over PIN.
 *
 * Flow:
 *   1. Grid of tech avatars + names fills the screen
 *   2. Tech taps their circle → "Is this you?" confirmation
 *   3. On confirm → calls onTechSelected(tech) → App.jsx routes based on station_mode:
 *      - 'checkout' → checkout screen (create sale ticket)
 *      - 'calendar' → calendar screen (full flow)
 *
 * Station config (props):
 *   - stationMode: 'checkout' | 'calendar' (default 'checkout')
 *   - canProcessPayments: true | false (default true)
 *     When false, checkout can only print/hold tickets — no payment processing
 *
 * Rules:
 *   - Staff-facing, dark theme
 *   - ProSalonPOS branded
 *   - Desktop + tablet responsive
 *   - Big touch-friendly avatars
 *   - Shows active staff only
 */

import { useStaffStore } from '../../lib/stores/staffStore';
import AreaTag from '../../components/ui/AreaTag';

var AVATAR_COLORS = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#06B6D4', '#84CC16'];

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
};

function getInitials(name) {
  if (!name) return '?';
  var parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function TechSelectApp({ onTechSelected, onExit, stationMode, canProcessPayments, activeAppointments }) {
  var [selectedTech, setSelectedTech] = useState(null);
  var allStaff = useStaffStore(function(s) { return s.staff; });

  // Only show active staff — sorted alphabetically
  var staff = allStaff.filter(function(s) { return s.active; }).sort(function(a,b){return a.display_name.localeCompare(b.display_name);});

  var mode = stationMode || 'checkout';

  function handleSelect(tech) {
    setSelectedTech(tech);
  }

  function handleConfirm() {
    if (onTechSelected) {
      onTechSelected(selectedTech);
    }
    setSelectedTech(null);
  }

  function handleCancel() {
    setSelectedTech(null);
  }

  // Subtitle based on station mode
  var subtitle = mode === 'calendar'
    ? 'Select your name to view your schedule'
    : 'Select your name to start a sale';

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
          <div style={{ fontSize: 13, color: T.textMuted, marginTop: 2 }}>{subtitle}</div>
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

      {/* Avatar Grid — starts 4 across, expands columns before scrolling */}
      {(function() {
        var count = staff.length;
        // Start at 4 columns, expand when we exceed 4 rows at current column count
        var cols = 4;
        var maxRows = 4;
        while (Math.ceil(count / cols) > maxRows && cols < 8) { cols++; }
        return (
        <div style={{
          flex: 1,
          padding: '32px',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          overflow: Math.ceil(count / cols) > maxRows ? 'auto' : 'hidden',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(' + cols + ', 1fr)',
            gap: 24,
            maxWidth: cols * 164,
            width: '100%',
          }}>
        {staff.map(function(tech, i) {
            var color = AVATAR_COLORS[i % AVATAR_COLORS.length];
            return (
              <div
                key={tech.id}
                onClick={function() { handleSelect(tech); }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                  padding: '24px 12px',
                  borderRadius: 16,
                  background: T.card,
                  border: '2px solid ' + T.border,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={function(e) {
                  e.currentTarget.style.background = T.cardHover;
                  e.currentTarget.style.borderColor = color;
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={function(e) {
                  e.currentTarget.style.background = T.card;
                  e.currentTarget.style.borderColor = T.border;
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Avatar circle */}
                <div style={{
                  width: 80,
                  height: 80,
                  borderRadius: '50%',
                  background: color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 28,
                  fontWeight: 600,
                  color: '#fff',
                  flexShrink: 0,
                }}>
                  {tech.photo_url
                    ? <img src={tech.photo_url} alt={tech.display_name} style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} />
                    : getInitials(tech.display_name)
                  }
                </div>
                {/* Name */}
                <div style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: T.text,
                  textAlign: 'center',
                  lineHeight: '1.3',
                }}>
                  {tech.display_name}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      );
      })()}

      {selectedTech && (function() {
        var appt = (activeAppointments || {})[selectedTech.id];
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
              background: AVATAR_COLORS[staff.indexOf(selectedTech) % AVATAR_COLORS.length],
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, fontWeight: 600, color: '#fff',
              margin: '0 auto 16px',
            }}>
              {getInitials(selectedTech.display_name)}
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: T.text }}>
              {selectedTech.display_name}
            </div>

            {isBusy ? (
              <>
                <div style={{ fontSize: 14, color: T.textMuted, marginTop: 6 }}>
                  Complete services for
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#38BDF8', marginTop: 4 }}>
                  {appt.clientName}
                </div>
                {/* Service list */}
                <div style={{ marginTop: 14, textAlign: 'left', background: T.card, borderRadius: 10, padding: '12px 16px', border: '1px solid ' + T.border }}>
                  {appt.services.map(function(svc, i) {
                    return (
                      <div key={i} style={{position:'relative', display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < appt.services.length - 1 ? '1px solid ' + T.border : 'none' }}>
        <AreaTag id="TECHSEL" />
                        <span style={{ fontSize: 13, color: T.text }}>{svc.name}</span>
                        <span style={{ fontSize: 13, color: T.textSoft || T.textMuted, fontWeight: 500 }}>${(svc.price_cents / 100).toFixed(2)}</span>
                      </div>
                    );
                  })}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, marginTop: 4, borderTop: '1px solid ' + T.border }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>Total</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#22C55E' }}>${(totalCents / 100).toFixed(2)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  <div
                    onClick={handleCancel}
                    style={{
                      flex: 1, padding: '12px 0', borderRadius: 8,
                      border: '1px solid ' + T.border, background: 'none',
                      color: T.text, fontSize: 14, fontWeight: 500,
                      cursor: 'pointer', textAlign: 'center',
                    }}
                    onMouseEnter={function(e) { e.currentTarget.style.background = T.card; }}
                    onMouseLeave={function(e) { e.currentTarget.style.background = 'none'; }}
                  >
                    Go Back
                  </div>
                  <div
                    onClick={function() {
                      if (onTechSelected) onTechSelected(selectedTech, appt);
                      setSelectedTech(null);
                    }}
                    style={{
                      flex: 1, padding: '12px 0', borderRadius: 8,
                      border: 'none', background: '#22C55E',
                      color: '#fff', fontSize: 14, fontWeight: 500,
                      cursor: 'pointer', textAlign: 'center',
                    }}
                    onMouseEnter={function(e) { e.currentTarget.style.background = '#16A34A'; }}
                    onMouseLeave={function(e) { e.currentTarget.style.background = '#22C55E'; }}
                  >
                    Go to Checkout
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6, marginBottom: 24 }}>
                  Is this you?
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div
                    onClick={handleCancel}
                    style={{
                      flex: 1, padding: '12px 0', borderRadius: 8,
                      border: '1px solid ' + T.border, background: 'none',
                      color: T.text, fontSize: 14, fontWeight: 500,
                      cursor: 'pointer', textAlign: 'center',
                    }}
                    onMouseEnter={function(e) { e.currentTarget.style.background = T.card; }}
                    onMouseLeave={function(e) { e.currentTarget.style.background = 'none'; }}
                  >
                    No, Go Back
                  </div>
                  <div
                    onClick={handleConfirm}
                    style={{
                      flex: 1, padding: '12px 0', borderRadius: 8,
                      border: 'none', background: T.brand,
                      color: '#fff', fontSize: 14, fontWeight: 500,
                      cursor: 'pointer', textAlign: 'center',
                    }}
                    onMouseEnter={function(e) { e.currentTarget.style.background = '#2563EB'; }}
                    onMouseLeave={function(e) { e.currentTarget.style.background = T.brand; }}
                  >
                    Yes, That's Me
                  </div>
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
