/**
 * DateRangePicker — Popup calendar for selecting a date range
 * Touch-friendly, dark themed, side-by-side From/To calendars
 * Session 112
 */
import { useState } from 'react';
import { useTheme } from '../../lib/ThemeContext';

function pad2(n){ return n<10?'0'+n:''+n; }

var DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];
var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function parseDate(str) {
  var p = str.split('-');
  return new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2]));
}
function toStr(d) {
  return d.getFullYear()+'-'+pad2(d.getMonth()+1)+'-'+pad2(d.getDate());
}
function displayDate(str) {
  var d = parseDate(str);
  return (d.getMonth()+1)+'-'+d.getDate()+'-'+d.getFullYear();
}

function CalendarMonth({ year, month, selected, rangeStart, rangeEnd, onSelect, onPrevMonth, onNextMonth, C }) {
  var firstDay = new Date(year, month, 1).getDay();
  var daysInMonth = new Date(year, month+1, 0).getDate();
  var cells = [];
  for (var i = 0; i < firstDay; i++) cells.push(null);
  for (var d = 1; d <= daysInMonth; d++) cells.push(d);

  var today = new Date();
  var todayStr = today.getFullYear()+'-'+pad2(today.getMonth()+1)+'-'+pad2(today.getDate());

  return (
    <div style={{flex:1,minWidth:280}}>
      {/* Month nav */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,padding:'0 4px'}}>
        <div onClick={onPrevMonth}
          style={{width:40,height:40,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',background:C.chromeDark,border:'1px solid '+C.borderMedium,fontSize:16,color:C.textPrimary,fontWeight:700}}
          onMouseEnter={function(e){e.currentTarget.style.background=C.gridHover;}}
          onMouseLeave={function(e){e.currentTarget.style.background=C.chromeDark;}}>‹</div>
        <div style={{fontSize:16,fontWeight:700,color:C.textPrimary}}>{MONTHS[month]} {year}</div>
        <div onClick={onNextMonth}
          style={{width:40,height:40,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',background:C.chromeDark,border:'1px solid '+C.borderMedium,fontSize:16,color:C.textPrimary,fontWeight:700}}
          onMouseEnter={function(e){e.currentTarget.style.background=C.gridHover;}}
          onMouseLeave={function(e){e.currentTarget.style.background=C.chromeDark;}}>›</div>
      </div>
      {/* Day headers */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:6}}>
        {DAYS.map(function(d){ return (
          <div key={d} style={{textAlign:'center',fontSize:13,fontWeight:600,color:C.textMuted,padding:'6px 0'}}>{d}</div>
        ); })}
      </div>
      {/* Day cells */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3}}>
        {cells.map(function(day, idx){
          if (day === null) return <div key={'e'+idx} />;
          var dateStr = year+'-'+pad2(month+1)+'-'+pad2(day);
          var isSelected = dateStr === selected;
          var isToday = dateStr === todayStr;
          var inRange = false;
          if (rangeStart && rangeEnd) {
            inRange = dateStr >= rangeStart && dateStr <= rangeEnd;
          }
          return (
            <div key={day} onClick={function(){ onSelect(dateStr); }}
              style={{
                height:44,display:'flex',alignItems:'center',justifyContent:'center',
                borderRadius:8,cursor:'pointer',fontSize:15,fontWeight:isSelected?700:500,
                background: isSelected ? C.blue : inRange ? 'rgba(59,130,246,0.15)' : 'transparent',
                color: isSelected ? '#fff' : isToday ? C.blue : C.textPrimary,
                border: isToday && !isSelected ? '2px solid '+C.blue : '2px solid transparent',
              }}
              onMouseEnter={function(e){ if(!isSelected) e.currentTarget.style.background = inRange ? 'rgba(59,130,246,0.25)' : C.gridHover; }}
              onMouseLeave={function(e){ if(!isSelected) e.currentTarget.style.background = inRange ? 'rgba(59,130,246,0.15)' : 'transparent'; }}>
              {day}
            </div>
          );
        })}
      </div>
      {/* Selected date display */}
      <div style={{textAlign:'center',marginTop:12,fontSize:14,fontWeight:600,color:C.blueLight}}>
        {selected ? displayDate(selected) : '—'}
      </div>
    </div>
  );
}

export default function DateRangePicker({ fromDate, toDate, onApply, onCancel }) {
  var C = useTheme();
  var fromD = parseDate(fromDate);
  var toD = parseDate(toDate);

  var [fromYear, setFromYear] = useState(fromD.getFullYear());
  var [fromMonth, setFromMonth] = useState(fromD.getMonth());
  var [toYear, setToYear] = useState(toD.getFullYear());
  var [toMonth, setToMonth] = useState(toD.getMonth());
  var [pickFrom, setPickFrom] = useState(fromDate);
  var [pickTo, setPickTo] = useState(toDate);

  function handleFromSelect(dateStr) {
    setPickFrom(dateStr);
    if (dateStr > pickTo) setPickTo(dateStr);
  }
  function handleToSelect(dateStr) {
    setPickTo(dateStr);
    if (dateStr < pickFrom) setPickFrom(dateStr);
  }
  function handleApply() {
    onApply(pickFrom, pickTo);
  }

  function prevFromMonth() {
    if (fromMonth === 0) { setFromMonth(11); setFromYear(fromYear-1); }
    else setFromMonth(fromMonth-1);
  }
  function nextFromMonth() {
    if (fromMonth === 11) { setFromMonth(0); setFromYear(fromYear+1); }
    else setFromMonth(fromMonth+1);
  }
  function prevToMonth() {
    if (toMonth === 0) { setToMonth(11); setToYear(toYear-1); }
    else setToMonth(toMonth-1);
  }
  function nextToMonth() {
    if (toMonth === 11) { setToMonth(0); setToYear(toYear+1); }
    else setToMonth(toMonth+1);
  }

  return (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'flex-start',justifyContent:'center',zIndex:9999,paddingTop:60}}>
      <div style={{background:C.chrome,borderRadius:16,padding:28,minWidth:640,maxWidth:720,border:'2px solid '+C.borderMedium,boxShadow:'0 12px 40px rgba(0,0,0,0.5)'}}>
        {/* Title */}
        <div style={{textAlign:'center',fontSize:20,fontWeight:700,color:C.textPrimary,marginBottom:20}}>Select Date Range</div>

        {/* Side by side calendars */}
        <div style={{display:'flex',gap:24}}>
          {/* FROM calendar */}
          <div style={{flex:1,border:'2px solid '+C.borderMedium,borderRadius:12,padding:16,background:C.chromeDark}}>
            <div style={{textAlign:'center',fontSize:14,fontWeight:700,color:C.blueLight,marginBottom:12}}>From</div>
            <CalendarMonth
              year={fromYear} month={fromMonth}
              selected={pickFrom} rangeStart={pickFrom} rangeEnd={pickTo}
              onSelect={handleFromSelect}
              onPrevMonth={prevFromMonth} onNextMonth={nextFromMonth}
              C={C} />
          </div>
          {/* TO calendar */}
          <div style={{flex:1,border:'2px solid '+C.borderMedium,borderRadius:12,padding:16,background:C.chromeDark}}>
            <div style={{textAlign:'center',fontSize:14,fontWeight:700,color:C.blueLight,marginBottom:12}}>To</div>
            <CalendarMonth
              year={toYear} month={toMonth}
              selected={pickTo} rangeStart={pickFrom} rangeEnd={pickTo}
              onSelect={handleToSelect}
              onPrevMonth={prevToMonth} onNextMonth={nextToMonth}
              C={C} />
          </div>
        </div>

        {/* Buttons */}
        <div style={{display:'flex',justifyContent:'flex-end',gap:12,marginTop:24}}>
          <div onClick={onCancel}
            style={{padding:'12px 28px',borderRadius:8,fontSize:15,fontWeight:600,cursor:'pointer',background:C.chromeDark,color:C.textPrimary,border:'2px solid '+C.borderMedium}}
            onMouseEnter={function(e){e.currentTarget.style.background=C.gridHover;}}
            onMouseLeave={function(e){e.currentTarget.style.background=C.chromeDark;}}>Cancel</div>
          <div onClick={handleApply}
            style={{padding:'12px 28px',borderRadius:8,fontSize:15,fontWeight:600,cursor:'pointer',background:C.blue,color:'#fff',border:'none'}}
            onMouseEnter={function(e){e.currentTarget.style.opacity='0.85';}}
            onMouseLeave={function(e){e.currentTarget.style.opacity='1';}}>Apply</div>
        </div>
      </div>
    </div>
  );
}
