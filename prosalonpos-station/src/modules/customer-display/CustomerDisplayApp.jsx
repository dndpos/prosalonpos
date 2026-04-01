import { useState, useRef, useEffect, useCallback } from 'react';
// TODO Phase 2: Customer Display reads from API — mock data removed Session 88
var _MOCK_SALON = { name: '', address_line1: '', address_line2: '', phone: '' };
var MOCK_TRANSACTION = { items: [], subtotal_cents: 0, tax_cents: 0, total_cents: 0 };
var _MOCK_TIP_PRESETS = [18, 20, 25];
var _MOCK_RECEIPT_OPTIONS = { email: true, text: true, print: true };
import { useSettingsStore } from '../../lib/stores/settingsStore';
import { isProduction, getPairedSalonName } from '../../lib/apiClient';
import DebugLabel from '../../components/debug/DebugLabel';

/**
 * Customer-Facing Display — Micro-frontend #2
 *
 * Runs on a small tablet facing the client at the checkout counter.
 * The cashier drives the flow from the main station — the client sees
 * their total and interacts with tip / signature / receipt screens.
 *
 * Phase 1: Self-contained with mock data + manual step-through buttons.
 * Phase 2: Data streams from main station via WebSocket.
 *
 * Session 85: SALON, TIP_PRESETS, RECEIPT_OPTIONS wired to settingsStore.
 * MOCK_TRANSACTION stays mock until WebSocket Phase 2.
 */

/* ─── MAIN COMPONENT ─── */
export default function CustomerDisplayApp() {
  var _isProd = isProduction();
  var salonSettings = useSettingsStore(function(s) { return s.settings; });
  var _salonName = (salonSettings && salonSettings.salon_name) || getPairedSalonName() || 'Your Salon';

  // Wire salon branding from settings
  var SALON = _isProd ? {
    name: _salonName,
    brandColor: (salonSettings && salonSettings.brand_color) || '#8B5CF6',
    logo_url: (salonSettings && salonSettings.salon_logo_url) || null,
  } : _MOCK_SALON;

  // Wire tip presets from settings
  var TIP_PRESETS = (function() {
    if (!_isProd) return _MOCK_TIP_PRESETS;
    if (salonSettings && salonSettings.tip_presets) {
      if (Array.isArray(salonSettings.tip_presets)) return salonSettings.tip_presets;
      if (typeof salonSettings.tip_presets === 'string') return salonSettings.tip_presets.split(',').map(Number);
    }
    return [18, 20, 25];
  })();

  // Wire receipt options from settings
  var RECEIPT_OPTIONS = _isProd ? {
    email_enabled: salonSettings ? salonSettings.receipt_email_enabled !== false : true,
    text_enabled: salonSettings ? salonSettings.receipt_text_enabled !== false : true,
    print_enabled: salonSettings ? salonSettings.receipt_print_enabled !== false : true,
  } : _MOCK_RECEIPT_OPTIONS;

  var BC = SALON.brandColor;

var S = {
  bg: '#F8FAFC', white: '#FFFFFF',
  textPrimary: '#1E293B', textSecondary: '#475569', textMuted: '#94A3B8',
  border: '#E2E8F0', borderLight: '#F1F5F9',
  brand: '#8B5CF6', brandLight: '#8B5CF618', brandSoft: '#8B5CF60A',
  success: '#059669', successBg: '#ECFDF5',
  danger: '#DC2626',
};

function cents(v) {
  return '$' + (v / 100).toFixed(2);
}

/* ─── STEP LABELS (for demo nav) ─── */
var STEPS = ['idle', 'review', 'tip', 'signature', 'receipt', 'thanks'];
var STEP_LABELS = { idle: 'Idle', review: 'Order Review', tip: 'Tip', signature: 'Signature', receipt: 'Receipt', thanks: 'Thank You' };

  // Update S brand colors dynamically
  S.brand = BC;
  S.brandLight = BC + '18';
  S.brandSoft = BC + '0A';

  var [step, setStep] = useState('idle');
  var [tipCents, setTipCents] = useState(0);
  var [tipDigits, setTipDigits] = useState('');
  var [tipMode, setTipMode] = useState('preset'); // preset | custom
  var [selectedPreset, setSelectedPreset] = useState(null);
  var [signatureData, setSignatureData] = useState(null);
  var [receiptChoice, setReceiptChoice] = useState(null);

  var txn = MOCK_TRANSACTION;
  var stepIdx = STEPS.indexOf(step);

  function goNext() {
    if (stepIdx < STEPS.length - 1) {
      setStep(STEPS[stepIdx + 1]);
    }
  }
  function goBack() {
    if (stepIdx > 0) {
      var prev = STEPS[stepIdx - 1];
      setStep(prev);
      // Reset state when going back
      if (prev === 'tip') { setSignatureData(null); }
      if (prev === 'signature') { setReceiptChoice(null); }
    }
  }
  function resetAll() {
    setStep('idle');
    setTipCents(0);
    setTipDigits('');
    setTipMode('preset');
    setSelectedPreset(null);
    setSignatureData(null);
    setReceiptChoice(null);
  }

  /* ─── TIP HANDLERS ─── */
  function handlePreset(pct) {
    setSelectedPreset(pct);
    setTipMode('preset');
    setTipCents(Math.round(txn.total_cents * pct / 100));
    setTipDigits('');
  }
  function handleNoTip() {
    setSelectedPreset('none');
    setTipMode('preset');
    setTipCents(0);
    setTipDigits('');
  }
  function handleCustomTip() {
    setTipMode('custom');
    setSelectedPreset(null);
    setTipDigits('');
    setTipCents(0);
  }
  // Cash register mode: digits shift left through fixed decimal
  function handleTipDigit(d) {
    var next = tipDigits + d;
    if (next.length > 7) return;
    setTipDigits(next);
    setTipCents(parseInt(next, 10) || 0);
  }
  function handleTipBackspace() {
    var next = tipDigits.slice(0, -1);
    setTipDigits(next);
    setTipCents(parseInt(next, 10) || 0);
  }
  function handleTipClear() {
    setTipDigits('');
    setTipCents(0);
  }

  var grandTotal = txn.total_cents + tipCents;

  /* ─── RENDER ─── */
  return (
    <div style={{ background: S.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <DebugLabel id="SCREEN-CUSTDISPLAY" />
      {/* Demo nav strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: S.white, borderBottom: '1px solid ' + S.border, flexShrink: 0 }}>
        <div onClick={goBack} style={{ padding: '6px 14px', borderRadius: 6, background: stepIdx > 0 ? S.brand : S.border, color: stepIdx > 0 ? '#fff' : S.textMuted, fontSize: 13, fontWeight: 600, cursor: stepIdx > 0 ? 'pointer' : 'default', opacity: stepIdx > 0 ? 1 : 0.5, userSelect: 'none' }}>
          ← Back
        </div>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 12, color: S.textMuted, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          {STEP_LABELS[step]} ({stepIdx + 1}/{STEPS.length})
        </div>
        <div onClick={stepIdx < STEPS.length - 1 ? goNext : resetAll} style={{ padding: '6px 14px', borderRadius: 6, background: S.brand, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
          {stepIdx < STEPS.length - 1 ? 'Next →' : 'Reset'}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        {step === 'idle' && <IdleScreen />}
        {step === 'review' && <ReviewScreen txn={txn} />}
        {step === 'tip' && (
          <TipScreen
            txn={txn} tipCents={tipCents} tipDigits={tipDigits}
            tipMode={tipMode} selectedPreset={selectedPreset}
            onPreset={handlePreset} onNoTip={handleNoTip} onCustom={handleCustomTip}
            onDigit={handleTipDigit} onBackspace={handleTipBackspace} onClear={handleTipClear}
            onConfirm={goNext}
          />
        )}
        {step === 'signature' && (
          <SignatureScreen grandTotal={grandTotal} tipCents={tipCents} onDone={function(sig) { setSignatureData(sig); goNext(); }} onSkip={goNext} />
        )}
        {step === 'receipt' && (
          <ReceiptScreen onChoice={function(c) { setReceiptChoice(c); goNext(); }} />
        )}
        {step === 'thanks' && <ThanksScreen receiptChoice={receiptChoice} onReset={resetAll} />}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SCREEN: Idle
   ═══════════════════════════════════════════ */
function IdleScreen() {
  return (
    <div style={{ textAlign: 'center' }}>
      {/* Salon logo placeholder */}
      <div style={{ width: 120, height: 120, borderRadius: '50%', background: S.brandLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px', border: '3px solid ' + S.brand }}>
        <span style={{ fontSize: 42, fontWeight: 700, color: S.brand }}>{_salonName.charAt(0)}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: S.textPrimary, marginBottom: 8 }}>{_salonName}</div>
      <div style={{ fontSize: 18, color: S.textMuted, marginBottom: 48 }}>Welcome</div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '14px 28px', borderRadius: 12, background: S.brandSoft, border: '1px solid ' + S.brandLight }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: S.brand, animation: 'pulse 2s infinite' }} />
        <span style={{ fontSize: 16, color: S.brand, fontWeight: 500 }}>Waiting for checkout...</span>
      </div>
      <style>{`
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SCREEN: Order Review
   ═══════════════════════════════════════════ */
function ReviewScreen({ txn }) {
  var hasDiscount = txn.discount_cents > 0;
  var hasDeposit = txn.deposit_applied_cents > 0;

  return (
    <div style={{ width: '100%', maxWidth: 440 }}>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 14, color: S.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Your Order</div>
        <div style={{ fontSize: 14, color: S.textSecondary }}>Ticket #{txn.ticket_number}</div>
      </div>

      {/* Line items */}
      <div style={{ background: S.white, borderRadius: 16, border: '1px solid ' + S.border, overflow: 'hidden', marginBottom: 20 }}>
        {txn.line_items.map(function(item, i) {
          return (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: i < txn.line_items.length - 1 ? '1px solid ' + S.borderLight : 'none' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 500, color: S.textPrimary }}>{item.name}</div>
                <div style={{ fontSize: 13, color: S.textMuted, marginTop: 2 }}>
                  {item.type === 'product' ? 'Product' : 'Service'}
                </div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: S.textPrimary }}>{cents(item.price_cents)}</div>
            </div>
          );
        })}
      </div>

      {/* Totals */}
      <div style={{ background: S.white, borderRadius: 16, border: '1px solid ' + S.border, padding: '16px 20px' }}>
        <TotalRow label="Subtotal" value={cents(txn.subtotal_cents)} />
        {hasDiscount && <TotalRow label={'Discount (' + txn.discount_label + ')'} value={'−' + cents(txn.discount_cents)} color={S.success} />}
        <TotalRow label={'Tax (' + txn.tax_rate_pct + '%)'} value={cents(txn.tax_cents)} />
        {hasDeposit && <TotalRow label="Deposit Applied" value={'−' + cents(txn.deposit_applied_cents)} color={S.success} />}
        <div style={{ borderTop: '2px solid ' + S.border, marginTop: 12, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: S.textPrimary }}>Total Due</span>
          <span style={{ fontSize: 28, fontWeight: 800, color: S.brand }}>{cents(txn.total_cents)}</span>
        </div>
      </div>
    </div>
  );
}

function TotalRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
      <span style={{ fontSize: 15, color: S.textSecondary }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 600, color: color || S.textPrimary }}>{value}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SCREEN: Tip Entry
   ═══════════════════════════════════════════ */
function TipScreen({ txn, tipCents, tipDigits, tipMode, selectedPreset, onPreset, onNoTip, onCustom, onDigit, onBackspace, onClear, onConfirm }) {
  var canConfirm = selectedPreset !== null || (tipMode === 'custom' && tipDigits.length > 0);

  return (
    <div style={{ width: '100%', maxWidth: 440 }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 14, color: S.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Add a Tip</div>
        <div style={{ fontSize: 14, color: S.textSecondary }}>for {txn.tech_name}</div>
      </div>

      {/* Tip display */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 44, fontWeight: 800, color: tipCents > 0 ? S.brand : S.textMuted }}>{cents(tipCents)}</div>
        {tipCents > 0 && (
          <div style={{ fontSize: 14, color: S.textSecondary, marginTop: 4 }}>
            New total: {cents(txn.total_cents + tipCents)}
          </div>
        )}
      </div>

      {/* Preset buttons */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        {TIP_PRESETS.map(function(pct) {
          var active = selectedPreset === pct;
          var tipAmt = Math.round(txn.total_cents * pct / 100);
          return (
            <div key={pct} onClick={function() { onPreset(pct); }}
              style={{ flex: 1, padding: '16px 8px', borderRadius: 14, background: active ? S.brand : S.white, border: '2px solid ' + (active ? S.brand : S.border), textAlign: 'center', cursor: 'pointer', userSelect: 'none', transition: 'all 0.15s' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: active ? '#fff' : S.textPrimary }}>{pct}%</div>
              <div style={{ fontSize: 13, color: active ? 'rgba(255,255,255,0.8)' : S.textMuted, marginTop: 2 }}>{cents(tipAmt)}</div>
            </div>
          );
        })}
      </div>

      {/* No Tip + Custom row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div onClick={onNoTip}
          style={{ flex: 1, padding: '14px 8px', borderRadius: 14, background: selectedPreset === 'none' ? S.textSecondary : S.white, border: '2px solid ' + (selectedPreset === 'none' ? S.textSecondary : S.border), textAlign: 'center', cursor: 'pointer', userSelect: 'none', transition: 'all 0.15s' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: selectedPreset === 'none' ? '#fff' : S.textSecondary }}>No Tip</div>
        </div>
        <div onClick={onCustom}
          style={{ flex: 1, padding: '14px 8px', borderRadius: 14, background: tipMode === 'custom' ? S.brand : S.white, border: '2px solid ' + (tipMode === 'custom' ? S.brand : S.border), textAlign: 'center', cursor: 'pointer', userSelect: 'none', transition: 'all 0.15s' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: tipMode === 'custom' ? '#fff' : S.textSecondary }}>Custom Amount</div>
        </div>
      </div>

      {/* Custom numpad (cash register mode, calculator layout, div-only) */}
      {tipMode === 'custom' && (
        <div style={{ background: S.white, borderRadius: 16, border: '1px solid ' + S.border, padding: 16, marginBottom: 16 }}>
          {/* Display */}
          <div style={{ textAlign: 'right', padding: '8px 12px', marginBottom: 12, background: S.borderLight, borderRadius: 8, fontSize: 28, fontWeight: 700, color: S.textPrimary, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
            {tipDigits.length > 0 ? cents(parseInt(tipDigits, 10)) : '$0.00'}
          </div>
          {/* Keys: 7-8-9 / 4-5-6 / 1-2-3 / C-0-⌫ */}
          {[[7,8,9],[4,5,6],[1,2,3],['C',0,'⌫']].map(function(row, ri) {
            return (
              <div key={ri} style={{ display: 'flex', gap: 8, marginBottom: ri < 3 ? 8 : 0 }}>
                {row.map(function(k) {
                  var handler = k === 'C' ? onClear : k === '⌫' ? onBackspace : function() { onDigit(String(k)); };
                  return (
                    <div key={k} onClick={handler}
                      style={{ flex: 1, height: 52, borderRadius: 10, background: k === 'C' ? '#FEE2E2' : k === '⌫' ? S.borderLight : S.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 600, color: k === 'C' ? S.danger : S.textPrimary, cursor: 'pointer', userSelect: 'none', transition: 'background 0.1s' }}>
                      {k}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm button */}
      <div onClick={canConfirm ? onConfirm : undefined}
        style={{ padding: '18px 24px', borderRadius: 14, background: canConfirm ? S.brand : S.border, textAlign: 'center', cursor: canConfirm ? 'pointer' : 'default', userSelect: 'none', transition: 'all 0.15s' }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>
          {tipCents > 0 ? 'Add ' + cents(tipCents) + ' Tip' : 'Continue Without Tip'}
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SCREEN: Signature
   ═══════════════════════════════════════════ */
function SignatureScreen({ grandTotal, tipCents, onDone, onSkip }) {
  var canvasRef = useRef(null);
  var [drawing, setDrawing] = useState(false);
  var [hasStrokes, setHasStrokes] = useState(false);

  var getPos = useCallback(function(e) {
    var rect = canvasRef.current.getBoundingClientRect();
    var touch = e.touches ? e.touches[0] : e;
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  }, []);

  function startDraw(e) {
    e.preventDefault();
    var ctx = canvasRef.current.getContext('2d');
    var pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setDrawing(true);
  }
  function draw(e) {
    if (!drawing) return;
    e.preventDefault();
    var ctx = canvasRef.current.getContext('2d');
    var pos = getPos(e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = S.textPrimary;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasStrokes(true);
  }
  function endDraw(e) {
    if (e) e.preventDefault();
    setDrawing(false);
  }
  function clearCanvas() {
    var ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHasStrokes(false);
  }

  return (
    <div style={{ width: '100%', maxWidth: 440 }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 14, color: S.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Signature</div>
        <div style={{ fontSize: 14, color: S.textSecondary, marginBottom: 4 }}>
          Total: <span style={{ fontWeight: 700, color: S.brand }}>{cents(grandTotal)}</span>
          {tipCents > 0 && <span style={{ color: S.textMuted }}> (includes {cents(tipCents)} tip)</span>}
        </div>
      </div>

      {/* Canvas */}
      <div style={{ background: S.white, borderRadius: 16, border: '1px solid ' + S.border, padding: 16, marginBottom: 16 }}>
        <canvas ref={canvasRef} width={392} height={180}
          style={{ width: '100%', height: 180, borderRadius: 10, border: '1px dashed ' + S.border, cursor: 'crosshair', touchAction: 'none' }}
          onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
          onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <span style={{ fontSize: 13, color: S.textMuted }}>Sign with your finger or stylus</span>
          {hasStrokes && (
            <div onClick={clearCanvas} style={{ fontSize: 13, color: S.danger, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>Clear</div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12 }}>
        <div onClick={onSkip}
          style={{ flex: 1, padding: '16px 12px', borderRadius: 14, background: S.white, border: '2px solid ' + S.border, textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: S.textSecondary }}>Skip</span>
        </div>
        <div onClick={function() { onDone(hasStrokes ? canvasRef.current.toDataURL() : null); }}
          style={{ flex: 2, padding: '16px 12px', borderRadius: 14, background: S.brand, textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Confirm</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SCREEN: Receipt Choice
   ═══════════════════════════════════════════ */
function ReceiptScreen({ onChoice }) {
  var options = [];
  if (RECEIPT_OPTIONS.email_enabled) options.push({ id: 'email', label: 'Email', icon: '✉️' });
  if (RECEIPT_OPTIONS.text_enabled) options.push({ id: 'text', label: 'Text', icon: '💬' });
  if (RECEIPT_OPTIONS.print_enabled) options.push({ id: 'print', label: 'Print', icon: '🖨️' });
  options.push({ id: 'none', label: 'No Receipt', icon: '✕' });

  return (
    <div style={{ width: '100%', maxWidth: 440 }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 14, color: S.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Receipt</div>
        <div style={{ fontSize: 18, color: S.textSecondary }}>How would you like your receipt?</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {options.map(function(opt) {
          var isNone = opt.id === 'none';
          return (
            <div key={opt.id} onClick={function() { onChoice(opt.id); }}
              style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', borderRadius: 16, background: isNone ? S.bg : S.white, border: '2px solid ' + (isNone ? S.border : S.brand + '30'), cursor: 'pointer', userSelect: 'none', transition: 'all 0.15s' }}>
              <div style={{ fontSize: 28, width: 44, textAlign: 'center' }}>{opt.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: isNone ? S.textMuted : S.textPrimary }}>{opt.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SCREEN: Thank You
   ═══════════════════════════════════════════ */
function ThanksScreen({ receiptChoice, onReset }) {
  var receiptMsg = {
    email: "We'll email your receipt shortly.",
    text: "We'll text your receipt shortly.",
    print: 'Your receipt is printing.',
    none: '',
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: 100, height: 100, borderRadius: '50%', background: S.successBg, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', border: '3px solid ' + S.success }}>
        <span style={{ fontSize: 48 }}>✓</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: S.textPrimary, marginBottom: 8 }}>Thank You!</div>
      <div style={{ fontSize: 18, color: S.textSecondary, marginBottom: 8 }}>
        Have a wonderful day.
      </div>
      {receiptChoice && receiptMsg[receiptChoice] && (
        <div style={{ fontSize: 15, color: S.textMuted }}>{receiptMsg[receiptChoice]}</div>
      )}
    </div>
  );
}
