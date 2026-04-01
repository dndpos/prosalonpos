import { useTheme } from '../../lib/ThemeContext';
/**
 * Pro Salon POS — Calendar Shared Components
 * Avatar + MiniMonth extracted from CalendarDayView
 */
import { AVATAR_COLORS, getInitials, Y, M, D } from '../../lib/calendarHelpers';

export function Avatar({name,size=32,index=0,photo=null}){
  var C = useTheme();
  if(photo) return(<img src={photo} alt={name} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>);
  return(<div style={{width:size,height:size,borderRadius:'50%',background:AVATAR_COLORS[index%AVATAR_COLORS.length],display:'flex',alignItems:'center',justifyContent:'center',color:C.textPrimary,fontSize:size<36?11:14,fontWeight:500,flexShrink:0}}>{getInitials(name)}</div>);
}

export function MiniMonth({monthOffset, selectedDate, onDateClick}){
  var C = useTheme();
  const base=new Date(Y,M+monthOffset,1);
  const mName=base.toLocaleDateString('en-US',{month:'long',year:'numeric'});
  const dim=new Date(base.getFullYear(),base.getMonth()+1,0).getDate();
  const sd=base.getDay();
  const cells=[];
  for(let i=0;i<sd;i++)cells.push(<div key={`e${i}`}/>);
  for(let d=1;d<=dim;d++){
    const isToday=monthOffset===0&&d===D;
    const thisDate=new Date(base.getFullYear(),base.getMonth(),d);
    const isSelected=selectedDate&&selectedDate.getFullYear()===thisDate.getFullYear()&&selectedDate.getMonth()===thisDate.getMonth()&&selectedDate.getDate()===thisDate.getDate();
    const bg=isToday?C.blue:isSelected?C.blueTint:'transparent';
    const clr=isToday?'#fff':isSelected?C.blueLight:C.textPrimary;
    const brd=isSelected&&!isToday?`1px solid ${C.blue}`:'none';
    cells.push(<div key={d} onClick={()=>onDateClick&&onDateClick(thisDate)} style={{display:'flex',alignItems:'center',justifyContent:'center',height:30,fontSize:13,color:clr,background:bg,border:brd,borderRadius:6,cursor:'pointer',fontWeight:isToday||isSelected?600:400}} onMouseEnter={e=>{if(!isToday&&!isSelected)e.currentTarget.style.background=C.grid;}} onMouseLeave={e=>{if(!isToday&&!isSelected)e.currentTarget.style.background='transparent';}}>{d}</div>);
  }
  return(
    <div style={{marginBottom:16,background:C.chromeDark,borderRadius:8,padding:'10px 10px 8px'}}>
      <div style={{fontSize:14,fontWeight:600,color:C.textPrimary,marginBottom:8,textAlign:'center'}}>{mName}</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2}}>
        {['S','M','T','W','T','F','S'].map((d,i)=><div key={i} style={{height:22,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:C.textMuted,fontWeight:500}}>{d}</div>)}
        {cells}
      </div>
    </div>
  );
}
