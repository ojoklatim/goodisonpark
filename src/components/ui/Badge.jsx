import React from 'react'

const statusConfig = {
  active:    { bg: '#DCFCE7', color: '#15803D', label: 'Active' },
  inactive:  { bg: '#FEE2E2', color: '#DC2626', label: 'Inactive' },
  pending:   { bg: '#FEF3C7', color: '#B45309', label: 'Pending' },
  approved:  { bg: '#DCFCE7', color: '#15803D', label: 'Approved' },
  rejected:  { bg: '#FEE2E2', color: '#DC2626', label: 'Rejected' },
  closed:    { bg: '#F3F4F6', color: '#6B7280', label: 'Closed' },
  cancelled: { bg: '#F3F4F6', color: '#6B7280', label: 'Cancelled' },
  draft:     { bg: '#F3F4F6', color: '#6B7280', label: 'Draft' },
  paid:      { bg: '#DCFCE7', color: '#15803D', label: 'Paid' },
  unpaid:    { bg: '#FEF3C7', color: '#B45309', label: 'Unpaid' },
  overdue:   { bg: '#FEE2E2', color: '#DC2626', label: 'Overdue' },
  partial:   { bg: '#EFF6FF', color: '#1D4ED8', label: 'Partial' },
  sent:      { bg: '#EFF6FF', color: '#1D4ED8', label: 'Sent' },
  accepted:  { bg: '#DCFCE7', color: '#15803D', label: 'Accepted' },
  expired:   { bg: '#F3F4F6', color: '#6B7280', label: 'Expired' },
  planning:  { bg: '#EFF6FF', color: '#1D4ED8', label: 'Planning' },
  on_hold:   { bg: '#FEF3C7', color: '#B45309', label: 'On Hold' },
  completed: { bg: '#DCFCE7', color: '#15803D', label: 'Completed' },
  new:       { bg: '#EFF6FF', color: '#1D4ED8', label: 'New' },
  converted: { bg: '#DCFCE7', color: '#15803D', label: 'Converted' },
  qualified: { bg: '#EFF6FF', color: '#1D4ED8', label: 'Qualified' },
  contacted: { bg: '#FEF3C7', color: '#B45309', label: 'Contacted' },
  todo:      { bg: '#F3F4F6', color: '#6B7280', label: 'To Do' },
  in_progress: { bg: '#EFF6FF', color: '#1D4ED8', label: 'In Progress' },
  in_review: { bg: '#FEF3C7', color: '#B45309', label: 'In Review' },
  done:      { bg: '#DCFCE7', color: '#15803D', label: 'Done' },
  reward:    { bg: '#DCFCE7', color: '#15803D', label: 'Reward' },
  penalty:   { bg: '#FEE2E2', color: '#DC2626', label: 'Penalty' },
  submitted: { bg: '#EFF6FF', color: '#1D4ED8', label: 'Submitted' },
  acknowledged: { bg: '#DCFCE7', color: '#15803D', label: 'Acknowledged' },
  processed: { bg: '#EFF6FF', color: '#1D4ED8', label: 'Processed' },
  trial:     { bg: '#F3F4F6', color: '#6B7280', label: 'Trial' },
  professional: { bg: '#EFF6FF', color: '#1D4ED8', label: 'Professional' },
  enterprise: { bg: "var(--gp-background)", color: "var(--gp-blue)", label: 'Enterprise' },
  starter:   { bg: '#F3F4F6', color: '#6B7280', label: 'Starter' },
  high:      { bg: '#FEE2E2', color: '#DC2626', label: 'High' },
  medium:    { bg: '#FEF3C7', color: '#B45309', label: 'Medium' },
  low:       { bg: '#F3F4F6', color: '#6B7280', label: 'Low' },
  critical:  { bg: '#FEE2E2', color: '#DC2626', label: 'Critical' },
}

export function Badge({ status, label, color, bg, variant, children }) {
  const resolvedStatus = status || variant;
  const config = statusConfig[resolvedStatus] || { bg: bg || '#F3F4F6', color: color || '#6B7280', label: label || resolvedStatus || '' }

  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      fontSize: '11px',
      fontWeight: 600,
      letterSpacing: '0.03em',
      textTransform: 'uppercase',
      background: config.bg,
      color: config.color,
      borderRadius: 0,
      whiteSpace: 'nowrap',
    }}>
      {children || label || config.label}
    </span>
  )
}
