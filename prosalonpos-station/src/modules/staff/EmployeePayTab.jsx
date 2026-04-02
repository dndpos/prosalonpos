/** Pro Salon POS — Employee Pay Tab (extracted Session 21)
 * Commission | Hourly | Salary sub-tabs with rate fields and inline numpads.
 */
import { useTheme } from '../../lib/ThemeContext';
import { FEATURES, isFeatureEnabled } from '../../lib/features';

// ── Reusable inline numpad component ──
function InlineNumpad({ isOpen, onToggle, label, value, displayValue, suffix, prefix, onKey, T, padId, showPayNumpad, isCashRegister }) {
  var isEditing = showPayNumpad === padId;
  var PAD_W = 200;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: isEditing ? PAD_W : 'auto', minWidth: isEditing ? PAD_W : 0, transition: 'all 200ms' }}>
      <div>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: T.textSecondary, marginBottom: 6 }}>{label}</label>
        <div onClick={onToggle}
          style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', width: isEditing ? '100%' : 'auto' }}>
          {prefix && (
            <div style={{ height: 44, padding: '0 12px', background: T.border, border: '1px solid ' + T.border, borderRadius: isEditing ? '8px 0 0 0' : '8px 0 0 8px', display: 'flex', alignItems: 'center', color: T.text, fontSize: 15, fontWeight: 500, boxSizing: 'border-box' }}>{prefix}</div>
          )}
          <div style={{ height: 44, padding: '0 14px', background: T.chrome, border: '1px solid ' + (isEditing ? T.primary : T.border), borderRadius: isEditing ? (prefix && suffix ? 0 : (prefix ? '0 8px 0 0' : (suffix ? '8px 0 0 0' : '8px 8px 0 0'))) : (prefix && suffix ? 0 : (prefix ? '0 8px 8px 0' : (suffix ? '8px 0 0 8px' : 8))), borderLeft: prefix ? 'none' : undefined, borderRight: suffix ? 'none' : undefined, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flex: isEditing ? 1 : undefined, minWidth: isEditing ? 0 : 80, boxSizing: 'border-box' }}>
            <span style={{ color: T.text, fontSize: 20, fontWeight: 600 }}>{displayValue}</span>
          </div>
          {suffix && (
            <div style={{ height: 44, padding: '0 12px', background: T.border, borderRadius: isEditing ? '0 8px 0 0' : '0 8px 8px 0', display: 'flex', alignItems: 'center', color: T.text, fontSize: 15, fontWeight: 500, boxSizing: 'border-box' }}>{suffix}</div>
          )}
        </div>
      </div>
      {isEditing && (
        <div tabIndex={0} onKeyDown={function(e) {
            if (e.key >= '0' && e.key <= '9') { e.preventDefault(); onKey(e.key); }
            else if (e.key === 'Backspace') { e.preventDefault(); onKey('⌫'); }
            else if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); onToggle(); }
            else if (e.key === 'c' || e.key === 'C') { e.preventDefault(); onKey('C'); }
          }}
          ref={function(el) { if (el) el.focus(); }}
          style={{ background: T.bg, border: '1px solid ' + T.primary, borderTop: 'none', borderRadius: '0 0 8px 8px', padding: 10, outline: 'none', width: PAD_W, boxSizing: 'border-box' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
            {['7','8','9','4','5','6','1','2','3','C','0','⌫'].map(function(key) {
              var isDanger = key === '⌫';
              var isWarn = key === 'C';
              return (
                <div key={key} onClick={function(e) { e.stopPropagation(); onKey(key); }}
                  style={{
                    height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isDanger ? '#7F1D1D' : (isWarn ? '#78350F' : T.chrome),
                    border: '1px solid ' + T.border, borderRadius: 6,
                    color: isDanger ? '#FCA5A5' : (isWarn ? '#FCD34D' : T.text),
                    fontSize: 16, fontWeight: 500, cursor: 'pointer', userSelect: 'none',
                  }}
                  onMouseEnter={function(e) { e.currentTarget.style.background = isDanger ? '#991B1B' : (isWarn ? '#92400E' : T.gridHover); }}
                  onMouseLeave={function(e) { e.currentTarget.style.background = isDanger ? '#7F1D1D' : (isWarn ? '#78350F' : T.chrome); }}>
                  {key}
                </div>
              );
            })}
          </div>
          <div onClick={function(e) { e.stopPropagation(); onToggle(); }}
            style={{ marginTop: 5, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.primary, borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            onMouseEnter={function(e) { e.currentTarget.style.background = '#1D4ED8'; }}
            onMouseLeave={function(e) { e.currentTarget.style.background = T.primary; }}>
            Done
          </div>
        </div>
      )}
    </div>
  );
}

export default function EmployeePayTab({ ctx }) {
  var T = useTheme();
  var servicesSplitEnabled = isFeatureEnabled(FEATURES.PROVIDER_PAY_SERVICES_SPLIT);
  var {
    payType, setPayType, showPayNumpad, setShowPayNumpad,
    commissionPct, setCommissionPct, dailyGuarantee, setDailyGuarantee,
    hourlyRate, setHourlyRate, salaryAmount, setSalaryAmount, salaryPeriod, setSalaryPeriod,
    commissionBonusEnabled, setCommissionBonusEnabled,
    payCheckPct, setPayCheckPct, payBonusPct, setPayBonusPct,
    payNumpad, LBL, F,
    categoryCommRates, setCategoryCommRates, activeCategories, salonSettings,
  } = ctx;

  var advancedCommEnabled = salonSettings && salonSettings.advanced_commission_enabled;
  var showCategoryRates = advancedCommEnabled && (payType === 'commission' || ((payType === 'hourly' || payType === 'salary') && commissionBonusEnabled));

  // Helpers for numpad key handling
  function pctKey(setter) {
    return function(key) {
      setter(function(p) { if (key === 'C') return ''; if (key === '⌫') return p.slice(0, -1); if (/\d/.test(key)) { var n = p + key; if (parseInt(n, 10) > 100) return p; return n; } return p; });
    };
  }
  function cashKey(setter) {
    return function(key) {
      setter(function(p) { if (key === 'C') return ''; if (key === '⌫') return p.slice(0, -1); if (/\d/.test(key)) return p + key; return p; });
    };
  }
  function togglePad(id) { return function() { setShowPayNumpad(showPayNumpad === id ? null : id); }; }

  return (
    <div>
      {/* Pay type sub-tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20 }}>
        {[
          { value: 'commission', label: 'Commission' },
          { value: 'hourly', label: 'Hourly' },
          { value: 'salary', label: 'Salary' },
        ].map(function(opt, i) {
          var isAct = payType === opt.value;
          var isFirst = i === 0;
          var isLast = i === 2;
          return (
            <div key={opt.value} onClick={function() { setPayType(opt.value); setShowPayNumpad(null); }}
              style={{
                height: 36, padding: '0 18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', userSelect: 'none',
                background: isAct ? T.primary : 'transparent',
                color: isAct ? '#fff' : T.textSecondary,
                border: isAct ? '1px solid ' + T.primary : '1px solid ' + T.border,
                borderRadius: isFirst ? '6px 0 0 6px' : (isLast ? '0 6px 6px 0' : 0),
                borderLeft: isFirst ? undefined : 'none',
              }}
              onMouseEnter={function(e) { if (!isAct) e.currentTarget.style.background = T.grid; }}
              onMouseLeave={function(e) { if (!isAct) e.currentTarget.style.background = isAct ? T.primary : 'transparent'; }}>
              {opt.label}
            </div>
          );
        })}
      </div>

      {/* Fields with inline numpads */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* Commission Rate */}
        {payType === 'commission' && (
          <InlineNumpad padId="rate" showPayNumpad={showPayNumpad} T={T}
            label="Commission Rate" suffix="%" displayValue={commissionPct || '0'}
            onToggle={togglePad('rate')} onKey={pctKey(setCommissionPct)} />
        )}

        {/* Daily Guarantee */}
        {payType === 'commission' && (
          <InlineNumpad padId="guarantee" showPayNumpad={showPayNumpad} T={T}
            label="Daily Guarantee" prefix="$" displayValue={dailyGuarantee ? (parseInt(dailyGuarantee, 10) / 100).toFixed(2) : '0.00'}
            onToggle={togglePad('guarantee')} onKey={cashKey(setDailyGuarantee)} />
        )}

        {/* Hourly Rate */}
        {payType === 'hourly' && (
          <InlineNumpad padId="rate" showPayNumpad={showPayNumpad} T={T}
            label="Hourly Rate" prefix="$" suffix="/hr" displayValue={hourlyRate ? (parseInt(hourlyRate, 10) / 100).toFixed(2) : '0.00'}
            onToggle={togglePad('rate')} onKey={cashKey(setHourlyRate)} />
        )}

        {/* Salary Amount */}
        {payType === 'salary' && (
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: T.textSecondary, marginBottom: 6 }}>Salary Amount</label>
            <div style={{ display: 'flex', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div onClick={togglePad('rate')} style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                  <div style={{ height: 44, padding: '0 12px', background: T.border, borderRadius: '8px 0 0 8px', display: 'flex', alignItems: 'center', color: T.text, fontSize: 15, fontWeight: 500 }}>$</div>
                  <div style={{ height: 44, padding: '0 14px', background: T.chrome, border: '1px solid ' + (showPayNumpad === 'rate' ? T.primary : T.border), borderLeft: 'none', borderRight: 'none', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', minWidth: 100, boxSizing: 'content-box' }}>
                    <span style={{ color: T.text, fontSize: 20, fontWeight: 600 }}>{salaryAmount ? (parseInt(salaryAmount, 10) / 100).toFixed(2) : '0.00'}</span>
                  </div>
                  <div style={{ height: 44, padding: '0 8px', background: T.border, borderRadius: '0 8px 8px 0', display: 'flex', alignItems: 'center' }}>
                    <select value={salaryPeriod} onChange={function(e) { setSalaryPeriod(e.target.value); }}
                      style={{ background: 'transparent', border: 'none', color: T.text, fontSize: 12, fontWeight: 500, fontFamily: F, outline: 'none', cursor: 'pointer' }}>
                      <option value="weekly">/weekly</option>
                      <option value="biweekly">/biweekly</option>
                      <option value="bimonthly">/bi-monthly</option>
                      <option value="monthly">/monthly</option>
                    </select>
                  </div>
                </div>
                {showPayNumpad === 'rate' && (
                  <div tabIndex={0} onKeyDown={function(e) {
                      if (e.key >= '0' && e.key <= '9') { e.preventDefault(); cashKey(setSalaryAmount)(e.key); }
                      else if (e.key === 'Backspace') { e.preventDefault(); cashKey(setSalaryAmount)('⌫'); }
                      else if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); setShowPayNumpad(null); }
                      else if (e.key === 'c' || e.key === 'C') { e.preventDefault(); cashKey(setSalaryAmount)('C'); }
                    }}
                    ref={function(el) { if (el) el.focus(); }}
                    style={{ background: T.bg, border: '1px solid ' + T.primary, borderRadius: '0 0 8px 8px', padding: 10, outline: 'none', marginTop: -1, width: 200 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                      {['7','8','9','4','5','6','1','2','3','C','0','⌫'].map(function(key) {
                        var isDanger = key === '⌫'; var isWarn = key === 'C';
                        return (
                          <div key={key} onClick={function(e) { e.stopPropagation(); cashKey(setSalaryAmount)(key); }}
                            style={{ height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDanger ? '#7F1D1D' : (isWarn ? '#78350F' : T.chrome), border: '1px solid ' + T.border, borderRadius: 6, color: isDanger ? '#FCA5A5' : (isWarn ? '#FCD34D' : T.text), fontSize: 16, fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}
                            onMouseEnter={function(e) { e.currentTarget.style.background = isDanger ? '#991B1B' : (isWarn ? '#92400E' : T.gridHover); }}
                            onMouseLeave={function(e) { e.currentTarget.style.background = isDanger ? '#7F1D1D' : (isWarn ? '#78350F' : T.chrome); }}>
                            {key}
                          </div>
                        );
                      })}
                    </div>
                    <div onClick={function(e) { e.stopPropagation(); setShowPayNumpad(null); }}
                      style={{ marginTop: 5, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.primary, borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                      onMouseEnter={function(e) { e.currentTarget.style.background = '#1D4ED8'; }}
                      onMouseLeave={function(e) { e.currentTarget.style.background = T.primary; }}>Done</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Plus Commission toggle — for hourly and salary only */}
        {(payType === 'hourly' || payType === 'salary') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 4, paddingTop: 24 }}>
            <div onClick={function() { setCommissionBonusEnabled(!commissionBonusEnabled); setShowPayNumpad(null); }}
              style={{ width: 44, height: 24, borderRadius: 12, background: commissionBonusEnabled ? '#22C55E' : T.chrome, cursor: 'pointer', position: 'relative', transition: 'background 150ms', flexShrink: 0 }}>
              <div style={{ width: 20, height: 20, borderRadius: 10, background: '#fff', position: 'absolute', top: 2, left: commissionBonusEnabled ? 22 : 2, transition: 'left 150ms' }} />
            </div>
            <span style={{ color: commissionBonusEnabled ? T.text : T.textMuted, fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>+ Commission</span>
          </div>
        )}

        {/* Commission rate field for hourly/salary when plus commission is enabled */}
        {(payType === 'hourly' || payType === 'salary') && commissionBonusEnabled && (
          <InlineNumpad padId="comm_rate" showPayNumpad={showPayNumpad} T={T}
            label="Commission Rate" suffix="%" displayValue={commissionPct || '0'}
            onToggle={togglePad('comm_rate')} onKey={pctKey(setCommissionPct)} />
        )}
      </div>

      {/* Paycheck + Services split */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginTop: 16 }}>
        <InlineNumpad padId="check" showPayNumpad={showPayNumpad} T={T}
          label="Paycheck" suffix="%" displayValue={servicesSplitEnabled ? (payCheckPct || '0') : '100'}
          onToggle={servicesSplitEnabled ? togglePad('check') : function(){}}
          onKey={function(key) {
            setPayCheckPct(function(p) {
              var next; if (key === 'C') next = ''; else if (key === '⌫') next = p.slice(0, -1); else if (/\d/.test(key)) { var n = p + key; next = parseInt(n, 10) > 100 ? p : n; } else next = p;
              var v = parseInt(next, 10) || 0; setPayBonusPct(String(Math.max(0, 100 - v)));
              return next;
            });
          }} />
        {servicesSplitEnabled && (
          <InlineNumpad padId="bonus" showPayNumpad={showPayNumpad} T={T}
            label="Services" suffix="%" displayValue={payBonusPct || '0'}
            onToggle={togglePad('bonus')}
            onKey={function(key) {
              setPayBonusPct(function(p) {
                var next; if (key === 'C') next = ''; else if (key === '⌫') next = p.slice(0, -1); else if (/\d/.test(key)) { var n = p + key; next = parseInt(n, 10) > 100 ? p : n; } else next = p;
                var v = parseInt(next, 10) || 0; setPayCheckPct(String(Math.max(0, 100 - v)));
                return next;
              });
            }} />
        )}
      </div>

      {/* ── Category Commission Rates (advanced mode) ── */}
      {showCategoryRates && activeCategories && activeCategories.length > 0 && (
        <div style={{ marginTop: 20, borderTop: '1px solid ' + T.border, paddingTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.primary, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Category Commission Rates</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 12 }}>Tap a category to set a custom %. Blank = uses flat rate ({commissionPct || '0'}%).</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {activeCategories.map(function(cat) {
              var catRate = categoryCommRates[cat.id];
              var hasCustom = catRate !== undefined && catRate !== '';
              var isEditing = showPayNumpad === 'catrate_' + cat.id;
              function handleCatKey(key) {
                setCategoryCommRates(function(prev) {
                  var cur = String(prev[cat.id] || '');
                  var next;
                  if (key === 'C') next = '';
                  else if (key === '⌫') next = cur.slice(0, -1);
                  else if (/\d/.test(key)) { var n = cur + key; next = parseInt(n, 10) > 100 ? cur : n; }
                  else next = cur;
                  var updated = Object.assign({}, prev);
                  if (next === '') { delete updated[cat.id]; } else { updated[cat.id] = next; }
                  return updated;
                });
              }
              return (
                <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', minWidth: isEditing ? 200 : 140, width: isEditing ? 200 : 'auto', transition: 'all 200ms' }}>
                  <div onClick={function() { setShowPayNumpad(isEditing ? null : 'catrate_' + cat.id); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                      background: isEditing ? T.accentBg : T.chrome, border: '1px solid ' + (isEditing ? T.primary : (hasCustom ? '#22C55E50' : T.border)),
                      borderRadius: isEditing ? '8px 8px 0 0' : 8, cursor: 'pointer', transition: 'border-color 150ms, background 150ms',
                    }}
                    onMouseEnter={function(e) { if (!isEditing) e.currentTarget.style.borderColor = T.textMuted; }}
                    onMouseLeave={function(e) { if (!isEditing) e.currentTarget.style.borderColor = hasCustom ? '#22C55E50' : T.border; }}>
                    {cat.calendar_color && <div style={{ width: 10, height: 10, borderRadius: 3, background: cat.calendar_color, flexShrink: 0 }} />}
                    <span style={{ fontSize: 12, color: T.text, fontWeight: 500, flex: 1 }}>{cat.name}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: hasCustom ? '#22C55E' : T.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                      {hasCustom ? catRate + '%' : (commissionPct || '0') + '%'}
                    </span>
                  </div>
                  {isEditing && (
                    <div tabIndex={0} onKeyDown={function(e) {
                        if (e.key >= '0' && e.key <= '9') { e.preventDefault(); handleCatKey(e.key); }
                        else if (e.key === 'Backspace') { e.preventDefault(); handleCatKey('⌫'); }
                        else if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); setShowPayNumpad(null); }
                        else if (e.key === 'c' || e.key === 'C') { e.preventDefault(); handleCatKey('C'); }
                      }}
                      ref={function(el) { if (el) el.focus(); }}
                      style={{ background: T.bg, border: '1px solid ' + T.primary, borderTop: 'none', borderRadius: '0 0 8px 8px', padding: 10, outline: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
                        <div style={{ height: 40, padding: '0 14px', background: T.chrome, border: '1px solid ' + T.border, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 56 }}>
                          <span style={{ color: hasCustom ? '#22C55E' : T.textMuted, fontSize: 20, fontWeight: 600 }}>{hasCustom ? catRate : ''}</span>
                        </div>
                        <span style={{ color: T.textMuted, fontSize: 15, fontWeight: 500 }}>%</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5 }}>
                        {['7','8','9','4','5','6','1','2','3','C','0','⌫'].map(function(key) {
                          var isDanger = key === '⌫'; var isWarn = key === 'C';
                          return (
                            <div key={key} onClick={function(e) { e.stopPropagation(); handleCatKey(key); }}
                              style={{ height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isDanger ? '#7F1D1D' : (isWarn ? '#78350F' : T.chrome), border: '1px solid ' + T.border, borderRadius: 6, color: isDanger ? '#FCA5A5' : (isWarn ? '#FCD34D' : T.text), fontSize: 16, fontWeight: 500, cursor: 'pointer', userSelect: 'none' }}
                              onMouseEnter={function(e) { e.currentTarget.style.background = isDanger ? '#991B1B' : (isWarn ? '#92400E' : T.gridHover); }}
                              onMouseLeave={function(e) { e.currentTarget.style.background = isDanger ? '#7F1D1D' : (isWarn ? '#78350F' : T.chrome); }}>
                              {key}
                            </div>
                          );
                        })}
                      </div>
                      <div onClick={function(e) { e.stopPropagation(); setShowPayNumpad(null); }}
                        style={{ marginTop: 5, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.primary, borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                        onMouseEnter={function(e) { e.currentTarget.style.background = '#1D4ED8'; }}
                        onMouseLeave={function(e) { e.currentTarget.style.background = T.primary; }}>
                        Done
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
