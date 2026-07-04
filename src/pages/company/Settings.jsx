import React, { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { UploadCloud } from 'lucide-react'

export function Settings() {
  const { company } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('general')
  const [logoFile, setLogoFile] = useState(null)
  
  const { data: companyData, isLoading } = useQuery({
    queryKey: ['companySettings', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('companies')
        .select('*')
        .eq('id', company?.id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const [formData, setFormData] = useState({
    name: companyData?.name || '',
    industry: companyData?.industry || '',
    country: companyData?.country || '',
    city: companyData?.city || '',
    address: companyData?.address || '',
    phone: companyData?.phone || '',
    email: companyData?.email || '',
    website: companyData?.website || ''
  })

  const [financialData, setFinancialData] = useState({
    bank_name: companyData?.bank_name || '',
    bank_account_name: companyData?.bank_account_name || '',
    bank_account_number: companyData?.bank_account_number || '',
    mobile_money_number: companyData?.mobile_money_number || '',
    tin_number: companyData?.tin_number || ''
  })

  // Update formData when data is loaded
  React.useEffect(() => {
    if (companyData) {
      setFormData({
        name: companyData.name || '',
        industry: companyData.industry || '',
        country: companyData.country || '',
        city: companyData.city || '',
        address: companyData.address || '',
        phone: companyData.phone || '',
        email: companyData.email || '',
        website: companyData.website || ''
      })
      setFinancialData({
        bank_name: companyData.bank_name || '',
        bank_account_name: companyData.bank_account_name || '',
        bank_account_number: companyData.bank_account_number || '',
        mobile_money_number: companyData.mobile_money_number || '',
        tin_number: companyData.tin_number || ''
      })
    }
  }, [companyData])

  const updateCompany = useMutation({
    mutationFn: async (newData) => {
      const { data, error } = await insforge
        .from('companies')
        .update(newData)
        .eq('id', company.id)
        .select()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['companySettings', company?.id])
      alert('Settings saved successfully')
    }
  })

  const handleSave = (e) => {
    e.preventDefault()
    updateCompany.mutate(formData)
  }

  const handleFinancialSave = (e) => {
    e.preventDefault()
    updateCompany.mutate(financialData)
  }

  const handleLogoUpload = async () => {
    if (!logoFile) return
    const fileExt = logoFile.name.split('.').pop()
    const filePath = `${company.id}/logo-${Date.now()}.${fileExt}`

    try {
      const { error: uploadError } = await insforge.storage
        .from('avatars')
        .upload(filePath, logoFile)
      
      if (uploadError) throw uploadError

      const { data: urlData } = insforge.storage.from('avatars').getPublicUrl(filePath)
      
      await updateCompany.mutateAsync({ logo_url: urlData.publicUrl })
      setLogoFile(null)
    } catch (err) {
      console.error(err)
      alert('Error uploading logo')
    }
  }

  if (isLoading) return <div className="p-6">Loading settings...</div>

  return (
    <div className="settings-layout" style={{ display: 'flex', gap: '32px' }}>
      {/* Sidebar Navigation */}
      <div className="settings-sidebar" style={{ width: '200px', display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
        {['general', 'branding', 'financial', 'integrations'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 16px',
              textAlign: 'left',
              background: activeTab === tab ? "var(--gp-blue-glow)" : 'transparent',
              color: activeTab === tab ? "var(--gp-blue-dim)" : '#6B7280',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '14px',
              borderRadius: 0,
              borderLeft: activeTab === tab ? '3px solid var(--gp-blue)' : '3px solid transparent'
            }}
          >
            {tab.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, background: "var(--gp-card)", border: "1px solid var(--gp-border-light)", padding: '32px' }}>
        {activeTab === 'general' && (
          <form onSubmit={handleSave}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '24px' }}>General Settings</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <Input label="Company Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
              <Select label="Industry" value={formData.industry} onChange={e => setFormData({...formData, industry: e.target.value})} options={[{value: 'Real Estate', label: 'Real Estate'}, {value: 'Finance', label: 'Finance'}, {value: 'Retail', label: 'Retail'}, {value: 'Technology', label: 'Technology'}, {value: 'Other', label: 'Other'}]} />
              <Input label="Country" value={formData.country} onChange={e => setFormData({...formData, country: e.target.value})} />
              <Input label="City" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
              <Input label="Address" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
              <Input label="Phone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
              <Input label="Email" type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              <Input label="Website" value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})} />
            </div>
            <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="submit" variant="primary" disabled={updateCompany.isPending}>Save Changes</Button>
            </div>
          </form>
        )}

        {activeTab === 'branding' && (
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '24px' }}>Branding</h3>
            {companyData?.logo_url && (
              <div style={{ marginBottom: '24px' }}>
                <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '8px' }}>Current Logo</p>
                <img src={companyData.logo_url} alt="Company Logo" style={{ height: '80px', objectFit: 'contain' }} />
              </div>
            )}
            
            <div style={{ 
              border: '2px dashed #D1D5DB', 
              padding: '40px', 
              textAlign: 'center', 
              background: '#F9FAFB',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px'
            }}>
              <UploadCloud size={40} color="#9CA3AF" />
              <div>
                <p style={{ margin: 0, fontWeight: 500, color: '#111827' }}>Click to upload or drag and drop</p>
                <p style={{ margin: 0, fontSize: '12px', color: '#6B7280' }}>SVG, PNG, JPG (max. 800x400px)</p>
              </div>
              <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files[0])} />
            </div>

            {logoFile && (
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                <Button onClick={handleLogoUpload} variant="primary">Upload New Logo</Button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'financial' && (
          <form onSubmit={handleFinancialSave}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--gp-black)' }}>Financial Details</h3>
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '24px' }}>
              These details are pulled automatically into every quotation and invoice you generate — set them once here.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <Input label="Bank Name" value={financialData.bank_name} onChange={e => setFinancialData({...financialData, bank_name: e.target.value})} placeholder="e.g. Absa Bank Uganda" />
              <Input label="Bank Account Name" value={financialData.bank_account_name} onChange={e => setFinancialData({...financialData, bank_account_name: e.target.value})} placeholder="e.g. Goodison Park Services Ltd" />
              <Input label="Bank Account Number" value={financialData.bank_account_number} onChange={e => setFinancialData({...financialData, bank_account_number: e.target.value})} />
              <Input label="Mobile Money Number" value={financialData.mobile_money_number} onChange={e => setFinancialData({...financialData, mobile_money_number: e.target.value})} placeholder="+256 XXX XXX XXX" />
              <Input label="TIN Number" value={financialData.tin_number} onChange={e => setFinancialData({...financialData, tin_number: e.target.value})} placeholder="100XXXXXXX" />
            </div>
            <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end' }}>
              <Button type="submit" variant="primary" disabled={updateCompany.isPending}>Save Changes</Button>
            </div>
          </form>
        )}

        {activeTab === 'integrations' && (
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '24px', color: 'var(--gp-black)' }}>Integrations</h3>
            <p style={{ color: '#6B7280' }}>No active integrations. API keys and webhooks will appear here.</p>
          </div>
        )}
      </div>
    </div>
  )
}
