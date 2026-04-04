/**
 * Pro Salon POS — Online Booking Portal (Session 20 Final)
 * Session 5 Decisions #112–#139
 *
 * Flow: mode → techAsk → [techPick] → services → [groupHub] → datetime → identify → deposit → confirm
 * Client identification moved to AFTER date/time so clients don't waste time entering info
 * if no availability fits them.
 */
import { useState, useMemo, useRef, useEffect } from 'react';
import { phoneToDigits } from '../../lib/formatUtils';
import { useStaffStore } from '../../lib/stores/staffStore';
import { useServiceStore } from '../../lib/stores/serviceStore';
import { useClientStore } from '../../lib/stores/clientStore';
import { useSettingsStore } from '../../lib/stores/settingsStore';
import { buildDateList, getAvailableSlots } from './bookingAvailability';
import BookingLaterSteps from './BookingLaterSteps';
import AreaTag from '../../components/ui/AreaTag';

var _SALON_DEFAULTS = { logo: '✦', brandColor: '#8B5CF6' };
var BC = _SALON_DEFAULTS.brandColor;
var MAX_GROUP = 4;

var S = {
  bg: '#F8FAFC', white: '#FFFFFF',
  text: '#1E293B', textSoft: '#475569', textFaint: '#94A3B8',
  border: '#E2E8F0', borderLight: '#F1F5F9',
  brand: BC, brandLight: BC + '18', brandMid: BC + '30', brandSoft: BC + '0A',
  success: '#059669', successLight: '#ECFDF5', danger: '#DC2626',
};
var F = "'Inter', system-ui, -apple-system, sans-serif";

function formatPhone(d) {
  if (!d) return '';
  if (d.length <= 3) return '(' + d;
  if (d.length <= 6) return '(' + d.slice(0, 3) + ') ' + d.slice(3);
  return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6, 10);
}
function getInitials(name) {
  return (name || '').split(' ').filter(function (w) { return w; }).map(function (w) { return w[0]; }).join('').toUpperCase().slice(0, 2);
}


function Header() {
  return (
    <div style={{ textAlign: 'center', padding: '28px 20px 20px', borderBottom: '1px solid ' + S.borderLight, background: S.white }}>
      <div style={{ fontSize: 36, color: S.brand, marginBottom: 6 }}>{_SALON_DEFAULTS.logo}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: S.text, letterSpacing: '-0.01em' }}>{_salonName}</div>
    </div>
  );
}
function StepDots({ current, total }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '20px 0 8px' }}>
      {Array.from({ length: total }).map(function (_, i) {
        return <div key={i} style={{ width: i === current ? 28 : 10, height: 10, borderRadius: 5, background: i === current ? S.brand : i < current ? S.brand + '80' : S.border, transition: 'all 250ms ease' }} />;
      })}
    </div>
  );
}
function PrimaryBtn({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%', height: 54, background: disabled ? S.textFaint : S.brand,
      color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: F,
      opacity: disabled ? 0.5 : 1, transition: 'all 150ms',
    }}>{children}</button>
  );
}
function BackLink({ onClick, label }) {
  return (
    <div style={{ textAlign: 'center', marginTop: 16, paddingBottom: 32 }}>
      <button onClick={onClick} style={{ background: 'none', border: 'none', color: S.textSoft, fontSize: 14, cursor: 'pointer', fontFamily: F, fontWeight: 500 }}>
        ← {label || 'Back'}
      </button>
    </div>
  );
}
function Av({ name, size }) {
  var sz = size || 44;
  return (
    <div style={{ width: sz, height: sz, borderRadius: '50%', background: S.brandLight, display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.brand, fontSize: sz < 36 ? 12 : 15, fontWeight: 600, flexShrink: 0 }}>
      {getInitials(name)}
    </div>
  );
}

export default function OnlineBookingPortal({ salonSettings: _ss }) {
  // ── Store reads (Phase 2: stores switch to API; zero component changes needed) ──
  var MOCK_STAFF = useStaffStore(function(s) { return s.staff; });
  var MOCK_SERVICES = useServiceStore(function(s) { return s.services; });
  var MOCK_CATEGORIES = useServiceStore(function(s) { return s.categories; });
  var MOCK_CLIENTS = useClientStore(function(s) { return s.clients; });
  var MOCK_SALON_SETTINGS = useSettingsStore(function(s) { return s.settings; });

  var ss = _ss || MOCK_SALON_SETTINGS;
  var _salonName = (ss && ss.salon_name) || 'Your Salon';

  // ── Online-filtered data (memoized so they recompute if store changes) ──
  var onlineServices = useMemo(function () {
    return MOCK_SERVICES.filter(function (s) { return s.active && s.online_booking_enabled; });
  }, [MOCK_SERVICES]);
  var onlineCategories = useMemo(function () {
    return MOCK_CATEGORIES.filter(function (cat) {
      return cat.active && onlineServices.some(function (s) { return s.category_ids && s.category_ids.includes(cat.id); });
    });
  }, [MOCK_CATEGORIES, onlineServices]);
  var onlineTechs = useMemo(function () {
    return MOCK_STAFF.filter(function (s) { return s.active && s.tech_turn_eligible; });
  }, [MOCK_STAFF]);

  // Steps: mode → techAsk → techPick → services → [groupHub/groupName] → datetime → identify → deposit → confirm
  var [step, setStep] = useState('mode');
  var [bookingMode, setBookingMode] = useState(null);

  // Tech + services
  var [selectedTech, setSelectedTech] = useState(null);
  var [noTechPreference, setNoTechPreference] = useState(false);
  var [selectedServices, setSelectedServices] = useState([]);
  var [activeCat, setActiveCat] = useState(null);

  // Set initial active category once store data is available
  useEffect(function () {
    if (activeCat === null && onlineCategories.length > 0) {
      setActiveCat(onlineCategories[0].id);
    }
  }, [onlineCategories, activeCat]);

  // Group
  var [groupMembers, setGroupMembers] = useState([]);
  var [groupMemberName, setGroupMemberName] = useState('');

  // Identify (now near end of flow)
  var [phoneDigits, setPhoneDigits] = useState('');
  var [firstName, setFirstName] = useState('');
  var [lastName, setLastName] = useState('');
  var [email, setEmail] = useState('');
  var [matchedClient, setMatchedClient] = useState(null);
  var [matchConfirmed, setMatchConfirmed] = useState(false);

  // Date & Time
  var [selectedDate, setSelectedDate] = useState(null);
  var [selectedSlot, setSelectedSlot] = useState(null);
  var dateStripRef = useRef(null);

  var totalSteps = bookingMode === 'group' ? 6 : 5;
  var wrap = { width: '100%', maxWidth: 500, margin: '0 auto', padding: '0 24px', boxSizing: 'border-box' };
  var page = { minHeight: '100vh', background: S.bg, fontFamily: F };

  var phoneComplete = phoneDigits.length >= 10;
  var foundClient = useMemo(function () {
    if (!phoneComplete) return null;
    return MOCK_CLIENTS.find(function (c) { return phoneToDigits(c.phone) === phoneDigits.slice(0, 10); }) || null;
  }, [phoneDigits, phoneComplete, MOCK_CLIENTS]);
  var canProceedIdentify = matchConfirmed || (phoneComplete && !foundClient && firstName.trim().length > 0);
  var totalDuration = selectedServices.reduce(function (sum, s) { return sum + s.default_duration_minutes; }, 0);

  // Date & time availability (always computed so hooks are stable)
  var dateList = useMemo(function () { return buildDateList(ss); }, [ss]);
  var autoReq2 = autoReq; // already computed above
  var isGroupBooking = bookingMode === 'group' && groupMembers.length > 0;
  var activeDate = selectedDate || (dateList.length > 0 ? dateList[0].date : null);
  var availableSlots = useMemo(function () {
    if (!activeDate) return [];
    if (isGroupBooking) {
      return getAvailableSlots(activeDate, 0, null, false, groupMembers, autoReq, onlineTechs, ss);
    }
    return getAvailableSlots(activeDate, totalDuration, selectedTech ? selectedTech.id : null, noTechPreference, null, autoReq, onlineTechs, ss);
  }, [activeDate, totalDuration, selectedTech, noTechPreference, isGroupBooking, groupMembers, autoReq, ss]);

  // ═══════ STEP 1: MODE ═══════
  if (step === 'mode') {
    return (
      <div style={page}>
        <Header />
        <div style={{ ...wrap, paddingTop: 40 }}>
          <div style={{ textAlign: 'center', color: S.text, fontSize: 16, fontWeight: 500, marginBottom: 32 }}>Book your appointment</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[{ mode: 'single', icon: '👤', title: 'Just me', sub: 'Book for one person' },
              { mode: 'group', icon: '👥', title: 'Group booking', sub: 'Book for 2–' + MAX_GROUP + ' people' }].map(function (opt) {
              return (
                <div key={opt.mode} onClick={function () { setBookingMode(opt.mode); setStep('techAsk'); }}
                  style={{ background: S.white, border: '2px solid ' + S.border, borderRadius: 14, padding: '28px 24px', cursor: 'pointer', textAlign: 'center', transition: 'all 200ms', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                  onMouseEnter={function (e) { e.currentTarget.style.borderColor = S.brand; e.currentTarget.style.boxShadow = '0 4px 12px ' + S.brandMid; }}
                  onMouseLeave={function (e) { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>{opt.icon}</div>
                  <div style={{ color: S.text, fontSize: 18, fontWeight: 600 }}>{opt.title}</div>
                  <div style={{ color: S.textSoft, fontSize: 14, marginTop: 6 }}>{opt.sub}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ═══════ STEP 2a: TECH ASK (yes/no) ═══════
  if (step === 'techAsk') {
    return (
      <div style={page}>
        <Header />
        <StepDots current={0} total={totalSteps} />
        <div style={wrap}>
          <div style={{ color: S.text, fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Do you have a preferred technician?</div>
          <div style={{ color: S.textSoft, fontSize: 14, marginBottom: 28 }}>We'll show available times based on your choice</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div onClick={function () { setSelectedTech(null); setNoTechPreference(true); setStep('services'); }}
              style={{ background: S.white, border: '2px solid ' + S.border, borderRadius: 14, padding: '24px 24px', cursor: 'pointer', textAlign: 'center', transition: 'all 200ms', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
              onMouseEnter={function (e) { e.currentTarget.style.borderColor = S.brand; e.currentTarget.style.boxShadow = '0 4px 12px ' + S.brandMid; }}
              onMouseLeave={function (e) { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🎲</div>
              <div style={{ color: S.text, fontSize: 17, fontWeight: 600 }}>No preference</div>
              <div style={{ color: S.textSoft, fontSize: 13, marginTop: 4 }}>We'll match you with the best available</div>
            </div>
            <div onClick={function () { setNoTechPreference(false); setStep('techPick'); }}
              style={{ background: S.white, border: '2px solid ' + S.border, borderRadius: 14, padding: '24px 24px', cursor: 'pointer', textAlign: 'center', transition: 'all 200ms', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
              onMouseEnter={function (e) { e.currentTarget.style.borderColor = S.brand; e.currentTarget.style.boxShadow = '0 4px 12px ' + S.brandMid; }}
              onMouseLeave={function (e) { e.currentTarget.style.borderColor = S.border; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)'; }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>⭐</div>
              <div style={{ color: S.text, fontSize: 17, fontWeight: 600 }}>Yes, I'd like to choose</div>
              <div style={{ color: S.textSoft, fontSize: 13, marginTop: 4 }}>Select your preferred technician</div>
            </div>
          </div>
          <BackLink onClick={function () { setStep('mode'); }} />
        </div>
      </div>
    );
  }

  // ═══════ STEP 2b: TECH PICK ═══════
  if (step === 'techPick') {
    return (
      <div style={page}>
        <Header />
        <StepDots current={0} total={totalSteps} />
        <div style={wrap}>
          <div style={{ color: S.text, fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Choose your technician</div>
          <div style={{ color: S.textSoft, fontSize: 14, marginBottom: 24 }}>Tap to select</div>
          {onlineTechs.map(function (tech) {
            return (
              <div key={tech.id} onClick={function () { setSelectedTech(tech); setStep('services'); }}
                style={{ background: S.white, border: '2px solid ' + S.border, borderRadius: 12, padding: '16px 20px', marginBottom: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, transition: 'all 200ms', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                onMouseEnter={function (e) { e.currentTarget.style.borderColor = S.brand; }}
                onMouseLeave={function (e) { e.currentTarget.style.borderColor = S.border; }}>
                <Av name={tech.display_name} size={44} />
                <div style={{ color: S.text, fontSize: 16, fontWeight: 500 }}>{tech.display_name}</div>
              </div>
            );
          })}
          <BackLink onClick={function () { setStep('techAsk'); }} />
        </div>
      </div>
    );
  }

  // ═══════ STEP 3: SERVICES ═══════
  if (step === 'services') {
    var catServices = onlineServices.filter(function (s) { return s.category_ids && s.category_ids.includes(activeCat); });
    var techLabel = selectedTech ? 'With ' + selectedTech.display_name : 'Any available technician';

    function handleServicesNext() {
      if (bookingMode === 'group') {
        var memberName;
        if (groupMembers.length === 0) {
          memberName = groupMemberName.trim() || 'You';
        } else {
          memberName = groupMemberName.trim() || 'Guest ' + (groupMembers.length + 1);
        }
        var member = { name: memberName, tech: selectedTech, noPreference: noTechPreference, services: selectedServices.slice() };
        if (groupMembers.length === 0) {
          setGroupMembers([member]);
        } else {
          setGroupMembers(function (prev) { return prev.concat([member]); });
        }
        setStep('groupHub');
      } else {
        setStep('datetime');
      }
    }

    return (
      <div style={page}>
        <Header />
        <StepDots current={1} total={totalSteps} />
        <div style={wrap}>
          <div style={{ color: S.text, fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Select your services</div>
          <div style={{ color: S.textSoft, fontSize: 14, marginBottom: 6 }}>
            {techLabel}
            {selectedServices.length > 0 && <span style={{ color: S.brand, fontWeight: 500 }}> · {selectedServices.length} selected · {totalDuration} min</span>}
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', paddingTop: 10 }}>
            {onlineCategories.map(function (cat) {
              var isAct = activeCat === cat.id;
              return (
                <button key={cat.id} onClick={function () { setActiveCat(cat.id); }}
                  style={{ height: 38, padding: '0 18px', background: isAct ? S.brand : S.white, color: isAct ? '#fff' : S.textSoft, border: '1px solid ' + (isAct ? S.brand : S.border), borderRadius: 20, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: F, transition: 'all 150ms' }}>
                  {cat.name}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {catServices.map(function (svc) {
              var isSel = selectedServices.some(function (s) { return s.id === svc.id; });
              return (
                <div key={svc.id} onClick={function () {
                  if (isSel) setSelectedServices(function (p) { return p.filter(function (s) { return s.id !== svc.id; }); });
                  else setSelectedServices(function (p) { return p.concat([svc]); });
                }}
                  style={{ background: S.white, border: '2px solid ' + (isSel ? S.brand : S.border), borderRadius: 12, padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'all 200ms', boxShadow: isSel ? '0 2px 8px ' + S.brandMid : '0 1px 3px rgba(0,0,0,0.04)' }}
                  onMouseEnter={function (e) { if (!isSel) e.currentTarget.style.borderColor = S.brand + '60'; }}
                  onMouseLeave={function (e) { if (!isSel) e.currentTarget.style.borderColor = S.border; }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 6, height: 36, borderRadius: 3, background: svc.calendar_color, flexShrink: 0 }} />
                    <div>
                      <div style={{ color: S.text, fontSize: 16, fontWeight: 500 }}>{svc.name}</div>
                      <div style={{ color: S.textSoft, fontSize: 13, marginTop: 2 }}>{svc.default_duration_minutes} min</div>
                      {svc.description && <div style={{ color: S.textFaint, fontSize: 12, marginTop: 2 }}>{svc.description}</div>}
                    </div>
                  </div>
                  {isSel && <div style={{ width: 28, height: 28, borderRadius: '50%', background: S.brand, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16, flexShrink: 0 }}>✓</div>}
                </div>
              );
            })}
          </div>

          {selectedServices.length > 0 && (
            <div style={{ marginTop: 20, padding: '14px 16px', background: S.brandSoft, border: '1px solid ' + S.brandMid, borderRadius: 10 }}>
              <div style={{ fontSize: 13, color: S.brand, fontWeight: 600, marginBottom: 8 }}>Your selection ({totalDuration} min total)</div>
              {selectedServices.map(function (svc) {
                return (
                  <div key={svc.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span style={{ color: S.text, fontSize: 13 }}>{svc.name}</span>
                    <span style={{ color: S.textSoft, fontSize: 13 }}>{svc.default_duration_minutes} min</span>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 24 }}>
            <PrimaryBtn onClick={handleServicesNext} disabled={selectedServices.length === 0}>
              {bookingMode === 'group'
                ? (groupMembers.length === 0 ? 'Save my services' : 'Save & continue')
                : 'Select date & time'}
            </PrimaryBtn>
          </div>
          <BackLink onClick={function () { setStep(noTechPreference ? 'techAsk' : 'techPick'); }} />
        </div>
      </div>
    );
  }

  // ═══════ GROUP HUB ═══════
  if (step === 'groupHub') {
    var allMembers = groupMembers;
    var canProceed = allMembers.length >= 2;
    var canAdd = allMembers.length < MAX_GROUP;
    var groupTotalDur = allMembers.reduce(function (sum, m) {
      return sum + (m.services || []).reduce(function (s, svc) { return s + svc.default_duration_minutes; }, 0);
    }, 0);
    return (
      <div style={page}>
        <Header />
        <StepDots current={2} total={totalSteps} />
        <div style={wrap}>
          <div style={{ color: S.text, fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Group members</div>
          <div style={{ color: S.textSoft, fontSize: 14, marginBottom: 24 }}>{allMembers.length} of {MAX_GROUP} people added{allMembers.length > 0 ? ' · ' + groupTotalDur + ' min total' : ''}</div>

          {allMembers.map(function (m, i) {
            var techName = m.tech ? m.tech.display_name : 'Any technician';
            var svcCount = m.services.length;
            var dur = m.services.reduce(function (sum, s) { return sum + s.default_duration_minutes; }, 0);
            return (
              <div key={i} style={{ background: S.white, border: '1px solid ' + S.border, borderRadius: 12, padding: '16px 20px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
                <Av name={m.name || 'Guest'} size={40} />
                <div style={{ flex: 1 }}>
                  <div style={{ color: S.text, fontSize: 15, fontWeight: 600 }}>{i === 0 ? m.name + ' (you)' : m.name}</div>
                  <div style={{ color: S.textSoft, fontSize: 12, marginTop: 2 }}>{techName} · {svcCount} service{svcCount !== 1 ? 's' : ''} · {dur} min</div>
                </div>
                <div onClick={function () {
                  setGroupMembers(function (prev) { return prev.filter(function (_, idx) { return idx !== i; }); });
                }} style={{ width: 28, height: 28, borderRadius: '50%', background: S.danger + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', color: S.danger, fontSize: 16, cursor: 'pointer', flexShrink: 0 }}
                  title="Remove">✕</div>
              </div>
            );
          })}

          {canAdd && (
            <div onClick={function () { setGroupMemberName(''); setStep('groupName'); }}
              style={{ background: S.white, border: '2px dashed ' + S.brand, borderRadius: 12, padding: '18px 20px', marginBottom: 10, cursor: 'pointer', textAlign: 'center', transition: 'all 200ms' }}
              onMouseEnter={function (e) { e.currentTarget.style.background = S.brandSoft; }}
              onMouseLeave={function (e) { e.currentTarget.style.background = S.white; }}>
              <div style={{ color: S.brand, fontSize: 15, fontWeight: 600 }}>+ Add another person</div>
            </div>
          )}

          <div style={{ marginTop: 20 }}>
            <PrimaryBtn onClick={function () { setStep('datetime'); }} disabled={!canProceed}>
              {canProceed ? 'Select date & time for everyone' : 'Add at least 2 people to continue'}
            </PrimaryBtn>
          </div>
          <BackLink onClick={function () { setStep('mode'); setGroupMembers([]); setBookingMode(null); }} label="Start over" />
        </div>
      </div>
    );
  }

  // ═══════ GROUP: NAME FOR NEW MEMBER ═══════
  if (step === 'groupName') {
    return (
      <div style={page}>
        <Header />
        <StepDots current={2} total={totalSteps} />
        <div style={wrap}>
          <div style={{ color: S.text, fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Who's joining?</div>
          <div style={{ color: S.textSoft, fontSize: 14, marginBottom: 24 }}>Person {groupMembers.length + 1} of {MAX_GROUP}</div>

          <label style={{ display: 'block', fontSize: 13, color: S.text, fontWeight: 500, marginBottom: 6 }}>First name</label>
          <input value={groupMemberName} onChange={function (e) { setGroupMemberName(e.target.value); }} placeholder="Their first name" autoFocus
            style={{ width: '100%', height: 48, background: S.white, border: '1px solid ' + S.border, borderRadius: 10, padding: '0 16px', color: S.text, fontSize: 15, fontFamily: F, outline: 'none', boxSizing: 'border-box', marginBottom: 20 }} />

          <PrimaryBtn onClick={function () {
            setSelectedTech(null); setNoTechPreference(false); setSelectedServices([]);
            setActiveCat(onlineCategories.length > 0 ? onlineCategories[0].id : null);
            setStep('techAsk');
          }} disabled={!groupMemberName.trim()}>Continue</PrimaryBtn>

          <BackLink onClick={function () { setStep('groupHub'); }} />
        </div>
      </div>
    );
  }

  // ═══════ STEP 4: DATE & TIME ═══════
  if (step === 'datetime') {
    var stepNum = bookingMode === 'group' ? 3 : 2;

    var dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Group slots into morning / afternoon / evening
    var morning = availableSlots.filter(function (s) { return s.time < 720; }); // before noon
    var afternoon = availableSlots.filter(function (s) { return s.time >= 720 && s.time < 1020; }); // noon to 5pm
    var evening = availableSlots.filter(function (s) { return s.time >= 1020; }); // 5pm+

    return (
      <div style={page}>
        <Header />
        <StepDots current={stepNum} total={totalSteps} />
        <div style={wrap}>
          <div style={{ color: S.text, fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Pick a date & time</div>
          <div style={{ color: S.textSoft, fontSize: 14, marginBottom: 20 }}>
            {isGroupBooking ? 'Choose a time that works for everyone' : (selectedTech ? 'Showing ' + selectedTech.display_name + '\'s availability' : 'Showing all available times')}
          </div>

          {/* ── Date strip ── */}
          <div ref={dateStripRef} style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 16, marginBottom: 8, WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
            {dateList.map(function (d) {
              var isActive = activeDate && d.date.toDateString() === activeDate.toDateString();
              return (
                <div key={d.date.toISOString()} onClick={function () { setSelectedDate(new Date(d.date)); setSelectedSlot(null); }}
                  style={{
                    minWidth: 64, padding: '10px 6px', borderRadius: 12, textAlign: 'center', cursor: 'pointer', flexShrink: 0,
                    background: isActive ? S.brand : S.white, border: '2px solid ' + (isActive ? S.brand : S.border),
                    transition: 'all 150ms',
                  }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: isActive ? '#fff' : S.textFaint, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {d.isToday ? 'Today' : dayNames[d.date.getDay()]}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: isActive ? '#fff' : S.text, margin: '2px 0' }}>{d.date.getDate()}</div>
                  <div style={{ fontSize: 11, color: isActive ? 'rgba(255,255,255,0.8)' : S.textFaint }}>{monthNames[d.date.getMonth()]}</div>
                </div>
              );
            })}
          </div>

          {/* ── Time slots ── */}
          {availableSlots.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>😔</div>
              <div style={{ color: S.text, fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No availability</div>
              <div style={{ color: S.textSoft, fontSize: 14, lineHeight: 1.5 }}>
                {selectedTech ? selectedTech.display_name + ' is fully booked on this day. Try another date.' : 'No openings on this day. Try another date.'}
              </div>
            </div>
          ) : (
            <div style={{ paddingBottom: 20 }}>
              {[{ label: 'Morning', slots: morning }, { label: 'Afternoon', slots: afternoon }, { label: 'Evening', slots: evening }].map(function (section) {
                if (section.slots.length === 0) return null;
                return (
                  <div key={section.label} style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: S.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>{section.label}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {section.slots.map(function (slot) {
                        var isSelected = selectedSlot && selectedSlot.time === slot.time;
                        return (
                          <div key={slot.time} onClick={function () { setSelectedSlot(slot); }}
                            style={{
                              padding: '14px 0', textAlign: 'center', borderRadius: 10, cursor: 'pointer',
                              background: isSelected ? S.brand : S.white,
                              border: '2px solid ' + (isSelected ? S.brand : S.border),
                              color: isSelected ? '#fff' : S.text,
                              fontSize: 15, fontWeight: 600, transition: 'all 150ms',
                            }}>
                            {slot.label}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Session summary ── */}
          {selectedSlot && (
            <div style={{ background: S.white, border: '2px solid ' + S.brand, borderRadius: 12, padding: '16px 18px', marginBottom: 20, boxShadow: '0 2px 8px ' + S.brandMid }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: S.text }}>Your appointment</div>
                <div style={{ fontSize: 13, color: S.brand, fontWeight: 600 }}>{selectedSlot.label}</div>
              </div>
              <div style={{ fontSize: 13, color: S.textSoft, lineHeight: 1.6 }}>
                {activeDate && (dayNames[activeDate.getDay()] + ', ' + monthNames[activeDate.getMonth()] + ' ' + activeDate.getDate())}
                {isGroupBooking ? (
                  <span>{' · '}{groupMembers.length} people · {groupMembers.reduce(function (s, m) {
                    return s + (m.services || []).reduce(function (t, svc) { return t + svc.default_duration_minutes; }, 0);
                  }, 0)} min total</span>
                ) : (
                  <span>
                    {' · '}{selectedServices.length + ' service' + (selectedServices.length !== 1 ? 's' : '') + ' · ' + totalDuration + ' min'}
                    {selectedTech && (' · ' + selectedTech.display_name)}
                  </span>
                )}
              </div>
              {isGroupBooking && groupMembers.map(function (m, idx) {
                var mDur = (m.services || []).reduce(function (s, svc) { return s + svc.default_duration_minutes; }, 0);
                return (
                  <div key={idx} style={{position:'relative', fontSize: 12, color: S.textSoft, marginTop: 4, paddingLeft: 4 }}>
        <AreaTag id="ONLINE" />
                    {m.name}: {m.tech ? m.tech.display_name : 'Any tech'} · {m.services.length} svc · {mDur} min
                  </div>
                );
              })}
            </div>
          )}

          {selectedSlot && <PrimaryBtn onClick={function () { setStep('identify'); }}>Continue</PrimaryBtn>}
          <BackLink onClick={function () { setStep(bookingMode === 'group' ? 'groupHub' : 'services'); }} />
        </div>
      </div>
    );
  }


  // ═══════ STEPS 5-7: IDENTIFY / DEPOSIT / CONFIRM ═══════
  if (step === 'identify' || step === 'deposit' || step === 'confirm') {
    return <BookingLaterSteps step={step} ctx={{
      bookingMode, totalSteps, page, wrap, ss,
      phoneDigits, setPhoneDigits, phoneComplete, foundClient,
      firstName, setFirstName, lastName, setLastName, email, setEmail,
      matchedClient, setMatchedClient, matchConfirmed, setMatchConfirmed,
      canProceedIdentify, isGroupBooking, groupMembers,
      selectedServices, selectedTech, totalDuration,
      activeDate, selectedSlot, setStep,
      setBookingMode, setSelectedTech, setNoTechPreference,
      setSelectedServices, setGroupMembers, setSelectedDate, setSelectedSlot,
    }} Header={Header} StepDots={StepDots} PrimaryBtn={PrimaryBtn} BackLink={BackLink} Av={Av} S={S} F={F} />;
  }

  return null;
}
