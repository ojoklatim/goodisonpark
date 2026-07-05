import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'

export function StatCard({ label, title, value, prefix, suffix, trend, trendLabel, isCurrency, currency = 'UGX', icon: Icon, iconColor = "var(--gp-blue)", loading }) {
  const displayLabel = label || title
  const trendPos = trend > 0
  const trendNeg = trend < 0

  if (loading) {
    return (
      <div style={{
        background: "var(--gp-card)",
        border: '1px solid var(--gp-border-light)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        minHeight: '100px',
        justifyContent: 'center'
      }}>
        <div style={{ height: '14px', width: '60%', background: "var(--gp-border-light)", animation: 'pulse 1.5s infinite' }}></div>
        <div style={{ height: '28px', width: '40%', background: "var(--gp-border-light)", animation: 'pulse 1.5s infinite' }}></div>
      </div>
    )
  }

  const renderIcon = () => {
    if (!Icon) return null
    if (React.isValidElement(Icon)) {
      return Icon
    }
    return <Icon size={16} color={iconColor} />
  }

  return (
    <div style={{
      background: "var(--gp-card)",
      border: '1px solid var(--gp-border-light)',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {displayLabel}
        </span>
        {Icon && (
          <div style={{ width: 32, height: 32, background: `${iconColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {renderIcon()}
          </div>
        )}
      </div>

      <div style={{ fontSize: '28px', fontWeight: 800, color: "var(--gp-black)", lineHeight: 1 }}>
        {prefix && <span style={{ fontSize: '14px', fontWeight: 600, marginRight: 2 }}>{prefix}</span>}
        {isCurrency ? formatCurrency(value, currency) : (value ?? '—')}
        {suffix && <span style={{ fontSize: '14px', fontWeight: 600, marginLeft: 2 }}>{suffix}</span>}
      </div>

      {(trend !== undefined && trend !== null) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600 }}>
          {trendPos && <TrendingUp size={13} color="#22C55E" />}
          {trendNeg && <TrendingDown size={13} color="#EF4444" />}
          {!trendPos && !trendNeg && <Minus size={13} color="#9CA3AF" />}
          <span style={{ color: trendPos ? '#22C55E' : trendNeg ? '#EF4444' : '#9CA3AF' }}>
            {trendPos ? '+' : ''}{trend}%
          </span>
          {trendLabel && <span style={{ color: '#9CA3AF', fontWeight: 400 }}>{trendLabel}</span>}
        </div>
      )}
    </div>
  )
}
