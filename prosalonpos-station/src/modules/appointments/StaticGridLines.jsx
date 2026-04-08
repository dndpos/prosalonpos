import { memo } from 'react';
import { useTheme } from '../../lib/ThemeContext';

export default memo(function StaticGridLines({ totalRows, gridStartMin, ROW_H, colW, staffCount }) {
  var C = useTheme();
  return (
    <>
      {Array.from({ length: totalRows }, function(_, i) {
        var min = gridStartMin + i * 15;
        var m = min % 60;
        var isHour = m === 0, isHalf = m === 30;
        var yPos = i * ROW_H;
        var borderTop;
        if (isHour) { borderTop = '2px solid ' + C.gridLineHour; }
        else if (isHalf) { borderTop = '1px dashed ' + C.gridLineHalf; }
        else { borderTop = '1px solid ' + C.gridLineQuarter; }
        return (<div key={'g' + i} style={{ position: 'absolute', top: yPos, left: 0, right: 0, height: ROW_H, borderTop: borderTop }} />);
      })}
      {colW > 0 && Array.from({ length: staffCount }, function(_, i) {
        if (i === 0) return null;
        return (<div key={'vd-' + i} style={{ position: 'absolute', top: 0, bottom: 0, left: i * colW, width: 0, borderLeft: '1px solid ' + C.colDivider, zIndex: 1, pointerEvents: 'none' }} />);
      })}
      {colW > 0 && <div style={{ position: 'absolute', top: 0, bottom: 0, left: staffCount * colW, width: 0, borderLeft: '1px solid ' + C.colDivider, zIndex: 1, pointerEvents: 'none' }} />}
    </>
  );
});
