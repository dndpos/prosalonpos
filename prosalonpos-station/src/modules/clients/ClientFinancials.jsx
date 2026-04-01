import { useTheme } from '../../lib/ThemeContext';
import { fmt } from '../../lib/formatUtils';
/**
 * Pro Salon POS — Client Financials Panel
 * Session 7 Decision #169: Eight financial/program data points
 * All auto-calculated, read-only display.
 */



export default function ClientFinancials({ financials, storeCreditCents = 0 }) {
  var C = useTheme();
  if (!financials) return null;
  var f = financials;

  var items = [
    {
      label: 'Outstanding Balance',
      value: f.outstanding_balance_cents > 0 ? fmt(f.outstanding_balance_cents) : '$0.00',
      color: f.outstanding_balance_cents > 0 ? C.danger : C.success,
      warn: f.outstanding_balance_cents > 0,
    },
    {
      label: 'Store Credit',
      value: storeCreditCents > 0 ? fmt(storeCreditCents) : '$0.00',
      color: storeCreditCents > 0 ? C.success : C.textMuted,
    },
    {
      label: 'Gift Cards',
      value: f.gift_cards && f.gift_cards.length > 0
        ? f.gift_cards.map(function(gc) { return gc.code + ': ' + fmt(gc.balance_cents); }).join(', ')
        : 'None',
      color: f.gift_cards && f.gift_cards.length > 0 ? C.textPrimary : C.textMuted,
    },
    {
      label: 'Membership',
      value: f.membership
        ? f.membership.plan + ' (' + f.membership.status + ') — renews ' + f.membership.renewal
        : 'None',
      color: f.membership ? (f.membership.status === 'active' ? C.success : C.warning) : C.textMuted,
    },
    {
      label: 'Loyalty Points',
      value: f.loyalty_points > 0 ? f.loyalty_points.toLocaleString() + ' pts' : '0 pts',
      sub: f.lifetime_points > 0 ? f.lifetime_points.toLocaleString() + ' lifetime' : null,
      color: f.loyalty_points > 0 ? C.blue : C.textMuted,
    },
    {
      label: 'Lifetime Spend',
      value: fmt(f.lifetime_spend_cents),
      color: C.textPrimary,
    },
    {
      label: 'Total Visits',
      value: String(f.visit_count),
      color: C.textPrimary,
    },
    {
      label: 'Last Visit',
      value: f.last_visit || 'Never',
      color: f.last_visit ? C.textPrimary : C.textMuted,
    },
  ];

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ color: C.textPrimary, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, padding: '0 4px' }}>Financial & Programs</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {items.map(function(item, i) {
          return (
            <div key={i} style={{ padding: '12px 14px', background: C.chromeDark, borderRadius: 8, border: item.warn ? '1px solid ' + C.danger : '1px solid ' + C.borderLight }}>
              <div style={{ color: C.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{item.label}</div>
              <div style={{ color: item.color, fontSize: 14, fontWeight: 500, wordBreak: 'break-word' }}>{item.value}</div>
              {item.sub && <div style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>{item.sub}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
