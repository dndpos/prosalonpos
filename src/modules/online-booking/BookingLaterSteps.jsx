/** Pro Salon POS — Online Booking Later Steps (extracted Session 21)
 * Steps: Identify, Deposit, Confirmation
 * Receives all state/handlers via ctx prop.
 */

export default function BookingLaterSteps({ step, ctx, Header, StepDots, PrimaryBtn, BackLink, Av, S, F }) {
  var {
    bookingMode, totalSteps, page, wrap, ss,
    phoneDigits, setPhoneDigits, phoneComplete, foundClient,
    firstName, setFirstName, lastName, setLastName, email, setEmail,
    matchedClient, setMatchedClient, matchConfirmed, setMatchConfirmed,
    canProceedIdentify, isGroupBooking, groupMembers,
    selectedServices, selectedTech, totalDuration,
    activeDate, selectedSlot, setStep,
    setBookingMode, setSelectedTech, setNoTechPreference,
    setSelectedServices, setGroupMembers, setSelectedDate, setSelectedSlot,
  } = ctx;

  function formatPhone(d) {
    if (!d) return '';
    if (d.length <= 3) return '(' + d;
    if (d.length <= 6) return '(' + d.slice(0, 3) + ') ' + d.slice(3);
    return '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6, 10);
  }

  // ═══════ IDENTIFY ═══════
  if (step === 'identify') {
    var idStepNum = bookingMode === 'group' ? 4 : 3;
    return (
      <div style={page}>
        <Header />
        <StepDots current={idStepNum} total={totalSteps} />
        <div style={wrap}>
          <div style={{ color: S.text, fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Almost there — your info</div>
          <div style={{ color: S.textSoft, fontSize: 14, marginBottom: 24 }}>Enter your phone number to complete the booking</div>
          <div style={{ marginBottom: 20 }}>
            <input value={formatPhone(phoneDigits)}
              onChange={function (e) {
                var d = e.target.value.replace(/\D/g, '').slice(0, 10);
                setPhoneDigits(d); setMatchedClient(null); setMatchConfirmed(false);
                setFirstName(''); setLastName(''); setEmail('');
              }}
              placeholder="(561) 555-0101" type="tel" inputMode="tel" autoFocus
              style={{ width: '100%', height: 56, background: S.white, border: '2px solid ' + (phoneComplete ? S.brand : S.border), borderRadius: 12, padding: '0 20px', color: S.text, fontSize: 20, fontWeight: 500, fontFamily: F, outline: 'none', boxSizing: 'border-box', textAlign: 'center', letterSpacing: 1, transition: 'border-color 200ms' }} />
          </div>

          {phoneComplete && foundClient && !matchConfirmed && (
            <div onClick={function () { setMatchedClient(foundClient); setMatchConfirmed(true); }}
              style={{ background: S.white, border: '2px solid ' + S.brand, borderRadius: 12, padding: '18px 20px', marginBottom: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 2px 8px ' + S.brandMid }}
              onMouseEnter={function (e) { e.currentTarget.style.background = S.brandSoft; }}
              onMouseLeave={function (e) { e.currentTarget.style.background = S.white; }}>
              <Av name={foundClient.first_name + ' ' + foundClient.last_name} />
              <div style={{ flex: 1 }}>
                <div style={{ color: S.text, fontSize: 17, fontWeight: 600 }}>{foundClient.first_name} {foundClient.last_name}</div>
                <div style={{ color: S.brand, fontSize: 13, marginTop: 2 }}>Is this you? Tap to confirm</div>
              </div>
            </div>
          )}

          {matchConfirmed && matchedClient && (
            <div style={{ background: S.successLight, border: '2px solid ' + S.success, borderRadius: 12, padding: '18px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
              <Av name={matchedClient.first_name + ' ' + matchedClient.last_name} />
              <div style={{ flex: 1 }}>
                <div style={{ color: S.success, fontSize: 17, fontWeight: 600 }}>Welcome back, {matchedClient.first_name}!</div>
                {matchedClient.email && <div style={{ color: S.textSoft, fontSize: 13, marginTop: 2 }}>{matchedClient.email}</div>}
              </div>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: S.success, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16 }}>✓</div>
            </div>
          )}

          {phoneComplete && !foundClient && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ color: S.textSoft, fontSize: 14, marginBottom: 16 }}>No account found — let's set you up</div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 13, color: S.text, fontWeight: 500, marginBottom: 6 }}>First name <span style={{ color: S.danger }}>*</span></label>
                  <input value={firstName} onChange={function (e) { setFirstName(e.target.value); }} placeholder="First name" autoFocus
                    style={{ width: '100%', height: 48, background: S.white, border: '1px solid ' + S.border, borderRadius: 10, padding: '0 16px', color: S.text, fontSize: 15, fontFamily: F, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 13, color: S.text, fontWeight: 500, marginBottom: 6 }}>Last name</label>
                  <input value={lastName} onChange={function (e) { setLastName(e.target.value); }} placeholder="Last name"
                    style={{ width: '100%', height: 48, background: S.white, border: '1px solid ' + S.border, borderRadius: 10, padding: '0 16px', color: S.text, fontSize: 15, fontFamily: F, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: S.text, fontWeight: 500, marginBottom: 6 }}>Email</label>
                <input value={email} onChange={function (e) { setEmail(e.target.value); }} placeholder="email@example.com"
                  style={{ width: '100%', height: 48, background: S.white, border: '1px solid ' + S.border, borderRadius: 10, padding: '0 16px', color: S.text, fontSize: 15, fontFamily: F, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
          )}

          {canProceedIdentify && <PrimaryBtn onClick={function () {
            var ds = ss;
            if (ds.deposit_enabled && ds.deposit_source_online) {
              var visitTotal = 0;
              if (isGroupBooking) {
                groupMembers.forEach(function (m) {
                  (m.services || []).forEach(function (svc) { visitTotal += svc.price_cents; });
                });
              } else {
                selectedServices.forEach(function (svc) { visitTotal += svc.price_cents; });
              }
              var needsDeposit = ds.deposit_trigger === 'always' || visitTotal >= ds.deposit_threshold_cents;
              if (needsDeposit) { setStep('deposit'); return; }
            }
            setStep('confirm');
          }}>Complete Booking</PrimaryBtn>}
          <BackLink onClick={function () { setStep('datetime'); }} />
        </div>
      </div>
    );
  }

  // ═══════ DEPOSIT ═══════
  if (step === 'deposit') {
    var depStepNum = bookingMode === 'group' ? 5 : 4;
    var ds = ss;
    var visitTotalCents = 0;
    if (isGroupBooking) {
      groupMembers.forEach(function (m) {
        (m.services || []).forEach(function (svc) { visitTotalCents += svc.price_cents; });
      });
    } else {
      selectedServices.forEach(function (svc) { visitTotalCents += svc.price_cents; });
    }
    var depositCents = ds.deposit_amount_type === 'percentage'
      ? Math.round(visitTotalCents * ds.deposit_percentage / 100)
      : ds.deposit_flat_amount_cents;
    var dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return (
      <div style={page}>
        <Header />
        <StepDots current={depStepNum} total={totalSteps} />
        <div style={wrap}>
          <div style={{ color: S.text, fontSize: 20, fontWeight: 600, marginBottom: 4 }}>Deposit required</div>
          <div style={{ color: S.textSoft, fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
            A deposit is required to confirm your booking. Your card will be charged now and the amount will be applied to your total at checkout.
          </div>
          <div style={{ background: S.white, border: '2px solid ' + S.border, borderRadius: 12, padding: '16px 18px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: S.textSoft }}>Appointment</div>
              <div style={{ fontSize: 13, color: S.textSoft }}>
                {activeDate && (dayNames[activeDate.getDay()] + ', ' + monthNames[activeDate.getMonth()] + ' ' + activeDate.getDate())}
                {selectedSlot && (' at ' + selectedSlot.label)}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: S.textSoft }}>Visit total</div>
              <div style={{ fontSize: 15, color: S.text, fontWeight: 600 }}>{'$' + (visitTotalCents / 100).toFixed(2)}</div>
            </div>
            <div style={{ borderTop: '1px solid ' + S.borderLight, paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, color: S.text, fontWeight: 600 }}>Deposit due now</div>
              <div style={{ fontSize: 20, color: S.brand, fontWeight: 700 }}>{'$' + (depositCents / 100).toFixed(2)}</div>
            </div>
            {ds.deposit_amount_type === 'percentage' && (
              <div style={{ fontSize: 12, color: S.textFaint, marginTop: 6 }}>{ds.deposit_percentage + '% of visit total'}</div>
            )}
          </div>
          <div style={{ background: S.white, border: '1px solid ' + S.border, borderRadius: 12, padding: '18px', marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: S.text, marginBottom: 14 }}>Card details</div>
            <div style={{ marginBottom: 12 }}>
              <input placeholder="Card number" inputMode="numeric" style={{ width: '100%', height: 48, background: S.bg, border: '1px solid ' + S.border, borderRadius: 10, padding: '0 16px', color: S.text, fontSize: 15, fontFamily: F, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <input placeholder="MM / YY" inputMode="numeric" style={{ flex: 1, height: 48, background: S.bg, border: '1px solid ' + S.border, borderRadius: 10, padding: '0 16px', color: S.text, fontSize: 15, fontFamily: F, outline: 'none', boxSizing: 'border-box' }} />
              <input placeholder="CVC" inputMode="numeric" style={{ width: 100, height: 48, background: S.bg, border: '1px solid ' + S.border, borderRadius: 10, padding: '0 16px', color: S.text, fontSize: 15, fontFamily: F, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div style={{ fontSize: 11, color: S.textFaint, marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>🔒</span> Your payment is secure. Card is charged once and not saved.
            </div>
          </div>
          <PrimaryBtn onClick={function () { setStep('confirm'); }}>{'Pay $' + (depositCents / 100).toFixed(2) + ' & Confirm'}</PrimaryBtn>
          <BackLink onClick={function () { setStep('identify'); }} />
        </div>
      </div>
    );
  }

  // ═══════ CONFIRMATION ═══════
  if (step === 'confirm') {
    var confStepNum = totalSteps - 1;
    var dayNames2 = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var monthNames2 = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var clientName = matchedClient ? (matchedClient.first_name + ' ' + matchedClient.last_name) : (firstName + (lastName ? ' ' + lastName : ''));

    return (
      <div style={page}>
        <Header />
        <StepDots current={confStepNum} total={totalSteps} />
        <div style={wrap}>
          <div style={{ textAlign: 'center', paddingTop: 20, marginBottom: 24 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: S.success + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 32 }}>✓</div>
            <div style={{ color: S.text, fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Booking confirmed!</div>
            <div style={{ color: S.textSoft, fontSize: 14 }}>You'll receive a confirmation message shortly.</div>
          </div>
          <div style={{ background: S.white, border: '2px solid ' + S.border, borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ background: S.brand, padding: '14px 18px', color: '#fff' }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>
                {activeDate && (dayNames2[activeDate.getDay()] + ', ' + monthNames2[activeDate.getMonth()] + ' ' + activeDate.getDate())}
              </div>
              <div style={{ fontSize: 14, opacity: 0.9, marginTop: 2 }}>{selectedSlot && selectedSlot.label}</div>
            </div>
            <div style={{ padding: '16px 18px' }}>
              {isGroupBooking ? (
                groupMembers.map(function (m, idx) {
                  var mDur = (m.services || []).reduce(function (s, svc) { return s + svc.default_duration_minutes; }, 0);
                  return (
                    <div key={idx} style={{ paddingBottom: idx < groupMembers.length - 1 ? 14 : 0, marginBottom: idx < groupMembers.length - 1 ? 14 : 0, borderBottom: idx < groupMembers.length - 1 ? '1px solid ' + S.borderLight : 'none' }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: S.text, marginBottom: 4 }}>{m.name}</div>
                      <div style={{ fontSize: 13, color: S.textSoft, marginBottom: 2 }}>{m.tech ? m.tech.display_name : 'Any available technician'}</div>
                      {(m.services || []).map(function (svc) {
                        return (<div key={svc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                          <div style={{ width: 4, height: 4, borderRadius: 2, background: svc.calendar_color, flexShrink: 0 }} />
                          <div style={{ fontSize: 13, color: S.text }}>{svc.name}</div>
                          <div style={{ fontSize: 12, color: S.textFaint }}>{svc.default_duration_minutes + ' min'}</div>
                        </div>);
                      })}
                      <div style={{ fontSize: 12, color: S.textFaint, marginTop: 4 }}>{'Total: ' + mDur + ' min'}</div>
                    </div>
                  );
                })
              ) : (
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: S.text, marginBottom: 2 }}>{clientName}</div>
                  <div style={{ fontSize: 13, color: S.textSoft, marginBottom: 10 }}>{selectedTech ? selectedTech.display_name : 'Any available technician'}</div>
                  {selectedServices.map(function (svc) {
                    return (<div key={svc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      <div style={{ width: 4, height: 4, borderRadius: 2, background: svc.calendar_color, flexShrink: 0 }} />
                      <div style={{ fontSize: 13, color: S.text }}>{svc.name}</div>
                      <div style={{ fontSize: 12, color: S.textFaint }}>{svc.default_duration_minutes + ' min'}</div>
                    </div>);
                  })}
                  <div style={{ fontSize: 12, color: S.textFaint, marginTop: 8 }}>{'Total: ' + totalDuration + ' min'}</div>
                </div>
              )}
            </div>
          </div>
          {ss.deposit_enabled !== false && (
            <div style={{ background: S.borderLight, borderRadius: 10, padding: '12px 16px', marginBottom: 24, fontSize: 12, color: S.textSoft, lineHeight: 1.5 }}>
              {'Need to cancel or reschedule? You can do so up to ' + (ss.cancellation_window_hours || 24) + ' hours before your appointment for a full refund.'}
            </div>
          )}
          <PrimaryBtn onClick={function () {
            setStep('mode'); setBookingMode(null); setSelectedTech(null); setNoTechPreference(false);
            setSelectedServices([]); setGroupMembers([]); setPhoneDigits(''); setFirstName('');
            setLastName(''); setEmail(''); setMatchedClient(null); setMatchConfirmed(false);
            setSelectedDate(null); setSelectedSlot(null);
          }}>Book another appointment</PrimaryBtn>
          <div style={{ height: 40 }} />
        </div>
      </div>
    );
  }

  return null;
}
