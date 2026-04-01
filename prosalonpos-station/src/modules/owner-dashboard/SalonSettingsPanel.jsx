import React, { useState } from 'react';
import { useNumpadKeyboard } from '../../lib/useNumpadKeyboard';
import { useTheme } from '../../lib/ThemeContext';
import { useToast } from '../../lib/ToastContext';
import { ACTIONS, ACTION_META } from '../../lib/rbac';
import { getPairedSalonCode, getPairedSalonName, unpairStation } from '../../lib/apiClient';
import { getPrinterList, isQzReady, printTestPage } from '../../lib/printService';
import DebugToggleSection from '../../components/debug/DebugToggleSection';
import RolesAccordion from './RolesAccordion';
import DataImportExport from './DataImportExport';
import OwnerCodeSection from './OwnerCodeSection';

/**
 * SalonSettingsPanel — All salon settings accordion sections
 * Extracted from OwnerDashboard.jsx (Session 37, TD-061)
 */

const ROTATION_OPTS = [
  { value: 'round_robin', label: 'Round Robin', desc: 'After qualifying service, tech moves to bottom.' },
  { value: 'fewest_clients', label: 'Fewest Clients', desc: 'Lowest daily count is up next.' },
  { value: 'fixed_order', label: 'Fixed Order', desc: 'Owner sets static priority.' },
  { value: 'first_available', label: 'First Available', desc: 'Longest free is up next.' },
];

// ═══════════════════════════════════════
// SHARED FORM COMPONENTS
// ═══════════════════════════════════════

function Card({ children, style, T }) {
  return <div style={{ background: T.surface, borderRadius: 10, padding: '20px 24px', marginBottom: 16, ...style }}>{children}</div>;
}

function SectionTitle({ children, T }) {
  return <div style={{ fontSize: 20, fontWeight: 500, color: T.text, marginBottom: 16 }}>{children}</div>;
}

function FieldRow({ label, desc, children, T }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid ' + T.borderLight }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, color: T.text }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>{desc}</div>}
      </div>
      <div style={{ flexShrink: 0, marginLeft: 16 }}>{children}</div>
    </div>
  );
}

function Toggle({ value, onChange, T }) {
  return (
    <div onClick={function() { onChange(!value); }} style={{ width: 44, height: 24, borderRadius: 12, background: value ? T.success : T.borderLight, cursor: 'pointer', position: 'relative', transition: 'background 150ms' }}>
      <div style={{ width: 20, height: 20, borderRadius: 10, background: '#fff', position: 'absolute', top: 2, left: value ? 22 : 2, transition: 'left 150ms' }} />
    </div>
  );
}

function Select({ value, options, onChange, T }) {
  return (
    <select value={value} onChange={function(e) { onChange(e.target.value); }} style={{ background: T.grid, color: T.text, border: '1px solid ' + T.border, borderRadius: 6, padding: '6px 12px', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', minWidth: 140 }}>
      {options.map(function(o) { return <option key={o.value} value={o.value}>{o.label}</option>; })}
    </select>
  );
}

function Input({ value, onChange, type, style: s, T }) {
  return (
    <input value={value} onChange={function(e) { onChange(e.target.value); }} type={type || 'text'} style={{ background: T.grid, color: T.text, border: '1px solid ' + T.border, borderRadius: 6, padding: '6px 12px', fontSize: 13, fontFamily: 'inherit', width: 120, ...s }} />
  );
}

// ═══════════════════════════════════════
// NUMPAD FOR PRICE FIELDS
// ═══════════════════════════════════════

function handlePriceKey(key, setter) {
  setter(function(p) { if (key === 'C') return ''; if (key === '⌫') return p.slice(0, -1); if (/\d/.test(key)) return p + key; return p; });
}

function payNumpad(onKey, onDone, T) {
  var keys = ['7','8','9','4','5','6','1','2','3','C','0','⌫'];
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
        {keys.map(function(key) {
          var isAction = key === '⌫' || key === 'C';
          return (
            <div key={key} onClick={function() { onKey(key); }}
              style={{ height: 42, borderRadius: 6, background: isAction ? '#334155' : T.btnBg, border: isAction ? '1px solid #475569' : '1px solid ' + T.btnBorder, color: key === '⌫' ? '#EF4444' : (key === 'C' ? '#F59E0B' : T.btnText), fontSize: 18, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none' }}
              onMouseEnter={function(e) { e.currentTarget.style.background = isAction ? '#475569' : '#E2E8F0'; }}
              onMouseLeave={function(e) { e.currentTarget.style.background = isAction ? '#334155' : T.btnBg; }}
            >{key}</div>
          );
        })}
      </div>
      <div onClick={onDone}
        style={{ width: '100%', height: 36, marginTop: 6, borderRadius: 6, background: '#38BDF8', color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none' }}
        onMouseEnter={function(e) { e.currentTarget.style.background = '#1D4ED8'; }}
        onMouseLeave={function(e) { e.currentTarget.style.background = '#38BDF8'; }}
      >Done</div>
    </div>
  );
}

// ═══════════════════════════════════════
// ACCORDION SECTION WRAPPER
// ═══════════════════════════════════════

function AccSection({ id, title, children, openId, onToggle, T }) {
  var isOpen = openId === id;
  return (
    <div style={{ marginBottom: 8, borderRadius: 10, border: '1px solid ' + (isOpen ? T.primary + '60' : T.borderLight), background: T.surface, overflow: 'hidden' }}>
      <div onClick={function() { onToggle(isOpen ? null : id); }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', cursor: 'pointer', userSelect: 'none', background: isOpen ? T.blueTint : 'transparent' }}
        onMouseEnter={function(e) { if (!isOpen) e.currentTarget.style.background = T.grid; }}
        onMouseLeave={function(e) { e.currentTarget.style.background = isOpen ? T.blueTint : 'transparent'; }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: isOpen ? T.primaryLight : T.text }}>{title}</span>
        <span style={{ fontSize: 18, color: isOpen ? T.primaryLight : T.textMuted, transition: 'transform 200ms', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
      </div>
      {isOpen && (
        <div style={{ padding: '0 20px 20px', borderTop: '1px solid ' + T.borderLight }}>
          <div style={{ paddingTop: 16 }}>{children}</div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════

export default function SalonSettingsPanel({ salonSettings, onSettingsUpdate }) {
  var T = useTheme();
  var toast = useToast();
  var settings = salonSettings || {};

  var [salonAccordion, setSalonAccordion] = useState(null);
  var [activeRoleTab, setActiveRoleTab] = useState('owner');
  var [showTurnNumpad, setShowTurnNumpad] = useState(null);
  var [turnPriceStr, setTurnPriceStr] = useState(String((salonSettings || {}).turn_price_minimum_cents || ''));
  var [walkinPriceStr, setWalkinPriceStr] = useState(String((salonSettings || {}).walkin_turn_minimum_cents || ''));
  var [requestedPriceStr, setRequestedPriceStr] = useState(String((salonSettings || {}).requested_appt_minimum_cents || ''));

  // Keyboard → numpad bridge for turn price fields
  useNumpadKeyboard(showTurnNumpad === 'turn_price', function(d){ handlePriceKey(d, setTurnPriceStr); }, function(){ handlePriceKey('⌫', setTurnPriceStr); }, function(){ set('turn_price_minimum_cents', parseInt(turnPriceStr,10)||0); setShowTurnNumpad(null); }, function(){ setShowTurnNumpad(null); }, [showTurnNumpad]);
  useNumpadKeyboard(showTurnNumpad === 'walkin_price', function(d){ handlePriceKey(d, setWalkinPriceStr); }, function(){ handlePriceKey('⌫', setWalkinPriceStr); }, function(){ set('walkin_turn_minimum_cents', parseInt(walkinPriceStr,10)||0); setShowTurnNumpad(null); }, function(){ setShowTurnNumpad(null); }, [showTurnNumpad]);
  useNumpadKeyboard(showTurnNumpad === 'requested_price', function(d){ handlePriceKey(d, setRequestedPriceStr); }, function(){ handlePriceKey('⌫', setRequestedPriceStr); }, function(){ set('requested_appt_minimum_cents', parseInt(requestedPriceStr,10)||0); setShowTurnNumpad(null); }, function(){ setShowTurnNumpad(null); }, [showTurnNumpad]);

  // ── Printer state ──
  // Phase 1: mock discovered printers. Phase 2: real network scan via backend.
  var [printers, setPrinters] = useState(
    (salonSettings || {}).printers || [
      { id: 'p1', name: 'Front Desk', ip: '192.168.1.45', language: 'escpos', status: 'online' },
      { id: 'p2', name: 'Station 2',  ip: '192.168.1.46', language: 'escpos', status: 'online' },
      { id: 'p3', name: 'Back Office',ip: '192.168.1.47', language: 'escpos', status: 'offline' },
    ]
  );
  var [editingPrinter, setEditingPrinter] = useState(null); // id of printer being named
  var [editingName, setEditingName] = useState('');
  var [addManualOpen, setAddManualOpen] = useState(false);
  var [manualIp, setManualIp] = useState('');
  var [manualName, setManualName] = useState('');
  var [scanning, setScanning] = useState(false);

  var ts = salonSettings || {};

  function set(key, val) { if (onSettingsUpdate) onSettingsUpdate(key, val); }

  // Shared accordion props
  var accProps = { openId: salonAccordion, onToggle: setSalonAccordion, T: T };

  return (
    <div style={{ height: '100%' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 16 }}>Salon Settings</div>
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Left column */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <AccSection id="info" title="Salon Information" {...accProps}>
            <FieldRow label="Salon name" T={T}><Input value={settings.salon_name} onChange={function(v) { set('salon_name', v); }} style={{ width: 220 }} T={T} /></FieldRow>
            <FieldRow label="Phone" T={T}><Input value={settings.salon_phone} onChange={function(v) { set('salon_phone', v); }} style={{ width: 180 }} T={T} /></FieldRow>
            <FieldRow label="Email" T={T}><Input value={settings.salon_email} onChange={function(v) { set('salon_email', v); }} style={{ width: 220 }} T={T} /></FieldRow>
            <FieldRow label="Address" T={T}><Input value={settings.salon_address} onChange={function(v) { set('salon_address', v); }} style={{ width: 320 }} T={T} /></FieldRow>
            <FieldRow label="Opening time" T={T}><Input value={settings.opening_time} onChange={function(v) { set('opening_time', v); }} type="time" style={{ width: 120 }} T={T} /></FieldRow>
            <FieldRow label="Closing time" T={T}><Input value={settings.closing_time} onChange={function(v) { set('closing_time', v); }} type="time" style={{ width: 120 }} T={T} /></FieldRow>
            <OwnerCodeSection />
          </AccSection>
          <AccSection id="checkout" title="Checkout, Discount & Tips" {...accProps}>
            <FieldRow label="Tax rate" T={T}><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Input value={settings.tax_rate_percent} onChange={function(v) { set('tax_rate_percent', v); }} type="number" style={{ width: 60 }} T={T} /><span style={{ color: T.textMuted, fontSize: 13 }}>%</span></div></FieldRow>
            <FieldRow label="Tip presets" desc="Comma-separated percentages" T={T}><Input value={settings.tip_presets} onChange={function(v) { set('tip_presets', v); }} style={{ width: 140 }} T={T} /></FieldRow>
            <FieldRow label="Show tips on customer display" T={T}><Toggle value={settings.tip_on_customer_display} onChange={function(v) { set('tip_on_customer_display', v); }} T={T} /></FieldRow>
            <FieldRow label="Require PIN for discounts" T={T}><Toggle value={settings.discount_require_pin} onChange={function(v) { set('discount_require_pin', v); }} T={T} /></FieldRow>
            <FieldRow label="Discount reduces commission" desc="When ON, commission is calculated on the discounted amount. When OFF, commission is on the full service price." T={T}>
              <Toggle value={settings.discount_reduces_commission} onChange={function(v) { set('discount_reduces_commission', v); }} T={T} />
            </FieldRow>
            <FieldRow label="Show service time" desc="Display duration (e.g. 45 min) on service items in booking and checkout" T={T}>
              <Toggle value={settings.show_service_time !== false} onChange={function(v) { set('show_service_time', v); }} T={T} />
            </FieldRow>
            <FieldRow label="Show product deduction" desc="Display product cost deduction on service items in booking and checkout" T={T}>
              <Toggle value={settings.show_product_deduction !== false} onChange={function(v) { set('show_product_deduction', v); }} T={T} />
            </FieldRow>
            <FieldRow label="Auto-print tech copy" desc="Automatically print a tech slip for each technician after checkout completes. Shows ticket number, their services, prices after deductions, and payment method." T={T}>
              <Toggle value={settings.tech_auto_print_receipt !== false} onChange={function(v) { set('tech_auto_print_receipt', v); }} T={T} />
            </FieldRow>
          </AccSection>
          <AccSection id="surcharges" title="Surcharges" {...accProps}>
            {/* Surcharge 1 */}
            <FieldRow label="Surcharge 1" desc="Applied to credit card payments on the total bill (after tax + tip)" T={T}>
              <Toggle value={settings.surcharge1_enabled} onChange={function(v) { set('surcharge1_enabled', v); }} T={T} />
            </FieldRow>
            {settings.surcharge1_enabled && (
              <>
                <FieldRow label="Name" T={T}>
                  <Input value={settings.surcharge1_name || ''} onChange={function(v) { set('surcharge1_name', v); }} style={{ width: 200 }} T={T} />
                </FieldRow>
                <FieldRow label="Type" T={T}>
                  <Select value={settings.surcharge1_type || 'percent'} options={[{value:'percent',label:'Percentage'},{value:'dollar',label:'Dollar Amount'}]} onChange={function(v) { set('surcharge1_type', v); }} T={T} />
                </FieldRow>
                <FieldRow label="Value" T={T}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {(settings.surcharge1_type || 'percent') === 'dollar' && <span style={{ color: T.text, fontSize: 14 }}>$</span>}
                    <Input value={settings.surcharge1_value != null ? settings.surcharge1_value : ''} onChange={function(v) { set('surcharge1_value', v); }} type="number" style={{ width: 80 }} T={T} />
                    {(settings.surcharge1_type || 'percent') === 'percent' && <span style={{ color: T.textMuted, fontSize: 13 }}>%</span>}
                  </div>
                </FieldRow>
              </>
            )}
            {/* Surcharge 2 */}
            <FieldRow label="Surcharge 2" desc="Second optional surcharge for credit card payments" T={T}>
              <Toggle value={settings.surcharge2_enabled} onChange={function(v) { set('surcharge2_enabled', v); }} T={T} />
            </FieldRow>
            {settings.surcharge2_enabled && (
              <>
                <FieldRow label="Name" T={T}>
                  <Input value={settings.surcharge2_name || ''} onChange={function(v) { set('surcharge2_name', v); }} style={{ width: 200 }} T={T} />
                </FieldRow>
                <FieldRow label="Type" T={T}>
                  <Select value={settings.surcharge2_type || 'percent'} options={[{value:'percent',label:'Percentage'},{value:'dollar',label:'Dollar Amount'}]} onChange={function(v) { set('surcharge2_type', v); }} T={T} />
                </FieldRow>
                <FieldRow label="Value" T={T}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {(settings.surcharge2_type || 'percent') === 'dollar' && <span style={{ color: T.text, fontSize: 14 }}>$</span>}
                    <Input value={settings.surcharge2_value != null ? settings.surcharge2_value : ''} onChange={function(v) { set('surcharge2_value', v); }} type="number" style={{ width: 80 }} T={T} />
                    {(settings.surcharge2_type || 'percent') === 'percent' && <span style={{ color: T.textMuted, fontSize: 13 }}>%</span>}
                  </div>
                </FieldRow>
              </>
            )}
          </AccSection>
          <AccSection id="cashdrawer" title="Cash Drawer" {...accProps}>
            <FieldRow label="Enable cash drawer" desc="Requires cashier to open drawer before processing cash payments" T={T}>
              <Toggle value={settings.cashier_enabled} onChange={function(v) { set('cashier_enabled', v); }} T={T} />
            </FieldRow>
            {settings.cashier_enabled && (
              <FieldRow label="Show shortage/overage amount on receipt" desc="Print the dollar amount when drawer is short or over" T={T}>
                <Toggle value={settings.cashier_show_short_amount} onChange={function(v) { set('cashier_show_short_amount', v); }} T={T} />
              </FieldRow>
            )}
          </AccSection>
          <AccSection id="branding" title="Display & Branding" {...accProps}>
            <FieldRow label="Salon brand color" desc="Used on online booking portal and customer display" T={T}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: settings.salon_brand_color, border: '1px solid ' + T.border }} />
                <Input value={settings.salon_brand_color} onChange={function(v) { set('salon_brand_color', v); }} style={{ width: 100 }} T={T} />
              </div>
            </FieldRow>
            <FieldRow label="Salon logo" desc="Displayed on online booking portal" T={T}>
              <button style={{ background: 'none', border: '1px solid ' + T.border, color: T.textSecondary, borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Upload logo</button>
            </FieldRow>
          </AccSection>
          <AccSection id="prodcomm" title="Product Commission" {...accProps}>
            <FieldRow label="Retail commission %" desc="Percentage techs earn on product sales. 0 = no product commission." T={T}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Input value={settings.retail_commission_pct != null ? settings.retail_commission_pct : 0} onChange={function(v) { set('retail_commission_pct', parseFloat(v) || 0); }} type="number" style={{ width: 70 }} T={T} />
                <span style={{ color: T.textMuted, fontSize: 13 }}>%</span>
              </div>
            </FieldRow>
          </AccSection>
          <AccSection id="roles" title="Role Permissions" {...accProps}>
            <RolesAccordion salonSettings={salonSettings} onSettingsUpdate={onSettingsUpdate} activeRole={activeRoleTab} onRoleChange={setActiveRoleTab} />
          </AccSection>
          <AccSection id="vip" title="VIP Settings" {...accProps}>
            <FieldRow label="Enable VIP program" desc="Automatically grant VIP status to top clients based on spending or visits" T={T}>
              <Toggle value={settings.vip_enabled !== false} onChange={function(v) { set('vip_enabled', v); }} T={T} />
            </FieldRow>
            {settings.vip_enabled !== false && (
              <>
                <FieldRow label="Qualification method" desc="How a client earns VIP status" T={T}>
                  <Select value={settings.vip_threshold_type || 'spend'} options={[{value:'spend',label:'Total Spend ($)'},{value:'visits',label:'Number of Visits'}]} onChange={function(v) { set('vip_threshold_type', v); }} T={T} />
                </FieldRow>
                <FieldRow label={settings.vip_threshold_type === 'visits' ? 'Minimum visits' : 'Minimum spend'} desc={settings.vip_threshold_type === 'visits' ? 'Number of completed visits to qualify' : 'Total dollars spent to qualify'} T={T}>
                  {settings.vip_threshold_type === 'visits' ? (
                    <Input value={settings.vip_threshold_amount || 10} onChange={function(v) { set('vip_threshold_amount', parseInt(v) || 0); }} type="number" style={{ width: 70 }} T={T} />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: T.textMuted, fontSize: 13 }}>$</span>
                      <Input value={((settings.vip_threshold_amount || 0) / 100).toFixed(0)} onChange={function(v) { set('vip_threshold_amount', parseInt(v || 0) * 100); }} type="number" style={{ width: 80 }} T={T} />
                    </div>
                  )}
                </FieldRow>
                <FieldRow label="Rolling time period" desc="How far back to look when checking qualification" T={T}>
                  <Select value={String(settings.vip_rolling_months || 6)} options={[{value:'1',label:'1 month'},{value:'2',label:'2 months'},{value:'3',label:'3 months'},{value:'6',label:'6 months'},{value:'12',label:'12 months'}]} onChange={function(v) { set('vip_rolling_months', parseInt(v)); }} T={T} />
                </FieldRow>
                <FieldRow label="Keep VIP permanently" desc="When ON, clients keep VIP forever once earned. When OFF, VIP is removed if they drop below the threshold." T={T}>
                  <Toggle value={!!settings.vip_permanent} onChange={function(v) { set('vip_permanent', v); }} T={T} />
                </FieldRow>
                <FieldRow label="VIP discount type" T={T}>
                  <Select value={settings.vip_discount_type || 'percent'} options={[{value:'percent',label:'Percentage'},{value:'dollar',label:'Dollar Amount'}]} onChange={function(v) { set('vip_discount_type', v); }} T={T} />
                </FieldRow>
                <FieldRow label="Discount amount" desc="Auto-applied at checkout for VIP clients (staff can remove)" T={T}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {(settings.vip_discount_type || 'percent') === 'dollar' && <span style={{ color: T.text, fontSize: 14 }}>$</span>}
                    <Input value={settings.vip_discount_amount != null ? settings.vip_discount_amount : ''} onChange={function(v) { set('vip_discount_amount', parseFloat(v) || 0); }} type="number" style={{ width: 80 }} T={T} />
                    {(settings.vip_discount_type || 'percent') === 'percent' && <span style={{ color: T.textMuted, fontSize: 13 }}>%</span>}
                  </div>
                </FieldRow>
                <div style={{ fontSize: 12, color: T.textMuted, padding: '8px 0 0', lineHeight: 1.6 }}>
                  Owners can manually override VIP status on any client's profile, regardless of these rules. Manual VIP is never auto-removed.
                </div>
              </>
            )}
          </AccSection>
          <AccSection id="printers" title="Printers & Receipt" {...accProps}>
            {/* Discovered printer list */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 13, color: T.textMuted }}>
                  {scanning ? '🔍 Scanning network...' : printers.length + ' printer' + (printers.length !== 1 ? 's' : '') + ' found on your network'}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div onClick={function() {
                    setScanning(true);
                    // Try real QZ Tray printer discovery, fall back to mock scan
                    if (isQzReady()) {
                      getPrinterList().then(function(list) {
                        if (list.length > 0) {
                          var discovered = list.map(function(name, i) {
                            // Check if we already have this printer
                            var existing = printers.find(function(p) { return p.name === name || p.ip === name; });
                            if (existing) return existing;
                            return { id: 'p' + Date.now() + i, name: name, ip: name, language: 'escpos', status: 'online' };
                          });
                          setPrinters(discovered);
                          toast.success(list.length + ' printer' + (list.length !== 1 ? 's' : '') + ' found via QZ Tray');
                        } else {
                          toast.info('No printers found. Make sure printers are installed in Windows.');
                        }
                        setScanning(false);
                      }).catch(function() { setScanning(false); toast.error('Printer scan failed'); });
                    } else {
                      toast.info('QZ Tray not connected — showing saved printers only');
                      setTimeout(function() { setScanning(false); }, 800);
                    }
                  }} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid ' + T.border, background: T.grid, color: T.text, fontSize: 12, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
                    onMouseEnter={function(e) { e.currentTarget.style.background = T.borderLight; }}
                    onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
                  >🔍 Scan Again</div>
                  <div onClick={function() { setAddManualOpen(!addManualOpen); setManualIp(''); setManualName(''); }}
                    style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid ' + T.border, background: T.grid, color: T.text, fontSize: 12, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
                    onMouseEnter={function(e) { e.currentTarget.style.background = T.borderLight; }}
                    onMouseLeave={function(e) { e.currentTarget.style.background = T.grid; }}
                  >+ Add by IP</div>
                </div>
              </div>

              {/* Printer rows */}
              {printers.map(function(p) {
                var isEditing = editingPrinter === p.id;
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: '1px solid ' + T.borderLight, background: T.chrome, marginBottom: 8 }}>
                    <div style={{ fontSize: 20 }}>🖨️</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input value={editingName} onChange={function(e) { setEditingName(e.target.value); }} autoFocus
                            placeholder="e.g. Front Desk"
                            style={{ background: T.grid, color: T.text, border: '1px solid ' + T.accent, borderRadius: 6, padding: '4px 10px', fontSize: 13, fontFamily: 'inherit', width: 160 }} />
                          <div onClick={function() {
                            setPrinters(function(prev) { return prev.map(function(x) { return x.id === p.id ? Object.assign({}, x, { name: editingName || x.name }) : x; }); });
                            setEditingPrinter(null);
                          }} style={{ padding: '4px 10px', borderRadius: 6, background: T.primary, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Save</div>
                          <div onClick={function() { setEditingPrinter(null); }} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid ' + T.border, color: T.textMuted, fontSize: 12, cursor: 'pointer' }}>Cancel</div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{p.name || <span style={{ color: T.textMuted, fontStyle: 'italic' }}>Unnamed printer</span>}</div>
                      )}
                      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2, fontFamily: 'monospace' }}>{p.ip}</div>
                    </div>
                    {/* Language selector */}
                    <select value={p.language} onChange={function(e) { var lang = e.target.value; setPrinters(function(prev) { return prev.map(function(x) { return x.id === p.id ? Object.assign({}, x, { language: lang }) : x; }); }); }}
                      style={{ background: T.grid, color: T.text, border: '1px solid ' + T.border, borderRadius: 6, padding: '4px 8px', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}>
                      <option value="escpos">ESC/POS</option>
                      <option value="starprnt">StarPRNT</option>
                    </select>
                    {/* Status badge */}
                    <div style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: p.status === 'online' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)', color: p.status === 'online' ? '#22C55E' : '#EF4444', whiteSpace: 'nowrap' }}>
                      {p.status === 'online' ? '✅ Online' : '⚠️ Offline'}
                    </div>
                    {/* Test / Rename / delete */}
                    <div onClick={function() {
                      var pName = p.name || p.ip;
                      printTestPage(pName).then(function(r) {
                        if (r.success) toast.success('Test sent to ' + pName);
                        else toast.error('Test print failed — check printer connection');
                      });
                    }}
                      style={{ fontSize: 12, color: T.accent, cursor: 'pointer', padding: '4px 8px', borderRadius: 6, border: '1px solid ' + T.accent + '44' }}
                      onMouseEnter={function(e) { e.currentTarget.style.background = T.accent + '18'; }}
                      onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}>🖨 Test</div>
                    <div onClick={function() { setEditingPrinter(p.id); setEditingName(p.name); }}
                      style={{ fontSize: 12, color: T.textMuted, cursor: 'pointer', padding: '4px 8px', borderRadius: 6, border: '1px solid ' + T.borderLight }}
                      onMouseEnter={function(e) { e.currentTarget.style.color = T.text; }}
                      onMouseLeave={function(e) { e.currentTarget.style.color = T.textMuted; }}>✏️ Rename</div>
                    <div onClick={function() { toast.confirm('Remove ' + (p.name || p.ip) + '?', function() { setPrinters(function(prev) { return prev.filter(function(x) { return x.id !== p.id; }); }); }); }}
                      style={{ fontSize: 12, color: '#EF4444', cursor: 'pointer', padding: '4px 8px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)' }}
                      onMouseEnter={function(e) { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                      onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}>Remove</div>
                  </div>
                );
              })}

              {printers.length === 0 && !scanning && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: T.textMuted, fontSize: 13 }}>
                  No printers found. Make sure your printers are on and connected to the same network.
                </div>
              )}

              {/* Manual add form */}
              {addManualOpen && (
                <div style={{ padding: '14px', borderRadius: 8, border: '1px solid ' + T.border, background: T.chrome, marginTop: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 10 }}>Add Printer by IP Address</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input value={manualIp} onChange={function(e) { setManualIp(e.target.value); }} placeholder="192.168.1.48"
                      style={{ background: T.grid, color: T.text, border: '1px solid ' + T.border, borderRadius: 6, padding: '6px 10px', fontSize: 13, fontFamily: 'monospace', width: 150 }} />
                    <input value={manualName} onChange={function(e) { setManualName(e.target.value); }} placeholder="Printer name"
                      style={{ background: T.grid, color: T.text, border: '1px solid ' + T.border, borderRadius: 6, padding: '6px 10px', fontSize: 13, fontFamily: 'inherit', width: 150 }} />
                    <div onClick={function() {
                      if (!manualIp) return;
                      var newP = { id: 'p' + Date.now(), name: manualName || 'New Printer', ip: manualIp, language: 'escpos', status: 'online' };
                      setPrinters(function(prev) { return prev.concat([newP]); });
                      setAddManualOpen(false); setManualIp(''); setManualName('');
                    }} style={{ padding: '6px 14px', borderRadius: 6, background: T.primary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Add</div>
                    <div onClick={function() { setAddManualOpen(false); }} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid ' + T.border, color: T.textMuted, fontSize: 13, cursor: 'pointer' }}>Cancel</div>
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted, marginTop: 8 }}>💡 Find your printer's IP by printing a self-test page — hold the Feed button while powering on the printer.</div>
                </div>
              )}
            </div>

            {/* Failover note */}
            <div style={{ fontSize: 12, color: T.textMuted, padding: '10px 12px', borderRadius: 8, background: T.chrome, border: '1px solid ' + T.borderLight, lineHeight: 1.6 }}>
              <span style={{ fontWeight: 600, color: T.textSecondary }}>Failover: </span>
              When a station's primary printer goes offline, the system automatically redirects to the next available printer and notifies the staff member.
            </div>
          </AccSection>
        </div>
        {/* Right column */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <AccSection id="booking" title="Booking & Calendar" {...accProps}>
            <FieldRow label="Auto-request mode" desc="Every appointment placed on a tech's column is automatically marked as requested." T={T}>
              <Toggle value={settings.auto_request_mode} onChange={function(v) { set('auto_request_mode', v); }} T={T} />
            </FieldRow>
            <FieldRow label="Group booking — collect client name" desc="When adding a second client to a booking, prompt for their name before picking a technician." T={T}>
              <Toggle value={settings.group_booking_require_name !== false} onChange={function(v) { set('group_booking_require_name', v); }} T={T} />
            </FieldRow>
            <FieldRow label="Use appointment confirmation" desc="Enable Pending → Confirmed workflow with ✓ badge on calendar" T={T}>
              <Toggle value={settings.use_confirmation} onChange={function(v) { set('use_confirmation', v); }} T={T} />
            </FieldRow>
            <FieldRow label="Wait time display" desc="What clients see on the waiting list" T={T}>
              <Select value={settings.wait_display_mode} onChange={function(v) { set('wait_display_mode', v); }} options={[{value:'actual',label:'Actual wait'},{value:'estimated',label:'Estimated wait'},{value:'off',label:'Off'}]} T={T} />
            </FieldRow>
            <FieldRow label="Tech column order" desc="How technician columns are sorted on the calendar" T={T}>
              <Select value={settings.tech_column_order} onChange={function(v) { set('tech_column_order', v); }} options={[{value:'alpha',label:'A–Z by name'},{value:'manual',label:'Manual order'}]} T={T} />
            </FieldRow>
            <FieldRow label="Booking increment" desc="Minimum time slot size (locked at 15 min)" T={T}>
              <span style={{ fontSize: 14, color: T.textSecondary }}>15 minutes</span>
            </FieldRow>
          </AccSection>
          <AccSection id="deposits" title="Deposits & Cancellation" {...accProps}>
            <FieldRow label="Deposits enabled" T={T}><Toggle value={settings.deposit_enabled !== false} onChange={function(v) { set('deposit_enabled', v); if (!v) set('deposit_trigger', 'above_threshold'); }} T={T} /></FieldRow>
            {settings.deposit_enabled !== false && <FieldRow label="Deposit mode" T={T}>
              <Select value={settings.deposit_trigger || 'above_threshold'} onChange={function(v) { set('deposit_trigger', v); }} options={[{value:'always',label:'Always require'},{value:'above_threshold',label:'Above threshold'}]} T={T} />
            </FieldRow>}
            {settings.deposit_enabled !== false && (settings.deposit_trigger || 'above_threshold') === 'above_threshold' && (
              <FieldRow label="Threshold" desc="Visit total above this amount requires deposit" T={T}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ color: T.textMuted, fontSize: 13 }}>$</span><Input value={((settings.deposit_threshold_cents || 0) / 100).toFixed(0)} onChange={function(v) { set('deposit_threshold_cents', parseInt(v || 0) * 100); }} type="number" style={{ width: 70 }} T={T} /></div>
              </FieldRow>
            )}
            {settings.deposit_enabled !== false && (
              <>
                <FieldRow label="Deposit type" T={T}>
                  <Select value={settings.deposit_amount_type || 'flat'} onChange={function(v) { set('deposit_amount_type', v); }} options={[{value:'flat',label:'Flat amount'},{value:'percentage',label:'Percentage'}]} T={T} />
                </FieldRow>
                <FieldRow label="Amount" T={T}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ color: T.textMuted, fontSize: 13 }}>{(settings.deposit_amount_type || 'flat') === 'flat' ? '$' : ''}</span><Input value={(settings.deposit_amount_type || 'flat') === 'flat' ? ((settings.deposit_flat_amount_cents || 0) / 100).toFixed(0) : (settings.deposit_percentage || 0)} onChange={function(v) { (settings.deposit_amount_type || 'flat') === 'flat' ? set('deposit_flat_amount_cents', parseInt(v || 0) * 100) : set('deposit_percentage', parseFloat(v || 0)); }} type="number" style={{ width: 70 }} T={T} /></div>
                </FieldRow>
                <FieldRow label="Online bookings" T={T}><Toggle value={settings.deposit_source_online} onChange={function(v) { set('deposit_source_online', v); }} T={T} /></FieldRow>
                <FieldRow label="Staff-created bookings" T={T}><Toggle value={settings.deposit_source_staff} onChange={function(v) { set('deposit_source_staff', v); }} T={T} /></FieldRow>
              </>
            )}
            {settings.deposit_enabled !== false && (
              <>
                <div style={{ height: 1, background: T.borderLight, margin: '12px 0' }} />
                <SectionTitle T={T}>Cancellation & No-Show</SectionTitle>
                <FieldRow label="Free cancellation window" desc="Hours before appointment the client can cancel without penalty" T={T}><Input value={settings.cancellation_window_hours} onChange={function(v) { set('cancellation_window_hours', v); }} type="number" style={{ width: 60 }} T={T} /></FieldRow>
                <FieldRow label="Late cancel policy" T={T}><Select value={settings.late_cancel_policy} onChange={function(v) { set('late_cancel_policy', v); }} options={[{value:'forfeit',label:'Forfeit deposit'},{value:'partial',label:'Partial refund'},{value:'full_refund',label:'Full refund'}]} T={T} /></FieldRow>
                <FieldRow label="No-show policy" T={T}><Select value={settings.noshow_policy} onChange={function(v) { set('noshow_policy', v); }} options={[{value:'forfeit',label:'Forfeit deposit'},{value:'fee',label:'Charge fee'},{value:'none',label:'No penalty'}]} T={T} /></FieldRow>
                {settings.noshow_policy === 'fee' && <FieldRow label="No-show fee" T={T}><div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ color: T.textMuted, fontSize: 13 }}>$</span><Input value={(settings.noshow_fee_cents / 100).toFixed(0)} onChange={function(v) { set('noshow_fee_cents', parseInt(v || 0) * 100); }} type="number" style={{ width: 70 }} T={T} /></div></FieldRow>}
              </>
            )}
            {settings.deposit_enabled === false && (
              <div style={{ padding: '8px 0', fontSize: 12, color: T.textMuted, lineHeight: 1.5 }}>
                Cancellation and no-show policies require deposits to be enabled. Without a deposit on file, there is nothing to forfeit or charge.
              </div>
            )}
          </AccSection>
          <AccSection id="techturn" title="Tech Turn Rotation" {...accProps}>
            <FieldRow label="Rotation mode" desc="How the next available tech is determined" T={T}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {ROTATION_OPTS.map(function(opt) {
                  var isSel = ts.rotation_mode === opt.value;
                  return (
                    <div key={opt.value} onClick={function() { set('rotation_mode', opt.value); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, cursor: 'pointer', background: isSel ? T.accentBg : 'transparent', border: '1px solid ' + (isSel ? T.accent : 'transparent') }}
                      onMouseEnter={function(e) { if (!isSel) e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                      onMouseLeave={function(e) { if (!isSel) e.currentTarget.style.background = 'transparent'; }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid ' + (isSel ? T.accent : '#475569'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {isSel && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#38BDF8' }} />}
                      </div>
                      <span style={{ color: isSel ? '#E2E8F0' : '#CBD5E1', fontSize: 13 }}>{opt.label}</span>
                    </div>
                  );
                })}
              </div>
            </FieldRow>
            <FieldRow label="Counting mode" desc="How turns are counted" T={T}>
              <div style={{ display: 'flex', gap: 0 }}>
                {[{ value: 'simple', label: 'Simple' }, { value: 'advanced', label: 'Advanced' }].map(function(opt, i) {
                  var isAct = ts.turn_counting_mode === opt.value;
                  return (
                    <div key={opt.value} onClick={function() { set('turn_counting_mode', opt.value); setShowTurnNumpad(null); }}
                      style={{ padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', background: isAct ? '#38BDF8' : '#334155', color: isAct ? '#FFFFFF' : '#E2E8F0', border: isAct ? '1px solid #2563EB' : '1px solid #475569', borderRadius: i === 0 ? '6px 0 0 6px' : '0 6px 6px 0', borderLeft: i === 0 ? undefined : 'none', userSelect: 'none' }}
                      onMouseEnter={function(e) { if (!isAct) { e.currentTarget.style.background = '#3E4C5E'; } }}
                      onMouseLeave={function(e) { if (!isAct) { e.currentTarget.style.background = '#334155'; } }}
                    >{opt.label}</div>
                  );
                })}
              </div>
            </FieldRow>
            {ts.turn_counting_mode === 'simple' && (
              <div style={{ padding: '14px 0', borderBottom: '1px solid ' + T.borderLight }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div><div style={{ fontSize: 14, color: T.text }}>Price minimum</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>Service total must meet this to count as a turn</div></div>
                  <div onClick={function() { setShowTurnNumpad(showTurnNumpad === 'turn_price' ? null : 'turn_price'); }}
                    style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                    <div style={{ height: 38, padding: '0 10px', background: '#475569', border: '1px solid ' + (showTurnNumpad === 'turn_price' ? '#38BDF8' : '#475569'), borderRadius: '6px 0 0 6px', display: 'flex', alignItems: 'center', color: '#E2E8F0', fontSize: 13, fontWeight: 500 }}>$</div>
                    <div style={{ height: 38, padding: '0 12px', background: '#334155', border: '1px solid ' + (showTurnNumpad === 'turn_price' ? '#38BDF8' : '#475569'), borderLeft: 'none', borderRadius: '0 6px 6px 0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: 60 }}>
                      <span style={{ color: '#E2E8F0', fontSize: 16, fontWeight: 600 }}>{turnPriceStr ? (parseInt(turnPriceStr, 10) / 100).toFixed(2) : '0.00'}</span>
                    </div>
                  </div>
                </div>
                {showTurnNumpad === 'turn_price' && (
                  <div style={{ marginTop: 10, background: '#0F172A', border: '1px solid #475569', borderRadius: 10, padding: 10, width: 200 }}>
                    <div style={{ color: T.text, fontSize: 11, textAlign: 'center', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Price Minimum</div>
                    {payNumpad(function(key) { handlePriceKey(key, setTurnPriceStr); }, function() { set('turn_price_minimum_cents', parseInt(turnPriceStr, 10) || 0); setShowTurnNumpad(null); }, T)}
                  </div>
                )}
              </div>
            )}
            {ts.turn_counting_mode === 'advanced' && (
              <>
                <div style={{ padding: '14px 0', borderBottom: '1px solid ' + T.borderLight }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div><div style={{ fontSize: 14, color: T.text }}>Walk-in & non-requested minimum</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>Applies to walk-ins and non-requested appointments</div></div>
                    <div onClick={function() { setShowTurnNumpad(showTurnNumpad === 'walkin_price' ? null : 'walkin_price'); }}
                      style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                      <div style={{ height: 38, padding: '0 10px', background: '#475569', border: '1px solid ' + (showTurnNumpad === 'walkin_price' ? '#38BDF8' : '#475569'), borderRadius: '6px 0 0 6px', display: 'flex', alignItems: 'center', color: '#E2E8F0', fontSize: 13, fontWeight: 500 }}>$</div>
                      <div style={{ height: 38, padding: '0 12px', background: '#334155', border: '1px solid ' + (showTurnNumpad === 'walkin_price' ? '#38BDF8' : '#475569'), borderLeft: 'none', borderRadius: '0 6px 6px 0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: 60 }}>
                        <span style={{ color: '#E2E8F0', fontSize: 16, fontWeight: 600 }}>{walkinPriceStr ? (parseInt(walkinPriceStr, 10) / 100).toFixed(2) : '0.00'}</span>
                      </div>
                    </div>
                  </div>
                  {showTurnNumpad === 'walkin_price' && (
                    <div style={{ marginTop: 10, background: '#0F172A', border: '1px solid #475569', borderRadius: 10, padding: 10, width: 200 }}>
                      <div style={{ color: T.text, fontSize: 11, textAlign: 'center', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Walk-in Minimum</div>
                      {payNumpad(function(key) { handlePriceKey(key, setWalkinPriceStr); }, function() { set('walkin_turn_minimum_cents', parseInt(walkinPriceStr, 10) || 0); setShowTurnNumpad(null); }, T)}
                    </div>
                  )}
                </div>
                <div style={{ padding: '14px 0', borderBottom: '1px solid ' + T.borderLight }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div><div style={{ fontSize: 14, color: T.text }}>Requested appointments count as turn</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>When off, requested appointments never affect position</div></div>
                    <Toggle value={!!ts.requested_appt_counts_as_turn} onChange={function(v) { set('requested_appt_counts_as_turn', v); setShowTurnNumpad(null); }} T={T} />
                  </div>
                </div>
                {ts.requested_appt_counts_as_turn && (
                  <div style={{ padding: '14px 0', borderBottom: '1px solid ' + T.borderLight }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div><div style={{ fontSize: 14, color: T.text }}>Requested appointment minimum</div><div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>Separate price threshold for requested appointments</div></div>
                      <div onClick={function() { setShowTurnNumpad(showTurnNumpad === 'requested_price' ? null : 'requested_price'); }}
                        style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                        <div style={{ height: 38, padding: '0 10px', background: '#475569', border: '1px solid ' + (showTurnNumpad === 'requested_price' ? '#38BDF8' : '#475569'), borderRadius: '6px 0 0 6px', display: 'flex', alignItems: 'center', color: '#E2E8F0', fontSize: 13, fontWeight: 500 }}>$</div>
                        <div style={{ height: 38, padding: '0 12px', background: '#334155', border: '1px solid ' + (showTurnNumpad === 'requested_price' ? '#38BDF8' : '#475569'), borderLeft: 'none', borderRadius: '0 6px 6px 0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: 60 }}>
                          <span style={{ color: '#E2E8F0', fontSize: 16, fontWeight: 600 }}>{requestedPriceStr ? (parseInt(requestedPriceStr, 10) / 100).toFixed(2) : '0.00'}</span>
                        </div>
                      </div>
                    </div>
                    {showTurnNumpad === 'requested_price' && (
                      <div style={{ marginTop: 10, background: '#0F172A', border: '1px solid #475569', borderRadius: 10, padding: 10, width: 200 }}>
                        <div style={{ color: T.text, fontSize: 11, textAlign: 'center', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Requested Minimum</div>
                        {payNumpad(function(key) { handlePriceKey(key, setRequestedPriceStr); }, function() { set('requested_appt_minimum_cents', parseInt(requestedPriceStr, 10) || 0); setShowTurnNumpad(null); }, T)}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </AccSection>
          <AccSection id="checkprint" title="Check Printing" {...accProps}>
            <FieldRow label="Horizontal offset" desc="Shift all text left (-) or right (+) on check stock" T={T}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Input value={settings.check_horizontal_offset != null ? settings.check_horizontal_offset : 0} onChange={function(v) { set('check_horizontal_offset', parseFloat(v) || 0); }} type="number" style={{ width: 80 }} T={T} />
                <span style={{ color: T.textMuted, fontSize: 12 }}>in</span>
              </div>
            </FieldRow>
            <FieldRow label="Vertical offset" desc="Shift all text up (-) or down (+) on check stock" T={T}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Input value={settings.check_vertical_offset != null ? settings.check_vertical_offset : 0} onChange={function(v) { set('check_vertical_offset', parseFloat(v) || 0); }} type="number" style={{ width: 80 }} T={T} />
                <span style={{ color: T.textMuted, fontSize: 12 }}>in</span>
              </div>
            </FieldRow>
            <FieldRow label="Starting check number" desc="Enter the number from your first check in the stock" T={T}>
              <Input value={settings.check_next_number || 1001} onChange={function(v) { var n = parseInt(v) || 1001; set('check_next_number', n); set('check_starting_number', n); }} type="number" style={{ width: 100 }} T={T} />
            </FieldRow>
            <div style={{ paddingTop: 16, display: 'flex', gap: 12 }}>
              <div onClick={function() {
                  var hOff = settings.check_horizontal_offset || 0;
                  var vOff = settings.check_vertical_offset || 0;
                  var L = [];
                  L.push('<html><head><title>Check Alignment Test</title>');
                  L.push('<style>');
                  L.push('* { margin: 0; padding: 0; box-sizing: border-box; }');
                  L.push('body { font-family: "Arial", "Helvetica", sans-serif; color: #999; }');
                  L.push('@page { size: letter; margin: 0; }');
                  L.push('.check-page { width: 8.5in; height: 11in; position: relative; }');
                  L.push('.check-area { position: relative; width: 8.5in; height: 3.5in; border-bottom: 1px dashed #ccc; }');
                  L.push('.check-field { position: absolute; }');
                  L.push('.stub-area { padding: 0.5in 0.6in; font-family: "Courier New", monospace; font-size: 11px; color: #999; }');
                  L.push('.label { font-size: 9px; color: #bbb; margin-bottom: 1px; }');
                  L.push('</style></head><body>');
                  L.push('<div class="check-page">');
                  L.push('<div class="check-area">');
                  L.push('<div class="check-field" style="top: calc(0.65in + ' + vOff + 'in); right: calc(0.75in - ' + hOff + 'in);"><div class="label">DATE</div><div style="font-size:14px; border-bottom: 1px solid #ccc; padding-bottom: 2px;">MM / DD / YYYY</div></div>');
                  L.push('<div class="check-field" style="top: calc(1.25in + ' + vOff + 'in); left: calc(1.2in + ' + hOff + 'in);"><div class="label">PAY TO THE ORDER OF</div><div style="font-size:15px; font-weight:bold; border-bottom: 1px solid #ccc; padding-bottom: 2px;">FIRST LAST ****</div></div>');
                  L.push('<div class="check-field" style="top: calc(1.20in + ' + vOff + 'in); right: calc(0.55in - ' + hOff + 'in);"><div class="label">AMOUNT</div><div style="font-size:16px; font-weight:bold; border: 1px solid #ccc; padding: 2px 8px;">$0,000.00</div></div>');
                  L.push('<div class="check-field" style="top: calc(1.75in + ' + vOff + 'in); left: calc(0.5in + ' + hOff + 'in); right: calc(0.5in - ' + hOff + 'in);"><div class="label">WRITTEN AMOUNT</div><div style="font-size:12px; border-bottom: 1px solid #ccc; padding-bottom: 2px;">AMOUNT IN WORDS and 00/100 Dollars ****</div></div>');
                  L.push('<div class="check-field" style="top: calc(2.65in + ' + vOff + 'in); left: calc(0.75in + ' + hOff + 'in);"><div class="label">MEMO</div><div style="font-size:11px; border-bottom: 1px solid #ccc; padding-bottom: 2px;">Pay period MM/DD/YYYY - MM/DD/YYYY</div></div>');
                  L.push('</div>');
                  L.push('<div class="stub-area">');
                  L.push('<div style="text-align:center; font-size:14px; font-weight:bold; margin-bottom:4px;">SALON NAME</div>');
                  L.push('<div style="text-align:center; font-size:10px; margin-bottom:4px;">EARNINGS STATEMENT</div>');
                  L.push('<div style="text-align:center; font-size:10px; margin-bottom:8px;">Employee Name · Pay Type</div>');
                  L.push('<div style="border-top: 2px solid #ccc; margin: 6px 0;"></div>');
                  L.push('<div style="font-weight:bold; font-size:10px; padding: 3px 0; border-bottom: 1px solid #ccc;">DATE ··· SVCS ··· SALES ··· TIPS ··· TOTAL</div>');
                  L.push('<div style="padding: 3px 0;">Mon 3/7 ··· 4 ··· $320.00 ··· $45.00 ··· $365.00</div>');
                  L.push('<div style="padding: 3px 0;">Tue 3/8 ··· 3 ··· $280.00 ··· $35.00 ··· $315.00</div>');
                  L.push('<div style="border-top: 2px solid #ccc; margin: 6px 0;"></div>');
                  L.push('<div style="font-size:13px; font-weight:bold; display:flex; justify-content:space-between;"><span>TOTAL EARNINGS</span><span>$0,000.00</span></div>');
                  L.push('</div>');
                  L.push('</div>');
                  L.push('</body></html>');
                  var w = window.open('', '_blank');
                  w.document.write(L.join('\n'));
                  w.document.close();
                  w.focus();
                  w.print();
                }}
                style={{ padding: '10px 20px', background: T.primary, color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', userSelect: 'none' }}
                onMouseEnter={function(e) { e.currentTarget.style.background = '#1D4FD7'; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = T.primary; }}
              >🖨️ Print Test Page</div>
              <div style={{ fontSize: 12, color: T.textMuted, display: 'flex', alignItems: 'center' }}>Print on plain paper, hold against a real check to verify alignment</div>
            </div>
          </AccSection>
          <AccSection id="security" title="Security & Clearance" {...accProps}>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 12 }}>Actions set to ON require a staff PIN before they can be performed.</div>
            {(function() {
              var cats = {};
              var catOrder = [];
              Object.keys(ACTIONS).forEach(function(k) {
                var key = ACTIONS[k];
                var meta = ACTION_META[key] || {};
                var cat = meta.category || 'Other';
                if (!cats[cat]) { cats[cat] = []; catOrder.push(cat); }
                cats[cat].push({ key: key, label: meta.label || key });
              });
              var cr = (settings.clearance_required || {});
              var leftCats = ['Checkout', 'Admin'].filter(function(c) { return !!cats[c]; });
              var rightCats = catOrder.filter(function(c) { return leftCats.indexOf(c) === -1; });
              function renderCats(list) {
                return list.map(function(cat) {
                  return (
                    <div key={cat} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.primary, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, paddingBottom: 4, borderBottom: '1px solid ' + T.borderLight }}>{cat}</div>
                      {cats[cat].map(function(a) {
                        return (
                          <div key={a.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid ' + T.borderLight }}>
                            <span style={{ fontSize: 13, color: T.text }}>{a.label}</span>
                            <Toggle value={!!cr[a.key]} onChange={function(v) { var next = Object.assign({}, cr); next[a.key] = v; set('clearance_required', next); }} T={T} />
                          </div>
                        );
                      })}
                    </div>
                  );
                });
              }
              return (
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>{renderCats(leftCats)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>{renderCats(rightCats)}</div>
                </div>
              );
            })()}
          </AccSection>
          <AccSection id="station" title="Station Setup" {...accProps}>
            {/* Station pairing info */}
            {getPairedSalonCode() && (
              <div style={{ background: T.chrome, borderRadius: 8, padding: '12px 16px', marginBottom: 16, border: '1px solid ' + T.borderLight }}>
                <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 6, fontWeight: 600 }}>Connected Salon</div>
                <div style={{ fontSize: 14, color: T.text, fontWeight: 500 }}>{getPairedSalonName() || 'Unknown'}</div>
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>Code: <span style={{ fontFamily: 'monospace' }}>{getPairedSalonCode()}</span></div>
                <div
                  onClick={function() { toast.confirm('Unpair this station? The app will restart and ask for a salon code.', function() { unpairStation(); window.location.reload(); }); }}
                  style={{ marginTop: 10, padding: '6px 14px', background: 'transparent', border: '1px solid #EF4444', borderRadius: 6, fontSize: 12, color: '#EF4444', cursor: 'pointer', display: 'inline-block', fontWeight: 500 }}
                  onMouseEnter={function(e) { e.currentTarget.style.background = '#7F1D1D'; }}
                  onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}
                >Unpair Station</div>
              </div>
            )}
            <FieldRow label="Start page" desc="What screen this station shows when the app opens" T={T}>
              <Select value={settings.station_start_page || 'calendar'} options={[{value:'calendar',label:'Calendar'},{value:'tech-select',label:'Employee Select (avatar grid)'},{value:'tech-pin',label:'Tech PIN Entry'},{value:'checkout',label:'Checkout'}]} onChange={function(v) { set('station_start_page', v); }} T={T} />
            </FieldRow>
            <FieldRow label="Tech identification method" desc="How techs identify themselves on the station screen" T={T}>
              <Select value={settings.station_id_method || 'avatar'} options={[{value:'avatar',label:'Avatar Grid (tap face)'},{value:'pin',label:'PIN Entry (enter code)'}]} onChange={function(v) { set('station_id_method', v); }} T={T} />
            </FieldRow>
            <FieldRow label="After identification" desc="Where tech goes after tapping their avatar or entering PIN" T={T}>
              <Select value={settings.station_mode || 'checkout'} options={[{value:'checkout',label:'Go to Checkout (start sale)'},{value:'calendar',label:'Go to Calendar (view schedule)'}]} onChange={function(v) { set('station_mode', v); }} T={T} />
            </FieldRow>
            <FieldRow label="Can process payments" desc="When OFF, tech can build tickets but only Print & Hold — no payment buttons" T={T}>
              <Toggle value={settings.station_can_process_payments !== false} onChange={function(v) { set('station_can_process_payments', v); }} T={T} />
            </FieldRow>
            <FieldRow label="Primary printer" desc="This station's dedicated receipt printer. Failover kicks in automatically if offline." T={T}>
              <Select value={settings.station_primary_printer || ''} options={[{value:'',label:'— None —'}].concat(printers.map(function(p) { return { value: p.id, label: (p.name || p.ip) + (p.status === 'offline' ? ' ⚠️' : '') }; }))} onChange={function(v) { set('station_primary_printer', v); }} T={T} />
            </FieldRow>
            {settings.station_primary_printer && (
              <FieldRow label="Failover printer" desc="Used automatically if the primary printer goes offline" T={T}>
                <Select value={settings.station_failover_printer || ''} options={[{value:'',label:'— None —'}].concat(printers.filter(function(p) { return p.id !== settings.station_primary_printer; }).map(function(p) { return { value: p.id, label: (p.name || p.ip) + (p.status === 'offline' ? ' ⚠️' : '') }; }))} onChange={function(v) { set('station_failover_printer', v); }} T={T} />
              </FieldRow>
            )}
            <div style={{ fontSize: 12, color: T.textMuted, padding: '12px 0 0', lineHeight: 1.6 }}>
              <div style={{ fontWeight: 600, color: T.textSecondary, marginBottom: 4 }}>Common setups:</div>
              <div>• Front desk — Avatar, Calendar, Payments ON</div>
              <div>• Tech station — Avatar, Checkout, Payments OFF (print & hold)</div>
              <div>• Secure station — PIN, Checkout, Payments ON</div>
            </div>
          </AccSection>
          <AccSection id="advcomm" title="Advanced Commission Setup" {...accProps}>
            <FieldRow label="Enable advanced commission" desc="When ON, staff Pay tab shows per-category commission rates. When OFF, only flat commission % is available." T={T}>
              <Toggle value={!!settings.advanced_commission_enabled} onChange={function(v) { set('advanced_commission_enabled', v); }} T={T} />
            </FieldRow>
            {settings.advanced_commission_enabled && (
              <div style={{ fontSize: 12, color: T.textMuted, padding: '8px 0 0', lineHeight: 1.6 }}>
                With advanced commission ON, each tech's Pay tab will show your service categories with individual commission % fields. Any category left blank will use the tech's flat rate as the default.
              </div>
            )}
          </AccSection>
          <AccSection id="importexport" title="Import / Export Salon Data" {...accProps}>
            <DataImportExport />
          </AccSection>
          <AccSection id="debug" title="Debug Tools" {...accProps}>
            <DebugToggleSection T={T} />
          </AccSection>
        </div>
      </div>
    </div>
  );
}
