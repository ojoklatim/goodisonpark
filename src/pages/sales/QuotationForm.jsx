import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { ArrowLeft, Plus, Trash2, Printer } from 'lucide-react'

export function QuotationForm() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const { company, user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState({
    quotation_number: '',
    client_id: '',
    deal_id: '',
    status: 'draft',
    valid_until: '',
    notes: '',
    tax_rate: 0,
    items: []
  })

  // Fetch Quotation if editing
  const { data: quotation, isLoading: qLoading } = useQuery({
    queryKey: ['quotation', id],
    queryFn: async () => {
      if (isNew) return null
      const { data, error } = await insforge.from('quotations').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
    enabled: !isNew
  })

  useEffect(() => {
    if (quotation) {
      setFormData({
        quotation_number: quotation.quotation_number || '',
        client_id: quotation.client_id || '',
        deal_id: quotation.deal_id || '',
        status: quotation.status || 'draft',
        valid_until: quotation.valid_until || '',
        notes: quotation.notes || '',
        tax_rate: quotation.tax_rate || 0,
        items: quotation.items || []
      })
    } else if (isNew) {
      setFormData(prev => ({ ...prev, quotation_number: `QT-${Math.floor(1000 + Math.random() * 9000)}` }))
    }
  }, [quotation, isNew])

  // Fetch dependencies
  const { data: clients = [] } = useQuery({
    queryKey: ['clients', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge.from('clients').select('id, name').eq('company_id', company?.id)
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const { data: deals = [] } = useQuery({
    queryKey: ['deals', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge.from('deals').select('id, title').eq('company_id', company?.id)
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { description: '', qty: 1, unit_price: 0, total: 0 }]
    }))
  }

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items]
    newItems[index][field] = value
    if (field === 'qty' || field === 'unit_price') {
      newItems[index].total = Number(newItems[index].qty) * Number(newItems[index].unit_price)
    }
    setFormData(prev => ({ ...prev, items: newItems }))
  }

  const handleRemoveItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index)
    setFormData(prev => ({ ...prev, items: newItems }))
  }

  const subtotal = formData.items.reduce((sum, item) => sum + Number(item.total), 0)
  const taxAmount = (subtotal * Number(formData.tax_rate)) / 100
  const grandTotal = subtotal + taxAmount

  const saveQuotation = useMutation({
    mutationFn: async (statusOverride) => {
      const payload = {
        company_id: company.id,
        quotation_number: formData.quotation_number,
        client_id: formData.client_id || null,
        deal_id: formData.deal_id || null,
        status: statusOverride || formData.status,
        valid_until: formData.valid_until || null,
        notes: formData.notes,
        tax_rate: formData.tax_rate,
        items: formData.items,
        subtotal,
        tax_amount: taxAmount,
        total: grandTotal,
        created_by: user.id
      }

      if (isNew) {
        const { error } = await insforge.from('quotations').insert([payload])
        if (error) throw error
      } else {
        const { error } = await insforge.from('quotations').update(payload).eq('id', id)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['quotations', company?.id])
      navigate('/dashboard/sales/quotations')
    }
  })

  const handlePrint = () => {
    window.print()
  }

  if (qLoading) return <div>Loading...</div>

  return (
    <div className="print-container" style={{ paddingBottom: '64px' }}>
      
      {/* Non-printable Header */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button onClick={() => navigate('/dashboard/sales/quotations')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#6B7280' }}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: "var(--gp-black)" }}>
          {isNew ? 'New Quotation' : `Edit Quotation ${formData.quotation_number}`}
        </h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px' }}>
          <Button variant="secondary" onClick={handlePrint}><Printer size={16} style={{ marginRight: '8px' }} /> Print / PDF</Button>
          <Button variant="secondary" onClick={() => saveQuotation.mutate('draft')}>Save Draft</Button>
          <Button variant="primary" onClick={() => saveQuotation.mutate('sent')}>Save & Send</Button>
        </div>
      </div>

      {/* Printable Area */}
      <div style={{ background: "var(--gp-card)", border: "1px solid var(--gp-border-light)", padding: '48px', maxWidth: '900px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '48px' }}>
          <div>
            {company?.logo_url && <img src={company.logo_url} alt="Logo" style={{ height: '48px', marginBottom: '16px' }} />}
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>{company?.name}</h2>
            <p style={{ margin: '4px 0 0 0', color: '#6B7280', fontSize: '14px', whiteSpace: 'pre-line' }}>
              {company?.address}<br/>{company?.city}, {company?.country}<br/>{company?.email}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h1 style={{ margin: 0, fontSize: '32px', fontWeight: 800, color: "var(--gp-black)", textTransform: 'uppercase' }}>Quotation</h1>
            <div className="no-print" style={{ display: 'inline-block', width: '200px', marginTop: '16px' }}>
              <Input label="Quote #" value={formData.quotation_number} onChange={e => setFormData({...formData, quotation_number: e.target.value})} />
            </div>
            <div className="print-only" style={{ marginTop: '16px', fontWeight: 600 }}>{formData.quotation_number}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '48px' }}>
          <div className="no-print">
            <Select label="Client" value={formData.client_id} onChange={e => setFormData({...formData, client_id: e.target.value})} options={[{value: '', label: 'Select Client'}, ...clients.map(c => ({value: c.id, label: c.name}))]} />
            <div style={{ marginTop: '16px' }}>
              <Select label="Linked Deal (Optional)" value={formData.deal_id} onChange={e => setFormData({...formData, deal_id: e.target.value})} options={[{value: '', label: 'None'}, ...deals.map(d => ({value: d.id, label: d.title}))]} />
            </div>
          </div>
          
          <div className="print-only">
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#6B7280' }}>Prepared For:</h4>
            <p style={{ margin: 0, fontWeight: 600 }}>{clients.find(c => c.id === formData.client_id)?.name || 'Unknown Client'}</p>
          </div>

          <div>
            <div className="no-print">
              <Input label="Valid Until" type="date" value={formData.valid_until} onChange={e => setFormData({...formData, valid_until: e.target.value})} />
            </div>
            <div className="print-only">
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#6B7280' }}>Valid Until:</h4>
              <p style={{ margin: 0, fontWeight: 600 }}>{formData.valid_until || '-'}</p>
            </div>
            <div className="no-print" style={{ marginTop: '16px' }}>
              <Select label="Status" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} options={['draft', 'sent', 'accepted', 'rejected', 'expired'].map(s => ({value: s, label: s}))} />
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '48px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr>
                <th style={{ padding: '12px', background: "var(--gp-background)", color: '#FFF', fontWeight: 600, fontSize: '14px' }}>Description</th>
                <th style={{ padding: '12px', background: "var(--gp-background)", color: '#FFF', fontWeight: 600, fontSize: '14px', width: '100px' }}>Qty</th>
                <th style={{ padding: '12px', background: "var(--gp-background)", color: '#FFF', fontWeight: 600, fontSize: '14px', width: '150px' }}>Unit Price (UGX)</th>
                <th style={{ padding: '12px', background: "var(--gp-background)", color: '#FFF', fontWeight: 600, fontSize: '14px', width: '150px' }}>Total (UGX)</th>
                <th className="no-print" style={{ background: "var(--gp-background)", width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {formData.items.map((item, index) => (
                <tr key={index} style={{ borderBottom: "1px solid var(--gp-border-light)" }}>
                  <td style={{ padding: '8px' }}>
                    <input type="text" className="no-border-input" value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} placeholder="Item description" style={{ width: '100%', padding: '8px', border: '1px solid transparent', borderRadius: 0 }} />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <input type="number" className="no-border-input" value={item.qty} onChange={e => handleItemChange(index, 'qty', e.target.value)} min="1" style={{ width: '100%', padding: '8px', border: '1px solid transparent', borderRadius: 0 }} />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <input type="number" className="no-border-input" value={item.unit_price} onChange={e => handleItemChange(index, 'unit_price', e.target.value)} min="0" style={{ width: '100%', padding: '8px', border: '1px solid transparent', borderRadius: 0 }} />
                  </td>
                  <td style={{ padding: '16px 8px', fontWeight: 500 }}>
                    {item.total.toLocaleString()}
                  </td>
                  <td className="no-print" style={{ padding: '8px', textAlign: 'center' }}>
                    <button onClick={() => handleRemoveItem(index)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="no-print" style={{ marginTop: '12px' }}>
            <Button variant="ghost" onClick={handleAddItem}><Plus size={16} style={{ marginRight: '8px' }} /> Add Item</Button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '48px' }}>
          <div style={{ width: '300px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span style={{ color: '#6B7280' }}>Subtotal:</span>
              <span style={{ fontWeight: 600 }}>UGX {subtotal.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', alignItems: 'center' }}>
              <span style={{ color: '#6B7280' }}>Tax Rate (%):</span>
              <div className="no-print" style={{ width: '80px' }}>
                <input type="number" value={formData.tax_rate} onChange={e => setFormData({...formData, tax_rate: e.target.value})} style={{ width: '100%', padding: '4px 8px', border: '1px solid #D1D5DB', borderRadius: 0 }} />
              </div>
              <span className="print-only">{formData.tax_rate}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span style={{ color: '#6B7280' }}>Tax Amount:</span>
              <span style={{ fontWeight: 600 }}>UGX {taxAmount.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0', borderTop: '2px solid #0A0A0A', marginTop: '8px' }}>
              <span style={{ fontSize: '18px', fontWeight: 700, color: "var(--gp-black)" }}>Total:</span>
              <span style={{ fontSize: '18px', fontWeight: 700, color: "var(--gp-blue)" }}>UGX {grandTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: "var(--gp-black)" }}>Notes / Terms</h4>
          <textarea 
            className="no-print"
            value={formData.notes}
            onChange={e => setFormData({...formData, notes: e.target.value})}
            placeholder="Add any terms, conditions, or notes here..."
            style={{ width: '100%', minHeight: '100px', padding: '12px', border: '1px solid #D1D5DB', borderRadius: 0, fontFamily: 'inherit' }}
          />
          <div className="print-only" style={{ whiteSpace: 'pre-line', fontSize: '14px', color: '#4B5563' }}>
            {formData.notes}
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          .print-container, .print-container * { visibility: visible; }
          .print-container { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .no-border-input { border: none !important; padding: 0 !important; font-family: inherit; }
        }
        @media screen {
          .print-only { display: none !important; }
          .no-border-input:focus { border: 1px solid #38BDF8 !important; outline: none; }
        }
      `}} />
    </div>
  )
}
