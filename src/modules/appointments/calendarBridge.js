/**
 * Pro Salon POS — Calendar Bridge (Store → Component)
 * Centralized mock data for calendar day view.
 * All data here will move to Zustand stores + API in Phase 2.
 * In production (.exe), exports empty arrays so no fake data appears.
 */
import { t } from '../../lib/calendarHelpers';
import { isProduction } from '../../lib/apiClient';
import { useServiceStore } from '../../lib/stores/serviceStore';
import { useClientStore } from '../../lib/stores/clientStore';

var _prod = isProduction();

// ── Lazy getters ──
function _getServices() { return useServiceStore.getState().services || []; }
function _getClients() { return useClientStore.getState().clients || []; }

export const STAFF= _prod ? [] : [
  {id:'s17',display_name:'Andre',   photo_url:'https://i.pravatar.cc/150?img=33'},
  {id:'s2', display_name:'Ashley',  photo_url:'https://i.pravatar.cc/150?img=47'},
  {id:'s15',display_name:'Brandon', photo_url:'https://i.pravatar.cc/150?img=59'},
  {id:'s9', display_name:'Carlos',  photo_url:'https://i.pravatar.cc/150?img=14'},
  {id:'s19',display_name:'Chris',   photo_url:'https://i.pravatar.cc/150?img=68'},
  {id:'s5', display_name:'David',   photo_url:'https://i.pravatar.cc/150?img=12'},
  {id:'s14',display_name:'Diana',   photo_url:'https://i.pravatar.cc/150?img=23'},
  {id:'s3', display_name:'James',   photo_url:'https://i.pravatar.cc/150?img=52'},
  {id:'s10',display_name:'Jenny',   photo_url:'https://i.pravatar.cc/150?img=44'},
  {id:'s7', display_name:'Kevin',   photo_url:'https://i.pravatar.cc/150?img=57'},
  {id:'s20',display_name:'Laura',   photo_url:'https://i.pravatar.cc/150?img=24'},
  {id:'s11',display_name:'Marcus',  photo_url:'https://i.pravatar.cc/150?img=51'},
  {id:'s1', display_name:'Maria',   photo_url:'https://i.pravatar.cc/150?img=45'},
  {id:'s18',display_name:'Megan',   photo_url:'https://i.pravatar.cc/150?img=43'},
  {id:'s4', display_name:'Nicole',  photo_url:'https://i.pravatar.cc/150?img=32'},
  {id:'s12',display_name:'Olivia',  photo_url:'https://i.pravatar.cc/150?img=25'},
  {id:'s6', display_name:'Sandra',  photo_url:'https://i.pravatar.cc/150?img=26'},
  {id:'s16',display_name:'Sophia',  photo_url:'https://i.pravatar.cc/150?img=9'},
  {id:'s8', display_name:'Tiffany', photo_url:'https://i.pravatar.cc/150?img=49'},
  {id:'s13',display_name:'Tyler',   photo_url:'https://i.pravatar.cc/150?img=53'},
];

export const SETTINGS= _prod ? {open_hour:9,open_min:0,close_hour:19,close_min:0,buffer_minutes:30} : {open_hour:9,open_min:0,close_hour:19,close_min:0,buffer_minutes:30};

// SERVICE_PRICES — Proxy reads from serviceStore by service name
var _staticPrices = {"Women's Cut":5500,'Full Color':12000,'Blowout':3500,'Highlights':15000,'Updo':7500,'Balayage':20000,"Men's Cut":3500,'Beard Trim':2000,'Deep Cond.':4000,'Manicure':3000,'Pedicure':4500,'Gel Mani':4500,'Facial':8000,'Waxing':2500};

export var SERVICE_PRICES = new Proxy(_staticPrices, {
  get: function(defaults, key) {
    if (typeof key === 'symbol') return defaults[key];
    var services = _getServices();
    if (services.length > 0) {
      var match = services.find(function(s) { return s.name === key; });
      if (match) return match.price_cents;
    }
    return defaults[key] || 0;
  }
});

export const INITIAL_SERVICE_LINES= _prod ? [] : [
  {id:'sl1',staff_id:'s1',starts_at:t(9,0),dur:45,color:'#EF4444',client:'Sarah M.',service:"Women's Cut",status:'confirmed',requested:true},
  {id:'sl2',staff_id:'s1',starts_at:t(10,0),dur:90,color:'#8B5CF6',client:'Lisa T.',service:'Full Color',status:'in_progress',requested:true},
  {id:'sl3',staff_id:'s1',starts_at:t(13,0),dur:30,color:'#EC4899',client:'Maria V.',service:'Blowout',status:'pending',requested:false},
  {id:'sl4',staff_id:'s1',starts_at:t(14,0),dur:45,color:'#EF4444',client:'Emma D.',service:"Women's Cut",status:'confirmed',requested:true},
  {id:'sl5',staff_id:'s2',starts_at:t(9,0),dur:120,color:'#F59E0B',client:'James R.',service:'Highlights',status:'in_progress',requested:true},
  {id:'sl6',staff_id:'s2',starts_at:t(12,0),dur:60,color:'#D946EF',client:'Kate J.',service:'Updo',status:'confirmed',requested:false},
  {id:'sl7',staff_id:'s2',starts_at:t(14,0),dur:150,color:'#6366F1',client:'Nina L.',service:'Balayage',status:'pending',requested:true},
  {id:'sl8',staff_id:'s3',starts_at:t(9,0),dur:30,color:'#3B82F6',client:'Dan B.',service:"Men's Cut",status:'completed',requested:false,payment_method:'cash'},
  {id:'sl9',staff_id:'s3',starts_at:t(9,45),dur:15,color:'#78716C',client:'Robert C.',service:'Beard Trim',status:'confirmed',requested:true},
  {id:'sl10',staff_id:'s3',starts_at:t(10,30),dur:30,color:'#3B82F6',client:'Dan B.',service:"Men's Cut",status:'checked_in',requested:false},
  {id:'sl11',staff_id:'s3',starts_at:t(13,0),dur:30,color:'#F97316',client:'Tina W.',service:'Deep Cond.',status:'pending',requested:false},
  {id:'sl12',staff_id:'s4',starts_at:t(9,0),dur:30,color:'#06B6D4',client:'Amy K.',service:'Manicure',status:'completed',requested:true,payment_method:'credit'},
  {id:'sl13',staff_id:'s4',starts_at:t(9,45),dur:45,color:'#14B8A6',client:'Rachel P.',service:'Pedicure',status:'in_progress',requested:true},
  {id:'sl14',staff_id:'s4',starts_at:t(11,0),dur:45,color:'#2DD4BF',client:'Lisa T.',service:'Gel Mani',status:'confirmed',requested:false},
  {id:'sl15',staff_id:'s4',starts_at:t(13,0),dur:30,color:'#06B6D4',client:'Emma D.',service:'Manicure',status:'pending',requested:true},
  {id:'sl16',staff_id:'s5',starts_at:t(9,0),dur:60,color:'#10B981',client:'Rachel P.',service:'Facial',status:'confirmed',requested:true},
  {id:'sl17',staff_id:'s5',starts_at:t(10,30),dur:15,color:'#84CC16',client:'Tina W.',service:'Waxing',status:'confirmed',requested:false},
  {id:'sl18',staff_id:'s5',starts_at:t(11,0),dur:60,color:'#10B981',client:'Kate J.',service:'Facial',status:'pending',requested:true},
  {id:'sl19',staff_id:'s6',starts_at:t(9,0),dur:45,color:'#EF4444',client:'Wendy F.',service:"Women's Cut",status:'confirmed',requested:true},
  {id:'sl20',staff_id:'s6',starts_at:t(10,30),dur:90,color:'#8B5CF6',client:'Pam G.',service:'Full Color',status:'in_progress',requested:false},
  {id:'sl21',staff_id:'s6',starts_at:t(14,0),dur:30,color:'#EC4899',client:'Joy H.',service:'Blowout',status:'pending',requested:false},
  {id:'sl22',staff_id:'s7',starts_at:t(9,0),dur:30,color:'#3B82F6',client:'Steve L.',service:"Men's Cut",status:'confirmed',requested:true},
  {id:'sl23',staff_id:'s7',starts_at:t(10,0),dur:15,color:'#78716C',client:'Mike R.',service:'Beard Trim',status:'completed',requested:false},
  {id:'sl24',staff_id:'s7',starts_at:t(11,0),dur:30,color:'#3B82F6',client:'Tom S.',service:"Men's Cut",status:'checked_in',requested:true},
  {id:'sl25',staff_id:'s7',starts_at:t(14,0),dur:30,color:'#3B82F6',client:'Alex T.',service:"Men's Cut",status:'pending',requested:false},
  {id:'sl26',staff_id:'s8',starts_at:t(9,0),dur:30,color:'#06B6D4',client:'Rose W.',service:'Manicure',status:'confirmed',requested:true},
  {id:'sl27',staff_id:'s8',starts_at:t(10,0),dur:45,color:'#14B8A6',client:'Helen Z.',service:'Pedicure',status:'in_progress',requested:false},
  {id:'sl28',staff_id:'s8',starts_at:t(12,0),dur:45,color:'#2DD4BF',client:'Grace A.',service:'Gel Mani',status:'confirmed',requested:true},
  {id:'sl29',staff_id:'s9',starts_at:t(9,30),dur:45,color:'#EF4444',client:'Linda B.',service:"Women's Cut",status:'confirmed',requested:false},
  {id:'sl30',staff_id:'s9',starts_at:t(11,0),dur:120,color:'#F59E0B',client:'Susan C.',service:'Highlights',status:'in_progress',requested:true},
  {id:'sl31',staff_id:'s9',starts_at:t(14,30),dur:30,color:'#EC4899',client:'Carol D.',service:'Blowout',status:'pending',requested:false},
  {id:'sl32',staff_id:'s10',starts_at:t(9,0),dur:60,color:'#10B981',client:'Beth E.',service:'Facial',status:'confirmed',requested:true},
  {id:'sl33',staff_id:'s10',starts_at:t(10,30),dur:15,color:'#84CC16',client:'Judy F.',service:'Waxing',status:'confirmed',requested:false},
  {id:'sl34',staff_id:'s10',starts_at:t(13,0),dur:60,color:'#10B981',client:'Ann G.',service:'Facial',status:'pending',requested:true},
  {id:'sl35',staff_id:'s11',starts_at:t(9,0),dur:30,color:'#3B82F6',client:'Paul H.',service:"Men's Cut",status:'confirmed',requested:true},
  {id:'sl36',staff_id:'s11',starts_at:t(10,0),dur:150,color:'#6366F1',client:'Rick J.',service:'Balayage',status:'in_progress',requested:false},
  {id:'sl37',staff_id:'s12',starts_at:t(9,0),dur:45,color:'#D946EF',client:'Mary K.',service:'Updo',status:'confirmed',requested:true},
  {id:'sl38',staff_id:'s12',starts_at:t(10,30),dur:90,color:'#8B5CF6',client:'Jane L.',service:'Full Color',status:'in_progress',requested:true},
  {id:'sl39',staff_id:'s12',starts_at:t(14,0),dur:45,color:'#EF4444',client:'Pat M.',service:"Women's Cut",status:'pending',requested:false},
  {id:'sl40',staff_id:'s13',starts_at:t(9,0),dur:30,color:'#3B82F6',client:'Joe N.',service:"Men's Cut",status:'completed',requested:false},
  {id:'sl41',staff_id:'s13',starts_at:t(10,0),dur:15,color:'#78716C',client:'Bill P.',service:'Beard Trim',status:'confirmed',requested:true},
  {id:'sl42',staff_id:'s13',starts_at:t(13,0),dur:30,color:'#F97316',client:'Ed Q.',service:'Deep Cond.',status:'pending',requested:false},
  {id:'sl43',staff_id:'s14',starts_at:t(9,0),dur:30,color:'#06B6D4',client:'Fay R.',service:'Manicure',status:'confirmed',requested:true},
  {id:'sl44',staff_id:'s14',starts_at:t(10,0),dur:45,color:'#14B8A6',client:'Gina S.',service:'Pedicure',status:'in_progress',requested:false},
  {id:'sl45',staff_id:'s14',starts_at:t(12,30),dur:30,color:'#06B6D4',client:'Ivy T.',service:'Manicure',status:'pending',requested:true},
  {id:'sl46',staff_id:'s15',starts_at:t(9,30),dur:60,color:'#10B981',client:'Kim U.',service:'Facial',status:'confirmed',requested:true},
  {id:'sl47',staff_id:'s15',starts_at:t(11,0),dur:15,color:'#84CC16',client:'Liz V.',service:'Waxing',status:'confirmed',requested:false},
  {id:'sl48',staff_id:'s16',starts_at:t(9,0),dur:120,color:'#F59E0B',client:'Meg W.',service:'Highlights',status:'in_progress',requested:true},
  {id:'sl49',staff_id:'s16',starts_at:t(13,0),dur:150,color:'#6366F1',client:'Nan X.',service:'Balayage',status:'pending',requested:false},
  {id:'sl50',staff_id:'s17',starts_at:t(9,0),dur:30,color:'#3B82F6',client:'Owen Y.',service:"Men's Cut",status:'confirmed',requested:true},
  {id:'sl51',staff_id:'s17',starts_at:t(10,0),dur:45,color:'#EF4444',client:'Vera Z.',service:"Women's Cut",status:'in_progress',requested:false},
  {id:'sl52',staff_id:'s17',starts_at:t(14,0),dur:30,color:'#EC4899',client:'Zoe A.',service:'Blowout',status:'pending',requested:true},
  {id:'sl53',staff_id:'s18',starts_at:t(9,0),dur:45,color:'#D946EF',client:'Bri B.',service:'Updo',status:'confirmed',requested:false},
  {id:'sl54',staff_id:'s18',starts_at:t(11,0),dur:90,color:'#8B5CF6',client:'Dee C.',service:'Full Color',status:'in_progress',requested:true},
  {id:'sl55',staff_id:'s19',starts_at:t(9,0),dur:15,color:'#78716C',client:'Eli D.',service:'Beard Trim',status:'completed',requested:false},
  {id:'sl56',staff_id:'s19',starts_at:t(9,30),dur:30,color:'#3B82F6',client:'Finn E.',service:"Men's Cut",status:'confirmed',requested:true},
  {id:'sl57',staff_id:'s19',starts_at:t(13,0),dur:30,color:'#F97316',client:'Gus F.',service:'Deep Cond.',status:'pending',requested:false},
  {id:'sl58',staff_id:'s20',starts_at:t(9,0),dur:30,color:'#06B6D4',client:'Hope G.',service:'Manicure',status:'confirmed',requested:true},
  {id:'sl59',staff_id:'s20',starts_at:t(10,0),dur:45,color:'#2DD4BF',client:'Iris H.',service:'Gel Mani',status:'in_progress',requested:false},
  {id:'sl60',staff_id:'s20',starts_at:t(12,0),dur:45,color:'#14B8A6',client:'Jean J.',service:'Pedicure',status:'pending',requested:true},
  {id:'sl61',staff_id:'s1',starts_at:t(15,0),dur:90,color:'#8B5CF6',client:'Tammy R.',service:'Full Color',status:'confirmed',requested:true},
  {id:'sl62',staff_id:'s1',starts_at:t(16,30),dur:30,color:'#EC4899',client:'Tammy R.',service:'Blowout',status:'confirmed',requested:true},
  {id:'sl63',staff_id:'s4',starts_at:t(14,0),dur:45,color:'#14B8A6',client:'Wendy F.',service:'Pedicure',status:'pending',requested:false},
  {id:'sl64',staff_id:'s4',starts_at:t(14,45),dur:45,color:'#2DD4BF',client:'Wendy F.',service:'Gel Mani',status:'pending',requested:false},
  {id:'sl65',staff_id:'s2',starts_at:t(17,0),dur:45,color:'#EF4444',client:'Sophie K.',service:"Women's Cut",status:'pending',requested:true},
  {id:'sl66',staff_id:'s2',starts_at:t(17,45),dur:30,color:'#EC4899',client:'Sophie K.',service:'Blowout',status:'pending',requested:true},
  {id:'sl67',staff_id:'s2',starts_at:t(18,15),dur:30,color:'#F97316',client:'Sophie K.',service:'Deep Cond.',status:'pending',requested:true},
  // Overlapping appointments — demonstrates side-by-side split
  {id:'sl70',staff_id:'s3',starts_at:t(11,0),dur:60,color:'#10B981',client:'Amy K.',service:'Facial',status:'confirmed',requested:true},
  {id:'sl71',staff_id:'s3',starts_at:t(11,15),dur:45,color:'#EF4444',client:'Grace A.',service:"Women's Cut",status:'pending',requested:false},
  {id:'sl72',staff_id:'s5',starts_at:t(13,0),dur:60,color:'#8B5CF6',client:'Linda B.',service:'Full Color',status:'confirmed',requested:true},
  {id:'sl73',staff_id:'s5',starts_at:t(13,15),dur:45,color:'#06B6D4',client:'Rose W.',service:'Manicure',status:'pending',requested:false},
  {id:'sl74',staff_id:'s5',starts_at:t(13,30),dur:30,color:'#84CC16',client:'Judy F.',service:'Waxing',status:'confirmed',requested:false},
  // Online bookings — already on the calendar, staff gets notified via Online Bookings tab
  {id:'ob1',staff_id:'s1',starts_at:t(11,30),dur:120,color:'#F59E0B',client:'Amanda W.',service:'Highlights',status:'pending',requested:true,source:'online'},
  {id:'ob2',staff_id:'s3',starts_at:t(14,0),dur:30,color:'#3B82F6',client:'Derek N.',service:"Men's Cut",status:'pending',requested:true,source:'online'},
  {id:'ob3',staff_id:'s2',starts_at:t(11,15),dur:150,color:'#6366F1',client:'Priya P.',service:'Balayage',status:'pending',requested:true,source:'online'},
  {id:'ob4',staff_id:'s4',starts_at:t(16,0),dur:45,color:'#2DD4BF',client:'Hannah B.',service:'Gel Mani',status:'pending',requested:false,source:'online'},
].map(sl=>({...sl, price_cents: SERVICE_PRICES[sl.service]||0}));

export const INITIAL_WAITLIST= _prod ? [] : [
  {id:'w1',client:'Maria V.',service:'Blowout',walk_in:true,requested:null,checked_in_at:Date.now()-32*60000,is_vip:false},
  {id:'w2',client:'Emma D.',service:"Women's Cut",walk_in:false,requested:'Maria',checked_in_at:Date.now()-12*60000,is_vip:false},
  {id:'w3',client:'Robert C.',service:'Beard Trim',walk_in:true,requested:null,checked_in_at:Date.now()-5*60000,is_vip:false},
  {id:'w4',client:'Sarah M.',service:'Blowout',walk_in:false,requested:'Ashley',checked_in_at:Date.now()-2*60000,is_vip:true},
];

export const INITIAL_TECH_TURN= _prod ? [] : [
  {id:'s3',name:'James',status:'available',position:1},
  {id:'s5',name:'David',status:'available',position:2},
  {id:'s13',name:'Tyler',status:'available',position:3},
  {id:'s15',name:'Brandon',status:'available',position:4},
  {id:'s19',name:'Chris',status:'available',position:5},
  {id:'s1',name:'Maria',status:'busy',position:null},
  {id:'s2',name:'Ashley',status:'busy',position:null},
  {id:'s4',name:'Nicole',status:'busy',position:null},
  {id:'s6',name:'Sandra',status:'busy',position:null},
  {id:'s7',name:'Kevin',status:'busy',position:null},
  {id:'s8',name:'Tiffany',status:'busy',position:null},
  {id:'s9',name:'Carlos',status:'busy',position:null},
  {id:'s10',name:'Jenny',status:'busy',position:null},
  {id:'s11',name:'Marcus',status:'busy',position:null},
  {id:'s12',name:'Olivia',status:'busy',position:null},
  {id:'s14',name:'Diana',status:'busy',position:null},
  {id:'s16',name:'Sophia',status:'busy',position:null},
  {id:'s17',name:'Andre',status:'busy',position:null},
  {id:'s18',name:'Megan',status:'busy',position:null},
  {id:'s20',name:'Laura',status:'busy',position:null},
].map(t=>{const s=STAFF.find(st=>st.id===t.id);return{...t,photo_url:s?.photo_url||null};});

// CLIENT_INFO — Proxy reads from clientStore by display name ("First L." format)
var _staticClientInfo = _prod ? {} : {
  'Sarah M.':{phone:'(561) 555-0101',notes:'Prefers layers, sensitive scalp'},
  'Lisa T.':{phone:'(561) 555-0103',notes:'Color-treated, use sulfate-free'},
  'Maria V.':{phone:'(561) 555-0106',notes:''},
  'Emma D.':{phone:'(561) 555-0112',notes:'Running late usually'},
  'James R.':{phone:'(561) 555-0102',notes:''},
  'Kate J.':{phone:'(561) 555-0109',notes:'Likes volume at roots'},
  'Nina L.':{phone:'(561) 555-0108',notes:'First time client'},
  'Dan B.':{phone:'(561) 555-0107',notes:'Buzz #2 sides, trim top'},
  'Robert C.':{phone:'(561) 555-0111',notes:''},
  'Tina W.':{phone:'(561) 555-0110',notes:'Deep cond after every color'},
  'Amy K.':{phone:'(561) 555-0104',notes:'Gel only, no regular polish'},
  'Rachel P.':{phone:'(561) 555-0105',notes:''},
  'Steve L.':{phone:'(561) 555-0120',notes:''},
  'Mike R.':{phone:'(561) 555-0121',notes:'Keep beard shape, just clean up'},
  'Tom S.':{phone:'(561) 555-0122',notes:''},
  'Alex T.':{phone:'(561) 555-0123',notes:''},
  'Rose W.':{phone:'(561) 555-0124',notes:''},
  'Helen Z.':{phone:'(561) 555-0125',notes:'French tips'},
  'Grace A.':{phone:'(561) 555-0126',notes:''},
  'Linda B.':{phone:'(561) 555-0127',notes:''},
  'Susan C.':{phone:'(561) 555-0128',notes:'Full foil, face-framing'},
  'Carol D.':{phone:'(561) 555-0129',notes:''},
  'Beth E.':{phone:'(561) 555-0130',notes:'Sensitive skin, hypoallergenic'},
  'Judy F.':{phone:'(561) 555-0131',notes:''},
  'Ann G.':{phone:'(561) 555-0132',notes:''},
};

export var CLIENT_INFO = new Proxy(_staticClientInfo, {
  get: function(defaults, key) {
    if (typeof key === 'symbol') return defaults[key];
    // Try clientStore first — match by "First L." display name
    var clients = _getClients();
    if (clients.length > 0) {
      var match = clients.find(function(c) {
        var display = (c.first_name || '') + ' ' + ((c.last_name || '')[0] || '') + '.';
        return display === key;
      });
      if (match) return { phone: match.phone || '', notes: match.notes || '' };
      // Also try full name match
      var fullMatch = clients.find(function(c) {
        return (c.first_name + ' ' + c.last_name) === key;
      });
      if (fullMatch) return { phone: fullMatch.phone || '', notes: fullMatch.notes || '' };
    }
    return defaults[key];
  }
});
