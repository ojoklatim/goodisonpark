import React, { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { UploadCloud } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'

export function Settings() {
  const { company } = useAuth()
  const { setCompany } = useAuthStore()
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
    onSuccess: (data) => {
      queryClient.invalidateQueries(['companySettings', company?.id])
      if (data && data.length > 0) {
        setCompany(data[0])
      }
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
        .from('branding')
        .upload(filePath, logoFile)
      
      if (uploadError) throw uploadError

      const { data: urlData } = insforge.storage.from('branding').getPublicUrl(filePath)
      
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
        {['general', 'financial'].map(tab => (
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
          <div>
            {/* Logo Section */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '32px', paddingBottom: '24px', borderBottom: '1px solid var(--gp-border-light)' }}>
              <div 
                className="circular-frame"
                style={{
                  width: '100px',
                  height: '100px',
                  border: '1px solid var(--gp-border-light)',
                  background: 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0,
                  borderRadius: '50%'
                }}
              >
                {companyData?.logo_url ? (
                  <img src={companyData.logo_url} alt="Company Logo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--gp-muted)' }}>No Logo</span>
                )}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gp-black)' }}>Company Logo</span>
                <span style={{ fontSize: '12px', color: 'var(--gp-muted)' }}>PNG, JPG or JPEG. Max size 2MB.</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                  <input
                    type="file"
                    accept="image/*"
                    id="logo-upload"
                    style={{ display: 'none' }}
                    onChange={e => setLogoFile(e.target.files[0])}
                  />
                  <label
                    htmlFor="logo-upload"
                    style={{
                      padding: '8px 16px',
                      background: 'var(--gp-background)',
                      border: '1px solid var(--gp-border-light)',
                      color: 'var(--gp-black)',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.15s'
                    }}
                  >
                    <UploadCloud size={16} />
                    {logoFile ? logoFile.name : 'Choose Image'}
                  </label>
                  {logoFile && (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={handleLogoUpload}
                      style={{ padding: '8px 16px', fontSize: '13px' }}
                    >
                      Upload
                    </Button>
                  )}
                </div>
              </div>
            </div>

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


      </div>
    </div>
  )
}
