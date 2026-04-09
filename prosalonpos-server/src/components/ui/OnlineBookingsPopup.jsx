import { useTheme } from '../../lib/ThemeContext';

/**
 * OnlineBookingsPopup — extracted from App.jsx (Session 70 split)
 * Shows unviewed online booking notifications in a modal overlay.
 * Props: show, bookings, unviewedCount, onClose, onBookingTap, onMarkAllViewed
 */
export default function OnlineBookingsPopup({ show, bookings, unviewedCount, onClose, onBookingTap, onMarkAllViewed }) {
  var C = useTheme();
  if (!show) return null;

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: C.surface, border: '1px solid ' + C.border, borderRadius: '12px', width: '520px', maxHeight: '80vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}
        onClick={function(e) { e.stopPropagation(); }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid ' + C.border }}>
          <span style={{ fontSize: '16px', fontWeight: 600, color: C.text }}>
            New Online Bookings {unviewedCount > 0 ? '(' + unviewedCount + ')' : ''}
          </span>
          <button
            style={{ background: 'none', border: 'none', color: C.textPrimary, fontSize: '20px', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px' }}
            onClick={onClose}
          >✕</button>
        </div>

        {/* Booking list */}
        {bookings.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: C.textPrimary, fontSize: '14px' }}>
            No new online bookings
          </div>
        ) : (
          <div>
            {bookings.map(function(booking) {
              return (
                <div
                  key={booking.id}
                  onClick={function() { onBookingTap(booking); }}
                  style={{ padding: '14px 20px', borderBottom: '1px solid ' + C.border, cursor: 'pointer' }}
                  onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = C.raised; }}
                  onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 500, color: C.text, marginBottom: '4px' }}>{booking.client}</div>
                  <div style={{ fontSize: '12px', color: C.textPrimary, lineHeight: '1.6' }}>
                    {booking.service} with {booking.tech}<br />
                    Phone: {booking.phone}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ display: 'inline-block', fontSize: '11px', color: C.accent, backgroundColor: C.accentBg, padding: '2px 8px', borderRadius: '4px' }}>Today at {booking.time}</span>
                      <span style={{ fontSize: '11px', color: C.textPrimary }}>Booked {booking.booked_at}</span>
                    </div>
                    <span style={{ fontSize: '11px', color: C.accent, fontWeight: 500 }}>View →</span>
                  </div>
                </div>
              );
            })}
            <button
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '16px 20px', padding: '10px', borderRadius: '6px', border: '1px solid ' + C.accent, backgroundColor: 'transparent', color: C.accent, fontSize: '13px', fontWeight: 500, cursor: 'pointer', width: 'calc(100% - 40px)' }}
              onClick={onMarkAllViewed}
              onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = C.accentBg; }}
              onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              Mark All as Viewed
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
