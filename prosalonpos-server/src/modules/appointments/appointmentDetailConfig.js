/**
 * AppointmentDetailPopup — Config & Constants
 * Extracted from AppointmentDetailPopup.jsx (V3) to stay under 800-line cap.
 *
 * Status configuration, transitions, labels, styles, extra time options,
 * service catalog, and small helper components.
 */

export var STATUS_CONFIG = {
  pending:     {label:'Pending Confirmation', bg:'rgba(245,158,11,0.15)', color:'#FBBF24',  dot:'#F59E0B'},
  confirmed:   {label:'Confirmed',   bg:'rgba(56,189,248,0.15)',  color:'#7DD3FC',  dot:'#38BDF8'},
  checked_in:  {label:'Checked In',  bg:'rgba(16,185,129,0.15)', color:'#6EE7B7',  dot:'#10B981'},
  in_progress: {label:'In Progress', bg:'rgba(139,92,246,0.15)', color:'#C4B5FD',  dot:'#8B5CF6'},
  completed:   {label:'Completed',   bg:'rgba(34,197,94,0.15)',  color:'#86EFAC',  dot:'#22C55E'},
  checked_out: {label:'Checked Out', bg:'rgba(34,197,94,0.15)',  color:'#86EFAC',  dot:'#22C55E'},
  no_show:     {label:'No Show',     bg:'rgba(239,68,68,0.15)',  color:'#FCA5A5',  dot:'#EF4444'},
  cancelled:   {label:'Cancelled',   bg:'rgba(100,116,139,0.15)',color:'#CBD5E1',  dot:'#64748B'},
};

export var ALLOWED_TRANSITIONS = {
  pending:     ['confirmed','cancelled'],
  confirmed:   ['checked_in','no_show','cancelled'],
  checked_in:  ['in_progress','cancelled'],
  in_progress: ['completed'],
  completed:   [],
  checked_out: [],
  no_show:     [],
  cancelled:   [],
};

export var TRANSITION_LABELS = {
  confirmed:'Confirm Appointment', checked_in:'Check In', in_progress:'Start Working',
  completed:'Complete', no_show:'No Show', cancelled:'Cancel Appointment',
};

export var TRANSITION_CONFIRM_MSG = {
  confirmed:'Mark this appointment as confirmed?',
  checked_in:'Check in this client? This will start the wait timer.',
  in_progress:'Start working on this appointment? It can no longer be cancelled after this.',
  completed:'Mark this appointment as completed? This will move it to checkout.',
  no_show:'Mark this client as a no-show? This cannot be undone.',
  cancelled:'Cancel this appointment? This cannot be undone.',
};

export var TRANSITION_STYLES = {
  confirmed:   {bg:'#38BDF8',color:'#fff'},
  checked_in:  {bg:'#10B981',color:'#fff'},
  in_progress: {bg:'#8B5CF6',color:'#fff'},
  completed:   {bg:'#22C55E',color:'#fff'},
  no_show:     {bg:'transparent',color:'#FCA5A5',border:'1px solid rgba(239,68,68,0.4)'},
  cancelled:   {bg:'transparent',color:'#CBD5E1',border:'1px solid rgba(100,116,139,0.4)'},
};

export var EXTRA_TIME_OPTIONS = [
  {label:'+15 min', minutes:15},
  {label:'+30 min', minutes:30},
  {label:'+45 min', minutes:45},
  {label:'+1 hour', minutes:60},
];

// Service catalog for Add Service popup (matches mockData.js)
export var SERVICE_CATEGORIES = [
  {id:'cat-01',name:'Hair'},{id:'cat-02',name:'Nails'},{id:'cat-03',name:'Color'},
  {id:'cat-04',name:'Skin'},{id:'cat-05',name:'Men'},
];

export var SERVICE_CATALOG = [
  {id:'svc-01',name:"Women's Haircut",   color:'#EF4444',dur:45, price:5500, cats:['cat-01']},
  {id:'svc-02',name:'Blowout',           color:'#EC4899',dur:30, price:3500, cats:['cat-01']},
  {id:'svc-03',name:'Updo',              color:'#D946EF',dur:60, price:7500, cats:['cat-01']},
  {id:'svc-04',name:'Deep Conditioning',  color:'#F97316',dur:30, price:4000, cats:['cat-01','cat-04']},
  {id:'svc-05',name:'Full Color',        color:'#8B5CF6',dur:90, price:12000,cats:['cat-03']},
  {id:'svc-06',name:'Highlights',        color:'#F59E0B',dur:120,price:15000,cats:['cat-03']},
  {id:'svc-07',name:'Balayage',          color:'#6366F1',dur:150,price:20000,cats:['cat-03']},
  {id:'svc-08',name:'Custom Color',      color:'#FF6B6B',dur:120,price:0,    cats:['cat-03']},
  {id:'svc-09',name:'Manicure',          color:'#06B6D4',dur:30, price:3000, cats:['cat-02']},
  {id:'svc-10',name:'Pedicure',          color:'#14B8A6',dur:45, price:4500, cats:['cat-02']},
  {id:'svc-11',name:'Gel Manicure',      color:'#2DD4BF',dur:45, price:4500, cats:['cat-02']},
  {id:'svc-12',name:'Facial',            color:'#10B981',dur:60, price:8000, cats:['cat-04']},
  {id:'svc-13',name:'Waxing',            color:'#84CC16',dur:15, price:2500, cats:['cat-04']},
  {id:'svc-14',name:"Men's Haircut",     color:'#3B82F6',dur:30, price:3500, cats:['cat-05']},
  {id:'svc-15',name:'Beard Trim',        color:'#78716C',dur:15, price:2000, cats:['cat-05']},
  {id:'svc-16',name:'Hot Towel Shave',   color:'#A3A3A3',dur:30, price:0,    cats:['cat-05']},
];

export function formatTimeFull(d) {
  var h = d.getHours(), m = d.getMinutes();
  return (h > 12 ? h - 12 : h === 0 ? 12 : h) + ':' + String(m).padStart(2, '0') + ' ' + (h >= 12 ? 'PM' : 'AM');
}

export function formatTimeShort(h, m) {
  return (h > 12 ? h - 12 : h === 0 ? 12 : h) + ':' + String(m).padStart(2, '0');
}

// Lock SVG icon for "Requested" badge
export function LockIcon({size=12,color='#FBBF24'}) {
  return(
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

// Avatar matching calendar column headers
var AVATAR_COLORS = ['#1E3A5F','#064E3B','#7C2D12','#4C1D95','#831843'];
function getInitials(n) { return (n || '').split(' ').filter(function(w) { return w; }).map(function(w) { return w[0]; }).join('').toUpperCase().slice(0, 2); }

export function TechAvatar({name,size=22,staffIndex=0,photo=null}) {
  if (photo) return(<img src={photo} alt={name} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>);
  return(
    <div style={{width:size,height:size,borderRadius:'50%',background:AVATAR_COLORS[staffIndex%AVATAR_COLORS.length],display:'flex',alignItems:'center',justifyContent:'center',color:'#E2E8F0',fontSize:size<24?9:11,fontWeight:500,flexShrink:0}}>{getInitials(name)}</div>
  );
}
