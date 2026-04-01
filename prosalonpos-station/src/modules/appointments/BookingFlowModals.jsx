import { useTheme } from '../../lib/ThemeContext';

/**
 * BookingFlowModals — extracted from BookingFlow.jsx (Session 70 split)
 * Contains the 4 overlay modals: Note, Cancel Confirm, Block Time, Balance Alert.
 *
 * All state and handlers are passed as props from BookingFlow.
 */

const F = 'Inter,system-ui,sans-serif';

function ft(h, m) { return `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; }

export default function BookingFlowModals({
  // Note popup
  showNotePopup,
  setShowNotePopup,
  noteDraft,
  setNoteDraft,
  bookingClients,
  setBookingClients,
  clientLabel,

  // Cancel confirm
  showCancelConfirm,
  setShowCancelConfirm,
  confirmCancel,

  // Block time
  showBlockTime,
  setShowBlockTime,
  blockFrom,
  setBlockFrom,
  blockTo,
  setBlockTo,
  handleBlockConfirm,
  handleBlockTime,
  salonSettings,
  initialHour,
  initialMin,
  initTech,

  // Balance alert
  balanceAlert,
  setBalanceAlert,
  setPendingClient,
  confirmBalance,
  handleAddClientBalance,
  screen,
}) {
  var C = useTheme();

  var BP = { height: 44, padding: '0 24px', background: C.blue, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' };
  var BS = { height: 44, padding: '0 24px', background: 'transparent', color: C.textPrimary, border: `1px solid ${C.borderMedium}`, borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' };
  var BD = { height: 44, padding: '0 24px', background: C.danger, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' };

  return (
    <>
      {/* ═══════════ NOTE POPUP ═══════════ */}
      {showNotePopup !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '18vh', zIndex: 300 }}>
          <div style={{ background: C.chrome, borderRadius: 12, padding: 28, maxWidth: 420, width: '90%', border: `1px solid ${C.borderMedium}` }}>
            <div style={{ color: C.textPrimary, fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
              Booking Note{bookingClients.length > 1 ? ' — ' + clientLabel(bookingClients[showNotePopup], showNotePopup) : ''}
            </div>
            <div style={{ color: C.textPrimary, fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>This note will appear on the calendar block.</div>
            <textarea
              value={noteDraft}
              onChange={function(e) { setNoteDraft(e.target.value); }}
              placeholder="e.g. Client wants extra layers, bring color swatches..."
              rows={4}
              style={{ width: '100%', background: C.inputBg, border: `1px solid ${C.inputBorder}`, borderRadius: 6, padding: '10px 12px', color: C.inputText, fontSize: 14, fontFamily: F, outline: 'none', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5 }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              {bookingClients[showNotePopup] && bookingClients[showNotePopup].note && (
                <button
                  onClick={function() {
                    setBookingClients(function(prev) { return prev.map(function(bc, i) { return i === showNotePopup ? Object.assign({}, bc, { note: '' }) : bc; }); });
                    setShowNotePopup(null);
                  }}
                  style={{ height: 40, padding: '0 16px', background: 'transparent', border: `1px solid ${C.danger}`, borderRadius: 6, color: C.danger, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: F }}
                >Remove</button>
              )}
              <div style={{ flex: 1 }} />
              <button
                onClick={function() { setShowNotePopup(null); }}
                style={{ height: 40, padding: '0 16px', background: 'transparent', border: `1px solid ${C.borderMedium}`, borderRadius: 6, color: C.textPrimary, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: F }}
              >Cancel</button>
              <button
                onClick={function() {
                  setBookingClients(function(prev) { return prev.map(function(bc, i) { return i === showNotePopup ? Object.assign({}, bc, { note: noteDraft.trim() }) : bc; }); });
                  setShowNotePopup(null);
                }}
                style={{ height: 40, padding: '0 16px', background: C.blue, border: `1px solid ${C.blue}`, borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: F }}
              >Save Note</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ CANCEL CONFIRM ═══════════ */}
      {showCancelConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
          <div style={{ background: C.chrome, borderRadius: 12, padding: 24, maxWidth: 360, width: '90%', border: `1px solid ${C.borderMedium}` }}>
            <div style={{ color: C.textPrimary, fontSize: 16, fontWeight: 500, marginBottom: 8 }}>Cancel booking?</div>
            <div style={{ color: C.textPrimary, fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>Are you sure? All changes will be discarded.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={function() { setShowCancelConfirm(false); }} style={{ ...BS, height: 40, padding: '0 16px', fontSize: 13 }}>No, Go Back</button>
              <button onClick={confirmCancel} style={{ ...BD, height: 40, padding: '0 16px', fontSize: 13 }}>Yes, Discard</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ BLOCK TIME PICKER ═══════════ */}
      {showBlockTime && (function() {
        var isBlock = showBlockTime === 'block';
        var accent = isBlock ? '#EF4444' : '#F59E0B';
        var title = isBlock ? 'Block Time' : 'Reserve Time';
        if (isBlock) {
          var ss = salonSettings || {};
          var openH = parseInt(ss.opening_time) || 9;
          var closeH = parseInt(ss.closing_time) || 19;
          var gStart = (openH * 60) - 30;
          var gEnd = (closeH * 60) + 30;
          var times = [];
          for (var m = gStart; m <= gEnd; m += 15) {
            var h = Math.floor(m / 60); var mm = m % 60;
            times.push({ value: m, label: ft(h, mm) });
          }
          var canConfirm = blockFrom !== '' && blockTo !== '' && parseInt(blockFrom) < parseInt(blockTo);
          return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '14vh', zIndex: 310 }}>
              <div style={{ background: '#131B2E', borderRadius: 16, padding: '28px 32px', width: 360, border: '1px solid #1E2D45', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: accent, marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>for {initTech && initTech.display_name}</div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4, fontWeight: 600 }}>FROM</div>
                    <select value={blockFrom} onChange={function(e) { setBlockFrom(e.target.value); }} style={{ width: '100%', height: 38, background: '#1A2340', color: '#F1F5F9', border: '1px solid #1E2D45', borderRadius: 8, padding: '0 10px', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
                      <option value="">—</option>
                      {times.map(function(t) { return <option key={t.value} value={t.value}>{t.label}</option>; })}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: '#64748B', marginBottom: 4, fontWeight: 600 }}>TO</div>
                    <select value={blockTo} onChange={function(e) { setBlockTo(e.target.value); }} style={{ width: '100%', height: 38, background: '#1A2340', color: '#F1F5F9', border: '1px solid #1E2D45', borderRadius: 8, padding: '0 10px', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>
                      <option value="">—</option>
                      {times.filter(function(t) { return blockFrom === '' || t.value > parseInt(blockFrom); }).map(function(t) { return <option key={t.value} value={t.value}>{t.label}</option>; })}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <div
                    onClick={function() { setShowBlockTime(false); setBlockFrom(''); setBlockTo(''); }}
                    style={{ flex: 1, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #334155', borderRadius: 8, color: '#F1F5F9', fontSize: 13, fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}
                    onMouseEnter={function(e) { e.currentTarget.style.background = '#1A2340'; }}
                    onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
                  >Cancel</div>
                  <div
                    onClick={canConfirm ? handleBlockConfirm : undefined}
                    style={{ flex: 1, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', background: canConfirm ? accent : '#334155', borderRadius: 8, color: canConfirm ? '#FFF' : '#64748B', fontSize: 13, fontWeight: 700, cursor: canConfirm ? 'pointer' : 'default', userSelect: 'none' }}
                    onMouseEnter={function(e) { if (canConfirm) e.currentTarget.style.background = '#DC2626'; }}
                    onMouseLeave={function(e) { if (canConfirm) e.currentTarget.style.background = accent; }}
                  >Block</div>
                </div>
              </div>
            </div>
          );
        }
        // Duration picker for Reserve
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '14vh', zIndex: 310 }}>
            <div style={{ background: '#131B2E', borderRadius: 16, padding: '28px 32px', width: 400, border: '1px solid #1E2D45', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: accent, marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 13, color: '#64748B', marginBottom: 20 }}>for {initTech && initTech.display_name} at {ft(initialHour, initialMin)}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                {[15, 30, 45, 60, 75, 90, 105, 120].map(function(min) {
                  var label = min < 60 ? min + 'm' : (min === 60 ? '1 hr' : Math.floor(min / 60) + 'h ' + (min % 60) + 'm');
                  return (
                    <div
                      key={min}
                      onClick={function() { handleBlockTime(min); }}
                      style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1A2340', border: '1px solid #1E2D45', borderRadius: 10, color: accent, fontSize: 14, fontWeight: 600, cursor: 'pointer', userSelect: 'none', transition: 'all 150ms' }}
                      onMouseEnter={function(e) { e.currentTarget.style.background = 'rgba(245,158,11,0.15)'; e.currentTarget.style.borderColor = accent; }}
                      onMouseLeave={function(e) { e.currentTarget.style.background = '#1A2340'; e.currentTarget.style.borderColor = '#1E2D45'; }}
                    >{label}</div>
                  );
                })}
              </div>
              <div
                onClick={function() { setShowBlockTime(false); }}
                style={{ marginTop: 16, width: '100%', height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid #334155', borderRadius: 8, color: '#F1F5F9', fontSize: 13, fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}
                onMouseEnter={function(e) { e.currentTarget.style.background = '#1A2340'; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
              >Cancel</div>
            </div>
          </div>
        );
      })()}

      {/* ═══════════ OUTSTANDING BALANCE ALERT ═══════════ */}
      {balanceAlert && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 310 }}>
          <div style={{ background: C.chrome, borderRadius: 12, padding: 24, maxWidth: 400, width: '90%', border: `1px solid ${C.borderMedium}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(220,38,38,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>⚠️</div>
              <div style={{ color: C.danger, fontSize: 16, fontWeight: 600 }}>Outstanding Balance</div>
            </div>
            <div style={{ color: C.textPrimary, fontSize: 14, lineHeight: 1.6, marginBottom: 8 }}>
              <span style={{ color: C.blueLight, fontWeight: 500 }}>{balanceAlert.client.first_name} {balanceAlert.client.last_name}</span> owes the salon from unpaid no-show fees:
            </div>
            <div style={{ color: C.danger, fontSize: 24, fontWeight: 700, textAlign: 'center', padding: '12px 0', marginBottom: 12, background: 'rgba(220,38,38,0.08)', borderRadius: 8, border: '1px solid rgba(220,38,38,0.2)' }}>
              ${(balanceAlert.amount / 100).toFixed(2)} owed
            </div>
            <div style={{ color: C.textPrimary, fontSize: 12, marginBottom: 20, lineHeight: 1.5 }}>
              This balance will be automatically added to the checkout total on their next visit.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={function() { setBalanceAlert(null); setPendingClient(null); }}
                style={{ ...BS, flex: 1, height: 44, fontSize: 13 }}
              >Go Back</button>
              <button
                onClick={screen === 'search' ? confirmBalance : handleAddClientBalance}
                style={{ ...BP, flex: 1, height: 44, fontSize: 13 }}
              >Continue Booking</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
