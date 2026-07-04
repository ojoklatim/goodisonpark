import React from 'react'
import { Modal } from './Modal'

/**
 * Generic read-only detail view for a table row.
 * fields: [{ label, value }] — pass already-formatted values (dates, currency, names resolved).
 * Used by list pages that don't have their own dedicated detail page/drawer.
 */
export function RecordDetailModal({ isOpen, onClose, title, fields = [], footer }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px 24px',
      }}>
        {fields.map((f, i) => (
          <div key={i} style={{ minWidth: 0 }}>
            <div style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
              {f.label}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--gp-black)', wordBreak: 'break-word' }}>
              {f.value === null || f.value === undefined || f.value === '' ? '—' : f.value}
            </div>
          </div>
        ))}
      </div>
      {footer && <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>{footer}</div>}
    </Modal>
  )
}
