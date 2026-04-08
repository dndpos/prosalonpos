import { useTheme } from '../../lib/ThemeContext';
import { useAppointmentStore } from '../../lib/stores/appointmentStore';

export default function DateStatusDot() {
  var C = useTheme();
  var loading = useAppointmentStore(function(s) { return s.loading; });
  var source = useAppointmentStore(function(s) { return s.source; });

  if (loading) {
    return (<span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid ' + C.borderMedium, borderTopColor: C.blueLight, borderRadius: '50%', animation: 'spinDate 0.6s linear infinite' }} />);
  }
  return (<span title={source === 'api' ? 'Live data' : 'Mock data'} style={{ width: 7, height: 7, borderRadius: '50%', background: source === 'api' ? '#22C55E' : '#EAB308', flexShrink: 0 }} />);
}
