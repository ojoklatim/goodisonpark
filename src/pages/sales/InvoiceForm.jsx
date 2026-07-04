import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { ArrowLeft, Plus, Trash2, Download } from 'lucide-react'
import { format } from 'date-fns'

const DEFAULT_TERMS = `Payment is due within 14 days from the invoice date.
Late payments may attract additional charges.
Please include the invoice number when making payment.`

export function InvoiceForm() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const fromQuotationId = searchParams.get('from_quotation')
  const isNew = !id || id === 'new'
  const { company, profile } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const printRef = useRef(null)
  const [isExporting, setIsExporting] = useState(false)

  const [formData, setFormData] = useState({
    invoice_number: '',
    client_id: '',
    quotation_id: '',
    status: 'draft',
    due_date: '',
    payment_terms: DEFAULT_TERMS,
    notes: 'Thank you for your business. We appreciate the opportunity to serve you and look forward to working with you again.',
    tax_rate: 18,
    items: []
  })

  const { data: invoice, isLoading: invLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      if (isNew) return null
      const { data, error } = await insforge.from('invoices').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
    enabled: !isNew
  })

  const { data: invoiceCount } = useQuery({
    queryKey: ['invoices_count', company?.id],
    queryFn: async () => {
      const { count, error } = await insforge.from('invoices').select('*', { count: 'exact', head: true }).eq('company_id', company?.id)
      if (error) throw error
      return count || 0
    },
    enabled: !!company?.id && isNew
  })

  // If created from an accepted quotation, pre-fill from it
  const { data: sourceQuotation } = useQuery({
    queryKey: ['quotation', fromQuotationId],
    queryFn: async () => {
      const { data, error } = await insforge.from('quotations').select('*').eq('id', fromQuotationId).single()
      if (error) throw error
      return data
    },
    enabled: !!fromQuotationId && isNew
  })

  useEffect(() => {
    if (invoice) {
      setFormData({
        invoice_number: invoice.invoice_number || '',
        client_id: invoice.client_id || '',
        quotation_id: invoice.quotation_id || '',
        status: invoice.status || 'draft',
        due_date: invoice.due_date || '',
        payment_terms: invoice.payment_terms || DEFAULT_TERMS,
        notes: invoice.notes || '',
        tax_rate: invoice.tax_rate ?? 18,
        items: invoice.items || []
      })
    } else if (isNew && invoiceCount !== undefined) {
      const year = new Date().getFullYear()
      const seq = String(invoiceCount + 1).padStart(3, '0')
      setFormData(prev => ({ ...prev, invoice_number: `INV-${year}-${seq}` }))
    }
  }, [invoice, isNew, invoiceCount])

  useEffect(() => {
    if (sourceQuotation && isNew) {
      setFormData(prev => ({
        ...prev,
        client_id: sourceQuotation.client_id || '',
        quotation_id: sourceQuotation.id,
        items: sourceQuotation.items || [],
        tax_rate: sourceQuotation.tax_rate ?? 18
      }))
    }
  }, [sourceQuotation, isNew])

  const { data: clients = [] } = useQuery({
    queryKey: ['clients', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge.from('clients').select('id, name, company_name, email, phone, address').eq('company_id', company?.id)
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const selectedClient = clients.find(c => c.id === formData.client_id)

  const handleAddItem = () => {
    setFormData(prev => ({ ...prev, items: [...prev.items, { description: '', qty: 1, unit_price: 0, total: 0 }] }))
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
    setFormData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }))
  }

  const subtotal = formData.items.reduce((sum, item) => sum + Number(item.total || 0), 0)
  const taxAmount = (subtotal * Number(formData.tax_rate || 0)) / 100
  const grandTotal = subtotal + taxAmount

  const saveInvoice = useMutation({
    mutationFn: async (statusOverride) => {
      const payload = {
        company_id: company.id,
        invoice_number: formData.invoice_number,
        client_id: formData.client_id || null,
        quotation_id: formData.quotation_id || null,
        status: statusOverride || formData.status,
        due_date: formData.due_date || null,
        payment_terms: formData.payment_terms,
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
        const { error } = await insforge.from('invoices').insert([payload])
        if (error) throw error
      } else {
        const { error } = await insforge.from('invoices').update(payload).eq('id', id)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['invoices', company?.id])
      navigate('/dashboard/sales/invoices')
    }
  })

  const handleExportPDF = async () => {
    if (!printRef.current) return
    setIsExporting(true)
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
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
      pdf.save(`Invoice-${formData.invoice_number || 'draft'}.pdf`)
    } finally {
      setIsExporting(false)
    }
  }

  if (invLoading) return <div>Loading...</div>

  const today = format(new Date(), 'dd MMMM yyyy')

  return (
    <div style={{ paddingBottom: '64px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button onClick={() => navigate('/dashboard/sales/invoices')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--gp-black)' }}>
          <ArrowLeft size={20} />
        </button>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: "var(--gp-black)" }}>
          {isNew ? 'New Invoice' : `Edit Invoice ${formData.invoice_number}`}
        </h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={handleExportPDF} disabled={isExporting}>
            <Download size={16} style={{ marginRight: '8px' }} /> {isExporting ? 'Exporting…' : 'Export PDF'}
          </Button>
          <Button variant="secondary" onClick={() => saveInvoice.mutate('draft')}>Save Draft</Button>
          <Button variant="primary" onClick={() => saveInvoice.mutate('unpaid')}>Save & Issue</Button>
        </div>
      </div>

      <div style={{
        background: "var(--gp-card)", border: "1px solid var(--gp-border-light)", padding: '20px',
        maxWidth: '900px', margin: '0 auto 24px auto', display: 'flex', flexWrap: 'wrap', gap: '16px'
      }}>
        <div style={{ flex: '1 1 220px' }}>
          <Select label="Client" value={formData.client_id} onChange={e => setFormData({ ...formData, client_id: e.target.value })}
            options={[{ value: '', label: 'Select Client' }, ...clients.map(c => ({ value: c.id, label: c.company_name || c.name }))]} />
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <Input label="Due Date" type="date" value={formData.due_date} onChange={e => setFormData({ ...formData, due_date: e.target.value })} />
        </div>
        <div style={{ flex: '1 1 160px' }}>
          <Select label="Status" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}
            options={['draft', 'unpaid', 'partial', 'paid', 'overdue', 'cancelled'].map(s => ({ value: s, label: s }))} />
        </div>
      </div>

      <div ref={printRef} style={{ background: '#FFFFFF', color: '#111827', padding: '48px', maxWidth: '900px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
        <h1 style={{ textAlign: 'center', fontSize: '26px', fontWeight: 800, letterSpacing: '0.08em', margin: '0 0 32px 0' }}>INVOICE</h1>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
          <div><strong>Invoice No:</strong> {formData.invoice_number}</div>
          <div><strong>Date:</strong> {today}</div>
        </div>
        <div style={{ fontSize: '14px', marginBottom: '32px' }}>
          <strong>Due Date:</strong> {formData.due_date ? format(new Date(formData.due_date), 'dd MMMM yyyy') : '—'}
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
              {company?.website && <>Website: {company.website}<br /></>}
              {company?.tin_number && <>TIN: {company.tin_number}</>}
            </p>
          </div>
          <div>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7280' }}>Bill To</h4>
            <p style={{ margin: 0, fontWeight: 700 }}>{selectedClient?.company_name || selectedClient?.name || 'Select a client'}</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', lineHeight: 1.6 }}>
              {selectedClient?.company_name && <>Contact Person: {selectedClient?.name}<br /></>}
              Address: {selectedClient?.address || '—'}<br />
              Telephone: {selectedClient?.phone || '—'}
            </p>
          </div>
        </div>

        <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7280' }}>Description of Services</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginBottom: '4px' }}>
          <thead>
            <tr>
              <th style={{ padding: '10px 8px', background: '#111827', color: '#FFFFFF', fontWeight: 600, fontSize: '13px' }}>Description</th>
              <th style={{ padding: '10px 8px', background: '#111827', color: '#FFFFFF', fontWeight: 600, fontSize: '13px', width: '80px' }}>Quantity</th>
              <th style={{ padding: '10px 8px', background: '#111827', color: '#FFFFFF', fontWeight: 600, fontSize: '13px', width: '140px' }}>Unit Price (UGX)</th>
              <th style={{ padding: '10px 8px', background: '#111827', color: '#FFFFFF', fontWeight: 600, fontSize: '13px', width: '140px' }}>Amount (UGX)</th>
              <th className="no-export" style={{ width: '32px' }}></th>
            </tr>
          </thead>
          <tbody>
            {formData.items.map((item, index) => (
              <tr key={index} style={{ borderBottom: '1px solid #E5E7EB' }}>
                <td style={{ padding: '4px' }}>
                  <input value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} placeholder="Service description"
                    style={{ width: '100%', padding: '8px', border: '1px solid transparent', fontFamily: 'inherit', background: 'transparent' }} />
                </td>
                <td style={{ padding: '4px' }}>
                  <input type="number" value={item.qty} onChange={e => handleItemChange(index, 'qty', e.target.value)} min="1"
                    style={{ width: '100%', padding: '8px', border: '1px solid transparent', fontFamily: 'inherit', background: 'transparent' }} />
                </td>
                <td style={{ padding: '4px' }}>
                  <input type="number" value={item.unit_price} onChange={e => handleItemChange(index, 'unit_price', e.target.value)} min="0"
                    style={{ width: '100%', padding: '8px', border: '1px solid transparent', fontFamily: 'inherit', background: 'transparent' }} />
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
              <span>Total Due</span><span>UGX {grandTotal.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7280' }}>Payment Details</h4>
          <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.7 }}>
            Bank Name: {company?.bank_name || '—'}<br />
            Account Name: {company?.bank_account_name || '—'}<br />
            Account Number: {company?.bank_account_number || '—'}
            {company?.mobile_money_number && <><br />Mobile Money: {company.mobile_money_number}</>}
          </p>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7280' }}>Payment Terms</h4>
          <textarea
            value={formData.payment_terms}
            onChange={e => setFormData({ ...formData, payment_terms: e.target.value })}
            style={{ width: '100%', minHeight: '90px', padding: '8px', border: '1px solid #E5E7EB', fontFamily: 'inherit', fontSize: '13px', lineHeight: 1.7, boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: '32px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6B7280' }}>Notes</h4>
          <textarea
            value={formData.notes}
            onChange={e => setFormData({ ...formData, notes: e.target.value })}
            style={{ width: '100%', minHeight: '60px', padding: '8px', border: '1px solid #E5E7EB', fontFamily: 'inherit', fontSize: '13px', lineHeight: 1.7, boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '16px', fontSize: '13px' }}>
          <p style={{ margin: '0 0 4px 0', color: '#6B7280' }}>Authorized By:</p>
          <p style={{ margin: 0, fontWeight: 700 }}>{profile?.first_name} {profile?.last_name}</p>
          <p style={{ margin: 0 }}>{profile?.job_title || ''}</p>
          <p style={{ margin: 0 }}>{company?.name}</p>
        </div>
      </div>
    </div>
  )
}
