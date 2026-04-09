import AreaTag from '../../components/ui/AreaTag';
import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Loyalty Module (Container)
 * Session 11: Loyalty program with 4 tabs.
 * Renders in OwnerDashboard right panel when sidebar "Loyalty" is tapped.
 *
 * Tabs: Members | Rewards | Tiers | Settings
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MOCK_LOYALTY_PROGRAM } from './loyaltyBridge';
import { useLoyaltyStore } from '../../lib/stores/loyaltyStore';
import { isProduction } from '../../lib/apiClient';
import LoyaltyMembers from './LoyaltyMembers';
import LoyaltyRewards from './LoyaltyRewards';
import LoyaltyTiers from './LoyaltyTiers';
import LoyaltySettings from './LoyaltySettings';


var TABS = [
  { id: 'members',  label: 'Members',  bg:'#0E3D3D', text:'#5EEAD4', border:'#1A5C5C' },
  { id: 'rewards',  label: 'Rewards',  bg:'#3D2608', text:'#FBB040', border:'#5C3A10' },
  { id: 'tiers',    label: 'Tiers',    bg:'#2E1042', text:'#C4B5FD', border:'#4A1A6A' },
  { id: 'settings', label: 'Settings', bg:'#182A3A', text:'#7EB8DC', border:'#264460' },
];

export default function LoyaltyModule({ salonSettings, onSettingsUpdate, catalogLayout }) {
  var T = useTheme();
  var _isProd = isProduction();
  var storeProgram = useLoyaltyStore(function(s) { return s.program; });
  var storeUpdateProgram = useLoyaltyStore(function(s) { return s.updateProgram; });
  var fetchProgram = useLoyaltyStore(function(s) { return s.fetchProgram; });
  var fetchMembers = useLoyaltyStore(function(s) { return s.fetchMembers; });
  var [activeTab, setActiveTab] = useState('members');
  var [program, setProgram] = useState(_isProd ? null : MOCK_LOYALTY_PROGRAM);
  var [saveStatus, setSaveStatus] = useState(null); // 'saving' | 'saved' | 'error'
  var saveTimerRef = useRef(null);

  // Fetch in production
  useEffect(function() {
    if (_isProd) { fetchProgram(); fetchMembers(); }
  }, []);

  // Sync store program into local state when it arrives
  useEffect(function() {
    if (_isProd && storeProgram) setProgram(storeProgram);
  }, [_isProd, storeProgram]);

  // Track the latest pending update so we can flush on unmount
  var pendingRef = useRef(null);

  // Debounced save — fires 600ms after last change
  var debouncedSave = useCallback(function(updated) {
    if (!_isProd) return;
    pendingRef.current = updated;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(function() {
      pendingRef.current = null;
      setSaveStatus('saving');
      storeUpdateProgram(updated).then(function() {
        setSaveStatus('saved');
        setTimeout(function() { setSaveStatus(null); }, 1500);
      }).catch(function(err) {
        console.error('[Loyalty] Save failed:', err);
        setSaveStatus('error');
        setTimeout(function() { setSaveStatus(null); }, 3000);
      });
    }, 600);
  }, [_isProd, storeUpdateProgram]);

  // On unmount: flush pending save immediately instead of cancelling
  useEffect(function() {
    return function() {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (pendingRef.current && _isProd) {
        storeUpdateProgram(pendingRef.current).catch(function(err) {
          console.error('[Loyalty] Flush save on unmount failed:', err);
        });
      }
    };
  }, [_isProd, storeUpdateProgram]);

  function handleProgramUpdate(key, val) {
    setProgram(function(prev) {
      var updated = Object.assign({}, prev);
      updated[key] = val;
      debouncedSave(updated);
      return updated;
    });
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: "'Inter',system-ui,sans-serif", position: 'relative' }}>
        <AreaTag id="LY" />
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px 0 20px' }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: T.text }}>Loyalty Program</span>
        <span style={{ fontSize: 12, color: T.textMuted }}>
          {program && program.program_type === 'tiered' ? 'Tiered' : 'Flat'} · {program && program.active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, padding: '12px 20px' }}>
        {TABS.map(function(tab) {
          var active = activeTab === tab.id;
          return (
            <div key={tab.id} onClick={function() { setActiveTab(tab.id); }}
              onMouseEnter={function(e) { if (!active) { e.currentTarget.style.borderWidth = '2px'; e.currentTarget.style.padding = '7px 17px'; } }}
              onMouseLeave={function(e) { if (!active) { e.currentTarget.style.borderWidth = '1px'; e.currentTarget.style.padding = '8px 18px'; } }}
              style={{
                padding: '8px 18px', borderRadius: 6, fontSize: 13, fontWeight: active ? 600 : 500,
                cursor: 'pointer', userSelect: 'none',
                backgroundColor: tab.bg,
                color: tab.text,
                border: active ? '2px solid ' + tab.border : '1px solid ' + tab.border,
                transition: 'background-color 150ms, color 150ms',
              }}
            >{tab.label}</div>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 20px 20px 20px' }}>
        {activeTab === 'members' && <LoyaltyMembers />}
        {activeTab === 'rewards' && <LoyaltyRewards programType={program && program.program_type} catalogLayout={catalogLayout} />}
        {activeTab === 'tiers' && <LoyaltyTiers programType={program && program.program_type} />}
        {activeTab === 'settings' && <LoyaltySettings program={program} onProgramUpdate={handleProgramUpdate} saveStatus={saveStatus} />}
      </div>
    </div>
  );
}
