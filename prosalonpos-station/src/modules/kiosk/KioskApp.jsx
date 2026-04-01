import { useState, useEffect, useMemo } from 'react';
// TODO Phase 2: Kiosk reads from API — mock data removed Session 88
var KIOSK_CLIENTS = [];
var KIOSK_APPOINTMENTS = [];
var KIOSK_TECHS = [];
var KIOSK_CATEGORIES = [];
import { useSettingsStore } from '../../lib/stores/settingsStore';
import { useClientStore } from '../../lib/stores/clientStore';
import { useStaffStore } from '../../lib/stores/staffStore';
import { useServiceStore } from '../../lib/stores/serviceStore';
import { useAppointmentStore } from '../../lib/stores/appointmentStore';
import { isProduction, getPairedSalonName } from '../../lib/apiClient';
import DebugLabel from '../../components/debug/DebugLabel';

/**
 * Kiosk — Client Self-Check-In
 * Module 14: Runs on tablet at the front door
 *
 * Flow:
 *   1. Welcome → "Check In" button
 *   2. Phone entry (numpad)
 *   3a. Has appointment today → confirm → done
 *   3b. No appointment → popup: "Preferred tech" or "First available"
 *       → If preferred: tech grid (circles, 4 across)
 *       → Service selection (scrollable list by category)
 *       → Done (added to waitlist)
 *   4. "Please have a seat" → auto-reset
 *
 * Rules:
 *   - Salon branded, NOT ProSalonPOS branded
 *   - Light theme (client-facing)
 *   - Big touch-friendly buttons
 *   - No prices shown
 *   - Auto-timeout back to welcome
 */

var _SALON_DEFAULTS = { tagline: 'Welcome', brandColor: '#8B5CF6' };
var BC = _SALON_DEFAULTS.brandColor;

var S = {
  bg: '#F8FAFC', white: '#FFFFFF',
  textPrimary: '#1E293B', textSecondary: '#64748B', textMuted: '#94A3B8',
  border: '#E2E8F0', borderLight: '#F1F5F9',
  brand: BC, brandLight: BC + '15', brandSoft: BC + '08',
  success: '#059669', successLight: '#D1FAE5',
  danger: '#DC2626',
};

var TECH_COLORS = ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#06B6D4', '#84CC16'];

function formatPhone(digits) {
  if (!digits) return '';
  if (digits.length <= 3) return '(' + digits;
  if (digits.length <= 6) return '(' + digits.slice(0, 3) + ') ' + digits.slice(3);
  return '(' + digits.slice(0, 3) + ') ' + digits.slice(3, 6) + '-' + digits.slice(6, 10);
}

export default function KioskApp() {
  var _isProd = isProduction();
  var salonSettings = useSettingsStore(function(s) { return s.settings; });
  var salonName = (salonSettings && salonSettings.salon_name) || getPairedSalonName() || 'Your Salon';

  // Store reads for production
  var storeClients = useClientStore(function(s) { return s.clients; });
  var storeStaff = useStaffStore(function(s) { return s.staff; });
  var storeServices = useServiceStore(function(s) { return s.services; });
  var storeCategories = useServiceStore(function(s) { return s.categories; });
  var storeAppointments = useAppointmentStore(function(s) { return s.serviceLines; });

  // Build kiosk data from stores or mock
  var kioskClients = useMemo(function() {
    if (!_isProd) return KIOSK_CLIENTS;
    return storeClients.map(function(c) {
      return { id: c.id, first_name: c.first_name, last_name: c.last_name, phone: (c.phone || '').replace(/\D/g, '') };
    });
  }, [_isProd, storeClients]);

  var kioskTechs = useMemo(function() {
    if (!_isProd) return KIOSK_TECHS;
    return storeStaff.filter(function(s) { return s.active && s.role === 'technician'; }).map(function(s) {
      return { id: s.id, name: s.display_name };
    });
  }, [_isProd, storeStaff]);

  var kioskCategories = useMemo(function() {
    if (!_isProd) return KIOSK_CATEGORIES;
    var activeCats = storeCategories.filter(function(c) { return c.active; });
    return activeCats.map(function(cat) {
      var svcs = storeServices.filter(function(s) { return s.active && (s.category_ids || []).includes(cat.id); });
      return { name: cat.name, services: svcs.map(function(s) { return { id: s.id, name: s.name }; }) };
    }).filter(function(cat) { return cat.services.length > 0; });
  }, [_isProd, storeCategories, storeServices]);

  var kioskAppointments = useMemo(function() {
    if (!_isProd) return KIOSK_APPOINTMENTS;
    // Build today's appointments from appointmentStore service lines
    var today = new Date();
    var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    return (storeAppointments || []).filter(function(sl) {
      if (!sl.starts_at) return false;
      var slDate = new Date(sl.starts_at);
      var slStr = slDate.getFullYear() + '-' + String(slDate.getMonth() + 1).padStart(2, '0') + '-' + String(slDate.getDate()).padStart(2, '0');
      return slStr === todayStr;
    }).map(function(sl) {
      var staff = storeStaff.find(function(s) { return s.id === sl.staff_id; });
      var client = storeClients.find(function(c) { return c.id === sl.client_id; });
      var clientPhone = client ? (client.phone || '').replace(/\D/g, '') : '';
      var clientName = client ? (client.first_name + ' ' + client.last_name) : (sl.client || '');
      var timeStr = '';
      if (sl.starts_at) {
        var d = new Date(sl.starts_at);
        var h = d.getHours(); var ampm = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
        var min = d.getMinutes();
        timeStr = h + ':' + (min < 10 ? '0' : '') + min + ' ' + ampm;
      }
      return { id: sl.id, client_phone: clientPhone, client_name: clientName, service: sl.service || '', tech: staff ? staff.display_name : '', time: timeStr };
    });
  }, [_isProd, storeAppointments, storeStaff, storeClients]);
  var [step, setStep] = useState('welcome');
  // welcome | phone | confirm | techChoice | techGrid | services | done

  var [phone, setPhone] = useState('');
  var [clientName, setClientName] = useState('');
  var [isNewClient, setIsNewClient] = useState(false);
  var [newFirst, setNewFirst] = useState('');
  var [newLast, setNewLast] = useState('');
  var [appointments, setAppointments] = useState([]);
  var [selectedTech, setSelectedTech] = useState(null);
  var [selectedServices, setSelectedServices] = useState([]);

  // Auto-reset from done screen
  useEffect(function() {
    if (step === 'done') {
      var timer = setTimeout(function() { resetAll(); }, 5000);
      return function() { clearTimeout(timer); };
    }
  }, [step]);

  function resetAll() {
    setStep('welcome');
    setPhone('');
    setClientName('');
    setIsNewClient(false);
    setNewFirst('');
    setNewLast('');
    setAppointments([]);
    setSelectedTech(null);
    setSelectedServices([]);
  }

  // Phone numpad handler — auto-advance on 10th digit
  function handlePhoneKey(key) {
    if (key === '⌫') { setPhone(function(p) { return p.slice(0, -1); }); return; }
    if (key === 'C') { setPhone(''); return; }
    if (/\d/.test(key) && phone.length < 10) {
      var newPhone = phone + key;
      setPhone(newPhone);
      if (newPhone.length === 10) {
        // Auto-lookup after a tiny delay so the display updates first
        setTimeout(function() { lookupWithPhone(newPhone); }, 300);
      }
    }
  }

  // Look up phone (accepts phone string directly for auto-advance)
  function lookupWithPhone(ph) {
    var digits = ph || phone;
    if (digits.length < 10) return;
    var client = kioskClients.find(function(c) { return c.phone === digits; });
    if (client) {
      setClientName(client.first_name + ' ' + client.last_name);
      var todayAppts = kioskAppointments.filter(function(a) { return a.client_phone === digits; });
      if (todayAppts.length > 0) {
        setAppointments(todayAppts);
        setStep('confirm');
      } else {
        setStep('techChoice');
      }
    } else {
      setIsNewClient(true);
    }
  }
  function lookupPhone() { lookupWithPhone(phone); }

  // New client submit
  function submitNewClient() {
    if (!newFirst.trim()) return;
    setClientName(newFirst.trim() + (newLast.trim() ? ' ' + newLast.trim() : ''));
    setIsNewClient(false);
    setStep('techChoice');
  }

  // ══════════════════════════════════
  // SHARED STYLES
  // ══════════════════════════════════
  var pageStyle = {
    width: '100%', height: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: S.bg, fontFamily: "'Inter',system-ui,sans-serif",
  };

  var cardStyle = {
    background: S.white, borderRadius: 24, padding: '40px 48px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)', maxWidth: 500, width: '90%',
    textAlign: 'center',
  };

  var bigBtn = {
    width: '100%', height: 56, borderRadius: 12, border: 'none',
    fontSize: 18, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
    transition: 'transform 100ms, box-shadow 100ms',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  // ══════════════════════════════════
  // 1. WELCOME
  // ══════════════════════════════════
  if (step === 'welcome') {
    return (
      <div style={Object.assign({}, pageStyle, { position: 'relative' })}>
        <DebugLabel id="SCREEN-KIOSK" />
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: S.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 32, color: '#fff' }}>✦</div>
          <div style={{ fontSize: 28, fontWeight: 600, color: S.textPrimary, marginBottom: 8 }}>{salonName}</div>
          <div style={{ fontSize: 16, color: S.textSecondary, marginBottom: 40 }}>{_SALON_DEFAULTS.tagline}</div>
          <div onClick={function() { setStep('phone'); }}
            style={{ ...bigBtn, background: S.brand, color: '#fff', width: 260, margin: '0 auto' }}
            onMouseDown={function(e) { e.currentTarget.style.transform = 'scale(0.97)'; }}
            onMouseUp={function(e) { e.currentTarget.style.transform = 'scale(1)'; }}>
            Check In
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════
  // 2. PHONE ENTRY
  // ══════════════════════════════════
  if (step === 'phone') {
    var numKeys = ['1','2','3','4','5','6','7','8','9','C','0','⌫'];
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 20, fontWeight: 600, color: S.textPrimary, marginBottom: 8 }}>Enter Your Phone Number</div>
          <div style={{ fontSize: 14, color: S.textSecondary, marginBottom: 24 }}>We'll look up your appointment</div>

          {/* Phone display */}
          <div style={{ height: 56, background: S.borderLight, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, border: '2px solid ' + (phone.length === 10 ? S.brand : S.border) }}>
            <span style={{ fontSize: 28, fontWeight: 600, color: phone ? S.textPrimary : S.textMuted, letterSpacing: 1, fontVariantNumeric: 'tabular-nums' }}>
              {phone ? formatPhone(phone) : '(___) ___-____'}
            </span>
          </div>

          {/* Numpad */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, maxWidth: 320, margin: '0 auto 24px' }}>
            {numKeys.map(function(key) {
              var isAction = key === '⌫' || key === 'C';
              return (
                <div key={key} onClick={function() { handlePhoneKey(key); }}
                  style={{
                    height: 56, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: isAction ? 16 : 22, fontWeight: 600, cursor: 'pointer', userSelect: 'none',
                    background: isAction ? S.borderLight : S.white,
                    color: key === '⌫' ? S.danger : (key === 'C' ? S.textMuted : S.textPrimary),
                    border: '1px solid ' + S.border, transition: 'background 100ms',
                  }}
                  onMouseDown={function(e) { e.currentTarget.style.background = S.brand + '15'; }}
                  onMouseUp={function(e) { e.currentTarget.style.background = isAction ? S.borderLight : S.white; }}>
                  {key}
                </div>
              );
            })}
          </div>

          {/* Continue button */}
          <div onClick={lookupPhone}
            style={{ ...bigBtn, background: phone.length === 10 ? S.brand : S.border, color: phone.length === 10 ? '#fff' : S.textMuted, cursor: phone.length === 10 ? 'pointer' : 'default' }}>
            Continue
          </div>

          {/* New client form overlay */}
          {isNewClient && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
              <div style={{ background: S.white, borderRadius: 24, padding: '40px 48px', maxWidth: 420, width: '90%', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 600, color: S.textPrimary, marginBottom: 8 }}>Welcome!</div>
                <div style={{ fontSize: 14, color: S.textSecondary, marginBottom: 24 }}>We don't have you on file yet. Please enter your name.</div>
                <input value={newFirst} onChange={function(e) { setNewFirst(e.target.value); }} placeholder="First name"
                  autoFocus
                  style={{ width: '100%', height: 52, borderRadius: 12, border: '1px solid ' + S.border, padding: '0 16px', fontSize: 16, fontFamily: 'inherit', marginBottom: 12, boxSizing: 'border-box', outline: 'none', color: S.textPrimary, background: S.white }} />
                <input value={newLast} onChange={function(e) { setNewLast(e.target.value); }} placeholder="Last name (optional)"
                  style={{ width: '100%', height: 52, borderRadius: 12, border: '1px solid ' + S.border, padding: '0 16px', fontSize: 16, fontFamily: 'inherit', marginBottom: 24, boxSizing: 'border-box', outline: 'none', color: S.textPrimary, background: S.white }} />
                <div onClick={submitNewClient}
                  style={{ ...bigBtn, background: newFirst.trim() ? S.brand : S.border, color: newFirst.trim() ? '#fff' : S.textMuted, cursor: newFirst.trim() ? 'pointer' : 'default' }}>
                  Continue
                </div>
                <div onClick={function() { setIsNewClient(false); setNewFirst(''); setNewLast(''); setPhone(''); }}
                  style={{ marginTop: 16, fontSize: 14, color: S.textMuted, cursor: 'pointer' }}>Wrong number? Start over</div>
              </div>
            </div>
          )}

          {/* Back */}
          <div onClick={resetAll} style={{ marginTop: 16, fontSize: 14, color: S.textMuted, cursor: 'pointer' }}>← Back</div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════
  // 3a. CONFIRM APPOINTMENT
  // ══════════════════════════════════
  if (step === 'confirm') {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: S.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 24, color: '#fff' }}>
            {clientName.charAt(0)}
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, color: S.textPrimary, marginBottom: 4 }}>Hi, {clientName.split(' ')[0]}!</div>
          <div style={{ fontSize: 14, color: S.textSecondary, marginBottom: 28 }}>We found your appointment</div>

          {appointments.map(function(apt) {
            return (
              <div key={apt.id} style={{ background: S.brandSoft, borderRadius: 16, padding: '20px 24px', marginBottom: 12, border: '1px solid ' + S.brand + '30', textAlign: 'left' }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: S.textPrimary }}>{apt.service}</div>
                <div style={{ fontSize: 14, color: S.textSecondary, marginTop: 6 }}>with {apt.tech} · {apt.time}</div>
              </div>
            );
          })}

          <div onClick={function() { setStep('done'); }}
            style={{ ...bigBtn, background: S.success, color: '#fff', marginTop: 20 }}>
            Check In
          </div>

          {/* Not me */}
          <div onClick={resetAll} style={{ marginTop: 16, fontSize: 14, color: S.textMuted, cursor: 'pointer' }}>That's not me — start over</div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════
  // 3b. TECH CHOICE POPUP
  // ══════════════════════════════════
  if (step === 'techChoice') {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ fontSize: 22, fontWeight: 600, color: S.textPrimary, marginBottom: 8 }}>Hi, {clientName.split(' ')[0]}!</div>
          <div style={{ fontSize: 14, color: S.textSecondary, marginBottom: 32 }}>How would you like to be seen today?</div>

          <div onClick={function() { setStep('techGrid'); }}
            style={{ ...bigBtn, background: S.white, color: S.textPrimary, border: '2px solid ' + S.brand, marginBottom: 12 }}
            onMouseDown={function(e) { e.currentTarget.style.background = S.brandLight; }}
            onMouseUp={function(e) { e.currentTarget.style.background = S.white; }}>
            Select Your Preferred Technician
          </div>

          <div onClick={function() { setSelectedTech({ id: 'first', name: 'First Available' }); setStep('services'); }}
            style={{ ...bigBtn, background: S.brand, color: '#fff' }}
            onMouseDown={function(e) { e.currentTarget.style.transform = 'scale(0.97)'; }}
            onMouseUp={function(e) { e.currentTarget.style.transform = 'scale(1)'; }}>
            First Available
          </div>

          <div onClick={resetAll} style={{ marginTop: 20, fontSize: 14, color: S.textMuted, cursor: 'pointer' }}>← Start over</div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════
  // 4. TECH GRID
  // ══════════════════════════════════
  if (step === 'techGrid') {
    return (
      <div style={pageStyle}>
        <div style={{ fontSize: 22, fontWeight: 600, color: S.textPrimary, marginBottom: 8 }}>Select Your Technician</div>
        <div style={{ fontSize: 14, color: S.textSecondary, marginBottom: 32 }}>Tap to choose</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, maxWidth: 520, width: '90%' }}>
          {kioskTechs.map(function(tech, i) {
            return (
              <div key={tech.id} onClick={function() { setSelectedTech(tech); setStep('services'); }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, cursor: 'pointer', padding: 16, borderRadius: 16, transition: 'background 150ms' }}
                onMouseDown={function(e) { e.currentTarget.style.background = S.brandLight; }}
                onMouseUp={function(e) { e.currentTarget.style.background = 'transparent'; }}
                onMouseLeave={function(e) { e.currentTarget.style.background = 'transparent'; }}>
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: TECH_COLORS[i % TECH_COLORS.length],
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28, fontWeight: 600, color: '#fff',
                  boxShadow: '0 4px 12px ' + TECH_COLORS[i % TECH_COLORS.length] + '40',
                }}>
                  {tech.name.charAt(0)}
                </div>
                <div style={{ fontSize: 15, fontWeight: 500, color: S.textPrimary }}>{tech.name}</div>
              </div>
            );
          })}
        </div>

        <div onClick={function() { setStep('techChoice'); }} style={{ marginTop: 32, fontSize: 14, color: S.textMuted, cursor: 'pointer' }}>← Back</div>
      </div>
    );
  }

  // ══════════════════════════════════
  // 5. SERVICE SELECTION (multi-select with checkboxes)
  // ══════════════════════════════════
  if (step === 'services') {
    function toggleService(svc) {
      setSelectedServices(function(prev) {
        var exists = prev.find(function(s) { return s.id === svc.id; });
        if (exists) return prev.filter(function(s) { return s.id !== svc.id; });
        return prev.concat([svc]);
      });
    }

    return (
      <div style={{ ...pageStyle, justifyContent: 'flex-start', paddingTop: 40, paddingBottom: 0 }}>
        <div style={{ fontSize: 22, fontWeight: 600, color: S.textPrimary, marginBottom: 4 }}>What service are you here for?</div>
        <div style={{ fontSize: 14, color: S.textSecondary, marginBottom: 20 }}>
          {selectedTech && selectedTech.id !== 'first' ? 'with ' + selectedTech.name : 'First available technician'}
          {selectedServices.length > 0 && <span style={{ color: S.brand, marginLeft: 8 }}>· {selectedServices.length} selected</span>}
        </div>

        {/* Scrollable service list */}
        <div style={{ background: S.white, borderRadius: 24, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', maxWidth: 520, width: '90%', overflow: 'auto', flex: 1, marginBottom: 16 }}>
          {kioskCategories.map(function(cat, ci) {
            return (
              <div key={cat.name}>
                {/* Category header */}
                <div style={{ padding: '14px 28px', fontSize: 14, fontWeight: 700, color: S.white, textTransform: 'uppercase', letterSpacing: '0.05em', background: S.brand, borderTop: ci > 0 ? '2px solid ' + S.white : 'none' }}>
                  {cat.name}
                </div>

                {/* Services with checkboxes */}
                {cat.services.map(function(svc) {
                  var isChecked = !!selectedServices.find(function(s) { return s.id === svc.id; });
                  return (
                    <div key={svc.id} onClick={function() { toggleService(svc); }}
                      style={{ display: 'flex', alignItems: 'center', padding: '14px 28px', cursor: 'pointer', transition: 'background 100ms', borderBottom: '1px solid ' + S.borderLight, background: isChecked ? S.brandLight : S.white }}
                      onMouseEnter={function(e) { if (!isChecked) e.currentTarget.style.background = S.borderLight; }}
                      onMouseLeave={function(e) { e.currentTarget.style.background = isChecked ? S.brandLight : S.white; }}>
                      <div style={{ flex: 1, fontSize: 16, fontWeight: 500, color: S.textPrimary }}>{svc.name}</div>
                      {/* Checkbox */}
                      <div style={{
                        width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                        border: isChecked ? '2px solid ' + S.brand : '2px solid ' + S.border,
                        background: isChecked ? S.brand : S.white,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 150ms',
                      }}>
                        {isChecked && <span style={{ color: '#fff', fontSize: 16, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Done button — always visible at bottom */}
        <div style={{ maxWidth: 520, width: '90%', flexShrink: 0, paddingBottom: 20, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div onClick={function() { if (selectedServices.length > 0) setStep('done'); }}
            style={{ ...bigBtn, background: selectedServices.length > 0 ? S.brand : S.border, color: selectedServices.length > 0 ? '#fff' : S.textMuted, cursor: selectedServices.length > 0 ? 'pointer' : 'default', textAlign: 'center' }}>
            {selectedServices.length > 0 ? 'Done (' + selectedServices.length + ' service' + (selectedServices.length > 1 ? 's' : '') + ')' : 'Select at least one service'}
          </div>
          <div onClick={function() { setStep(selectedTech && selectedTech.id !== 'first' ? 'techGrid' : 'techChoice'); }}
            style={{ marginTop: 12, fontSize: 14, color: S.textMuted, cursor: 'pointer', textAlign: 'center' }}>← Back</div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════
  // 6. DONE
  // ══════════════════════════════════
  if (step === 'done') {
    var isWalkin = appointments.length === 0;
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: S.successLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <span style={{ fontSize: 36, color: S.success }}>✓</span>
          </div>
          <div style={{ fontSize: 24, fontWeight: 600, color: S.textPrimary, marginBottom: 8 }}>
            {isWalkin ? "You're on the list!" : "You're checked in!"}
          </div>
          <div style={{ fontSize: 16, color: S.textSecondary, marginBottom: 8 }}>
            {clientName.split(' ')[0]}, please have a seat.
          </div>
          {isWalkin && selectedServices.length > 0 && (
            <div style={{ fontSize: 14, color: S.textMuted, marginTop: 4 }}>
              {selectedServices.map(function(s) { return s.name; }).join(', ')}
              {selectedTech && selectedTech.id !== 'first' ? ' with ' + selectedTech.name : ' · First available'}
            </div>
          )}
          {!isWalkin && appointments[0] && (
            <div style={{ fontSize: 14, color: S.textMuted, marginTop: 4 }}>
              {appointments[0].service} with {appointments[0].tech} · {appointments[0].time}
            </div>
          )}
          <div style={{ fontSize: 12, color: S.textMuted, marginTop: 24 }}>This screen will reset automatically</div>
        </div>
      </div>
    );
  }

  return null;
}
