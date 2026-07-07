import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { ArrowLeft, Plus, Trash2, Download } from 'lucide-react'
import { format } from 'date-fns'

const DEFAULT_TERMS = `This quotation is valid for 30 days from the date of issue.
Payment terms: 50% advance payment and 50% upon completion.
Prices are quoted in Uganda Shillings (UGX).
Any additional work outside the scope quoted will be charged separately.
Payment may be made by bank transfer, mobile money, or cheque.`

export function QuotationForm() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const { company, role, profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const printRef = useRef(null)
  const [isExporting, setIsExporting] = useState(false)

  const [formData, setFormData] = useState({
    quotation_number: '',
    client_id: '',
    deal_id: location.state?.deal_id || '',
    status: 'draft',
    subject: 'Quotation for Services',
    valid_until: '',
    terms: DEFAULT_TERMS,
    notes: '',
    tax_rate: 18,
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

  // Count existing quotations to build the next sequential number for new ones
  const { data: quotationCount } = useQuery({
    queryKey: ['quotations_count', company?.id],
    queryFn: async () => {
      const { count, error } = await insforge.from('quotations').select('*', { count: 'exact', head: true }).eq('company_id', company?.id)
      if (error) throw error
      return count || 0
    },
    enabled: !!company?.id && isNew
  })

  useEffect(() => {
    if (quotation) {
      setFormData({
        quotation_number: quotation.quotation_number || '',
        client_id: quotation.client_id || '',
        deal_id: quotation.deal_id || '',
        status: quotation.status || 'draft',
        subject: quotation.subject || 'Quotation for Services',
        valid_until: quotation.valid_until || '',
        terms: quotation.terms || DEFAULT_TERMS,
        notes: quotation.notes || '',
        tax_rate: quotation.tax_rate ?? 18,
        items: quotation.items || []
      })
    } else if (isNew && quotationCount !== undefined) {
      const year = new Date().getFullYear()
      const seq = String(quotationCount + 1).padStart(3, '0')
      setFormData(prev => ({ ...prev, quotation_number: `QTN-${year}-${seq}` }))
    }
  }, [quotation, isNew, quotationCount])

  // Fetch dependencies
  const { data: clients = [] } = useQuery({
    queryKey: ['clients', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge.from('clients').select('id, name, company_name, email, phone, address').eq('company_id', company?.id)
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

  const selectedClient = clients.find(c => c.id === formData.client_id)

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

  const subtotal = formData.items.reduce((sum, item) => sum + Number(item.total || 0), 0)
  const taxAmount = (subtotal * Number(formData.tax_rate || 0)) / 100
  const grandTotal = subtotal + taxAmount

  const saveQuotation = useMutation({
    mutationFn: async (statusOverride) => {
      const payload = {
        company_id: company.id,
        quotation_number: formData.quotation_number,
        client_id: formData.client_id || null,
        deal_id: formData.deal_id || null,
        status: statusOverride || formData.status,
        subject: formData.subject,
        valid_until: formData.valid_until || null,
        terms: formData.terms,
        notes: formData.notes,
        tax_rate: formData.tax_rate,
        items: formData.items,
        subtotal,
        tax_amount: taxAmount,
        total: grandTotal,
        currency: 'UGX',
        created_by: profile?.id
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
      queryClient.invalidateQueries({ queryKey: ['quotations', company?.id] })
      navigate('/dashboard/sales/quotations')
    }
  })

  const handleExportPDF = async () => {
    if (!printRef.current) return
    setIsExporting(true)
    await new Promise(resolve => setTimeout(resolve, 100))
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf')
      ])
      const canvas = await html2canvas(printRef.current, { scale: 2, backgroundColor: '#FFFFFF' })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pageWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      let heightLeft = imgHeight
      let position = 0
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }
      pdf.save(`Quotation-${formData.quotation_number || 'draft'}.pdf`)
    } finally {
      setIsExporting(false)
    }
  }

  const isAdminOrManager = role !== 'employee'
  const isOwner = isNew || quotation?.created_by === profile?.id

  if (qLoading) return <div>Loading...</div>
  if (!isNew && !quotation) return <div>Quotation not found.</div>
  if (!isAdminOrManager && !isOwner) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: 'var(--gp-muted)' }}>
        <h3>Access Denied</h3>
        <p>You do not have permission to view or edit this quotation.</p>
        <Button onClick={() => navigate('/dashboard/sales/quotations')}>Back to Quotations List</Button>
      </div>
    )
  }

  const today = format(new Date(), 'dd MMMM yyyy')

  return (
    <div style={{ paddingBottom: '64px' }}>

      {/* Editing Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button onClick={() => navigate('/dashboard/sales/quotations')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--gp-black)' }}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: "var(--gp-black)" }}>
          {isNew ? 'New Quotation' : `Edit Quotation ${formData.quotation_number}`}
        </h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={handleExportPDF} disabled={isExporting}>
            <Download size={16} style={{ marginRight: '8px' }} /> {isExporting ? 'Exporting…' : 'Export PDF'}
          </Button>
          <Button variant="secondary" onClick={() => saveQuotation.mutate('draft')}>Save Draft</Button>
          <Button variant="primary" onClick={() => saveQuotation.mutate('sent')}>Save & Send</Button>
        </div>
      </div>

      {/* Editable fields not part of the printable document */}
      <div style={{
        background: "var(--gp-card)", border: "1px solid var(--gp-border-light)", padding: '20px',
        maxWidth: '900px', margin: '0 auto 24px auto', display: 'flex', flexWrap: 'wrap', gap: '16px'
      }}>
        <div style={{ flex: '1 1 220px' }}>
          <Select label="Client" value={formData.client_id} onChange={e => setFormData({ ...formData, client_id: e.target.value })}
            options={[{ value: '', label: 'Select Client' }, ...clients.map(c => ({ value: c.id, label: c.company_name || c.name }))]} />
        </div>
        <div style={{ flex: '1 1 220px' }}>
          <Select label="Linked Deal (Optional)" value={formData.deal_id} onChange={e => setFormData({ ...formData, deal_id: e.target.value })}
            options={[{ value: '', label: 'None' }, ...deals.map(d => ({ value: d.id, label: d.title }))]} />
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <Input label="Valid Until" type="date" value={formData.valid_until} onChange={e => setFormData({ ...formData, valid_until: e.target.value })} />
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <Select label="Status" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}
            options={['draft', 'sent', 'accepted', 'rejected', 'expired'].map(s => ({ value: s, label: s }))} />
        </div>
      </div>

      {/* Printable / Exportable Document */}
      <div ref={printRef} style={{ background: '#FFFFFF', color: '#111827', padding: '48px', maxWidth: '900px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
        <h1 style={{ textAlign: 'center', fontSize: '26px', fontWeight: 800, letterSpacing: '0.08em', margin: '0 0 32px 0' }}>QUOTATION</h1>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
          <div><strong>Quotation No:</strong> {formData.quotation_number}</div>
          <div><strong>Date:</strong> {today}</div>
        </div>
        <div style={{ fontSize: '14px', marginBottom: '32px' }}>
          <strong>Valid Until:</strong> {formData.valid_until ? format(new Date(formData.valid_until), 'dd MMMM yyyy') : '—'}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', marginBottom: '32px' }}>
          <div>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7280' }}>Company Details</h4>
            <p style={{ margin: 0, fontWeight: 700 }}>{company?.name}</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', lineHeight: 1.6 }}>
              {company?.address}{company?.address && <br />}
              {company?.city}{company?.city && ', '}{company?.country}<br />
              Tel: {company?.phone || '—'}<br />
              Email: {company?.email || '—'}<br />
              {company?.website && <>Website: {company.website}</>}
            </p>
          </div>
          <div>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7280' }}>Client Details</h4>
            <p style={{ margin: 0, fontWeight: 700 }}>{selectedClient?.company_name || selectedClient?.name || 'Select a client'}</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', lineHeight: 1.6 }}>
              {selectedClient?.company_name && <>Contact Person: {selectedClient?.name}<br /></>}
              Address: {selectedClient?.address || '—'}<br />
              Telephone: {selectedClient?.phone || '—'}
            </p>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7280' }}>Subject</h4>
          {isExporting ? (
            <div style={{ width: '100%', fontWeight: 600, fontSize: '14px', padding: '4px 0', minHeight: '26px' }}>
              {formData.subject}
            </div>
          ) : (
            <input
              value={formData.subject}
              onChange={e => setFormData({ ...formData, subject: e.target.value })}
              style={{ width: '100%', fontWeight: 600, fontSize: '14px', border: '1px solid transparent', padding: '4px 0', fontFamily: 'inherit', background: 'transparent' }}
            />
          )}
        </div>

        <p style={{ fontSize: '14px', lineHeight: 1.7, marginBottom: '24px' }}>
          Dear Sir/Madam,<br />
          Thank you for your inquiry. We are pleased to submit our quotation as follows:
        </p>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginBottom: '4px' }}>
          <thead>
            <tr>
              <th style={{ padding: '10px 8px', background: '#111827', color: '#FFFFFF', fontWeight: 600, fontSize: '13px' }}>Description</th>
              <th style={{ padding: '10px 8px', background: '#111827', color: '#FFFFFF', fontWeight: 600, fontSize: '13px', width: '80px' }}>Quantity</th>
              <th style={{ padding: '10px 8px', background: '#111827', color: '#FFFFFF', fontWeight: 600, fontSize: '13px', width: '140px' }}>Unit Price (UGX)</th>
              <th style={{ padding: '10px 8px', background: '#111827', color: '#FFFFFF', fontWeight: 600, fontSize: '13px', width: '140px' }}>Total (UGX)</th>
              <th className="no-export" style={{ width: '32px' }}></th>
            </tr>
          </thead>
          <tbody>
            {formData.items.map((item, index) => (
              <tr key={index} style={{ borderBottom: '1px solid #E5E7EB' }}>
                <td style={{ padding: '4px' }}>
                  {isExporting ? (
                    <div style={{ padding: '8px', minHeight: '34px' }}>{item.description}</div>
                  ) : (
                    <input value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} placeholder="Item description"
                      style={{ width: '100%', padding: '8px', border: '1px solid transparent', fontFamily: 'inherit', background: 'transparent' }} />
                  )}
                </td>
                <td style={{ padding: '4px' }}>
                  {isExporting ? (
                    <div style={{ padding: '8px', minHeight: '34px' }}>{item.qty}</div>
                  ) : (
                    <input type="number" value={item.qty} onChange={e => handleItemChange(index, 'qty', e.target.value)} min="1"
                      style={{ width: '100%', padding: '8px', border: '1px solid transparent', fontFamily: 'inherit', background: 'transparent' }} />
                  )}
                </td>
                <td style={{ padding: '4px' }}>
                  {isExporting ? (
                    <div style={{ padding: '8px', minHeight: '34px' }}>{Number(item.unit_price).toLocaleString()}</div>
                  ) : (
                    <input type="number" value={item.unit_price} onChange={e => handleItemChange(index, 'unit_price', e.target.value)} min="0"
                      style={{ width: '100%', padding: '8px', border: '1px solid transparent', fontFamily: 'inherit', background: 'transparent' }} />
                  )}
                </td>
                <td style={{ padding: '12px 8px', fontWeight: 500 }}>{Number(item.total || 0).toLocaleString()}</td>
                <td className="no-export" style={{ padding: '4px', textAlign: 'center' }}>
                  <button onClick={() => handleRemoveItem(index)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="no-export" style={{ marginBottom: '24px' }}>
          <Button variant="ghost" onClick={handleAddItem}><Plus size={16} style={{ marginRight: '8px' }} /> Add Item</Button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '32px' }}>
          <div style={{ width: '280px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '14px' }}>
              <span>Subtotal</span><span>{subtotal.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '14px', alignItems: 'center' }}>
              <span>VAT (
                <input type="number" value={formData.tax_rate} onChange={e => setFormData({ ...formData, tax_rate: e.target.value })}
                  style={{ width: '36px', border: 'none', borderBottom: '1px solid #9CA3AF', textAlign: 'center', fontFamily: 'inherit', background: 'transparent' }} />
                %)</span>
              <span>{taxAmount.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid #111827', marginTop: '4px', fontSize: '16px', fontWeight: 700 }}>
              <span>Grand Total</span><span>UGX {grandTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7280' }}>Terms and Conditions</h4>
          {isExporting ? (
            <div style={{ padding: '8px', fontSize: '13px', lineHeight: 1.7 }}>
              {formData.terms?.split('\\n').map((line, i) => (
                <React.Fragment key={i}>
                  {line}
                  <br />
                </React.Fragment>
              ))}
            </div>
          ) : (
            <textarea
              value={formData.terms}
              onChange={e => setFormData({ ...formData, terms: e.target.value })}
              style={{ width: '100%', minHeight: '110px', padding: '8px', border: '1px solid #E5E7EB', fontFamily: 'inherit', fontSize: '13px', lineHeight: 1.7, boxSizing: 'border-box' }}
            />
          )}
        </div>

        <div style={{ marginBottom: '32px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7280' }}>Bank Details</h4>
          <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.7 }}>
            Bank Name: {company?.bank_name || '—'}<br />
            Account Name: {company?.bank_account_name || '—'}<br />
            Account Number: {company?.bank_account_number || '—'}
            {company?.mobile_money_number && <><br />Mobile Money: {company.mobile_money_number}</>}
          </p>
        </div>

        <div style={{ marginBottom: '32px' }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7280' }}>Acceptance</h4>
          <p style={{ fontSize: '13px', marginBottom: '24px' }}>I/We accept this quotation and authorize commencement of the services.</p>
          <p style={{ fontSize: '13px', margin: '24px 0' }}>Client Signature: _____________________</p>
          <p style={{ fontSize: '13px', margin: '24px 0' }}>Name: _______________________________</p>
          <p style={{ fontSize: '13px', margin: '24px 0' }}>Date: ________________________________</p>
        </div>

        <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '16px', fontSize: '13px' }}>
          <p style={{ margin: '0 0 4px 0', color: '#6B7280' }}>Prepared By:</p>
          <p style={{ margin: 0, fontWeight: 700 }}>{profile?.first_name} {profile?.last_name}</p>
          <p style={{ margin: 0 }}>{profile?.job_title || ''}</p>
          <p style={{ margin: 0 }}>{company?.name}</p>
          <p style={{ margin: 0 }}>Tel: {profile?.phone || company?.phone || '—'}</p>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          body * { visibility: hidden; }
          .no-export { display: none !important; }
        }
      `}} />
    </div>
  )
}
