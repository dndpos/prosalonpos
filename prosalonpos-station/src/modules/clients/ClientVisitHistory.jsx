import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Client Visit History
 * Session 7 Decision #170: Full visit history with filters
 * - Date, services, tech, total, payment method, tip
 * - Filters: service type, technician
 * - Read-only, most recent first
 * - Cancelled and no-show shown with status badges
 */
import { useState, useMemo } from 'react';
import { fmt } from '../../lib/formatUtils';



export default function ClientVisitHistory({ visits = [] }) {
  var C = useTheme();
  var STATUS_COLORS = {
    completed: C.success,
    no_show: C.danger,
    cancelled: C.warning,
  };
  var [filterTech, setFilterTech] = useState('all');
  var [filterService, setFilterService] = useState('all');

  // Extract unique techs and services for filter dropdowns
  var techs = useMemo(function() {
    var set = {};
    visits.forEach(function(v) { if (v.tech) set[v.tech] = true; });
    return Object.keys(set).sort();
  }, [visits]);

  var services = useMemo(function() {
    var set = {};
    visits.forEach(function(v) { (v.services || []).forEach(function(s) { set[s] = true; }); });
    return Object.keys(set).sort();
  }, [visits]);

  var filtered = useMemo(function() {
    return visits.filter(function(v) {
      if (filterTech !== 'all' && v.tech !== filterTech) return false;
      if (filterService !== 'all' && !(v.services || []).includes(filterService)) return false;
      return true;
    });
  }, [visits, filterTech, filterService]);

  var selectStyle = {
    height: 34, background: C.chromeDark, border: '1px solid ' + C.borderMedium, borderRadius: 6,
    padding: '0 10px', color: C.textPrimary, fontSize: 12, fontFamily: 'inherit', outline: 'none',
    cursor: 'pointer', minWidth: 120,
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 4px' }}>
        <div style={{ color: C.textPrimary, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Visit History ({filtered.length})
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {techs.length > 1 && (
            <select value={filterTech} onChange={function(e) { setFilterTech(e.target.value); }} style={selectStyle}>
              <option value="all">All Techs</option>
              {techs.map(function(t) { return <option key={t} value={t}>{t}</option>; })}
            </select>
          )}
          {services.length > 1 && (
            <select value={filterService} onChange={function(e) { setFilterService(e.target.value); }} style={selectStyle}>
              <option value="all">All Services</option>
              {services.map(function(s) { return <option key={s} value={s}>{s}</option>; })}
            </select>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '20px 14px', background: C.chromeDark, borderRadius: 8, color: C.textMuted, fontSize: 13, textAlign: 'center' }}>
          {visits.length === 0 ? 'No visits yet' : 'No visits match the selected filters'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map(function(v) {
            var statusColor = STATUS_COLORS[v.status] || C.textMuted;
            var isCompleted = v.status === 'completed';
            return (
              <div key={v.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                background: C.chromeDark, borderRadius: 8, border: '1px solid ' + C.borderLight,
                opacity: isCompleted ? 1 : 0.7,
              }}>
                {/* Date */}
                <div style={{ width: 90, flexShrink: 0 }}>
                  <div style={{ color: C.textPrimary, fontSize: 13, fontWeight: 500 }}>{v.date}</div>
                </div>
                {/* Services + tech */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: C.textPrimary, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {(v.services || []).join(', ')}
                  </div>
                  <div style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>with {v.tech}</div>
                </div>
                {/* Status badge (only for non-completed) */}
                {!isCompleted && (
                  <span style={{
                    fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                    padding: '3px 8px', borderRadius: 4,
                    background: statusColor + '22', color: statusColor,
                    flexShrink: 0,
                  }}>{v.status === 'no_show' ? 'No Show' : v.status}</span>
                )}
                {/* Payment + total */}
                <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 80 }}>
                  <div style={{ color: C.textPrimary, fontSize: 13, fontWeight: 500 }}>{isCompleted ? fmt(v.total_cents) : '—'}</div>
                  {isCompleted && (
                    <div style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>
                      {v.payment}{v.tip_cents > 0 ? ' · tip ' + fmt(v.tip_cents) : ''}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
