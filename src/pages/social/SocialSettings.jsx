import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/ui/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Spinner } from '../../components/ui/Spinner'
import { Link2, LinkIcon, Zap, AlertCircle } from 'lucide-react'

const PLATFORMS = [
  {
    id: 'youtube',
    name: 'YouTube',
    initial: 'YT',
    color: '#FF0000',
    note: 'Find your API key in YouTube Studio > Settings > Channel > Advanced',
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    initial: 'X',
    color: '#1DA1F2',
    note: 'Get Bearer Token from developer.twitter.com',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    initial: 'IG',
    color: '#E1306C',
    note: 'Use Instagram Graph API via Meta Developer Portal',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    initial: 'TK',
    color: "var(--gp-border-light)",
    note: 'Apply for TikTok API access at developers.tiktok.com',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    initial: 'LI',
    color: '#0077B5',
    note: 'Create app at linkedin.com/developers',
  },
]

const emptyForm = { handle: '', api_key: '', refresh_token: '' }

export function SocialSettings() {
  const { company } = useAuth()
  const queryClient = useQueryClient()
  const [selectedPlatform, setSelectedPlatform] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['social_media_accounts', company?.id],
    queryFn: async () => {
      if (!company?.id) return []
      const { data, error } = await insforge
        .from('social_media_accounts')
        .select('*')
        .eq('company_id', company.id)
      if (error) throw error
      return data || []
    },
    enabled: !!company?.id,
  })

  const getAccount = (platformId) => accounts.find((a) => a.platform === platformId && a.is_connected)

  const openConnect = (platform) => {
    const existing = getAccount(platform.id)
    setForm({
      handle: existing?.handle || '',
      api_key: existing?.api_key || '',
      refresh_token: existing?.refresh_token || '',
    })
    setSelectedPlatform(platform)
  }

  const connectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await insforge.from('social_media_accounts').upsert(
        [
          {
            company_id: company?.id,
            platform: selectedPlatform.id,
            handle: form.handle,
            api_key: form.api_key,
            refresh_token: form.refresh_token || null,
            is_connected: true,
          },
        ],
        { onConflict: 'company_id,platform' }
      )
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['social_media_accounts', company?.id])
      setSelectedPlatform(null)
      setForm(emptyForm)
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: async (platformId) => {
      const { error } = await insforge
        .from('social_media_accounts')
        .update({ is_connected: false })
        .eq('company_id', company?.id)
        .eq('platform', platformId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['social_media_accounts', company?.id])
    },
  })

  return (
    <div style={{ padding: '24px', background: "var(--gp-background)", minHeight: '100vh' }}>
      <PageHeader
        title="Social Media Connections"
        subtitle="Connect your social media accounts to track metrics"
      />

      {/* Info banner */}
      <div
        style={{
          marginTop: 24,
          padding: '14px 16px',
          background: "var(--gp-card)",
          borderLeft: '3px solid #38BDF8',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Zap size={16} color="var(--gp-blue)" />
        <span style={{ color: '#9CA3AF', fontSize: 13 }}>
          <strong style={{ color: "var(--gp-blue)" }}>Phase 1:</strong> Manual metrics entry. Live API sync is coming in Phase 2 — connections you save will be activated automatically when APIs are enabled.
        </span>
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spinner />
        </div>
      )}

      {/* Platform Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 16,
          marginTop: 24,
        }}
      >
        {PLATFORMS.map((platform) => {
          const account = getAccount(platform.id)
          const isConnected = !!account

          return (
            <div
              key={platform.id}
              style={{
                padding: 24,
                background: "var(--gp-card)",
                border: '1px solid var(--gp-border-light)',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {/* Platform Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    background: platform.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--gp-black)',
                    flexShrink: 0,
                  }}
                >
                  {platform.initial}
                </div>
                <div>
                  <div style={{ color: 'var(--gp-black)', fontSize: 16, fontWeight: 700 }}>{platform.name}</div>
                  <div style={{ color: '#9CA3AF', fontSize: 12 }}>Manual metrics entry</div>
                </div>
              </div>

              {/* Status Badge + Handle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '3px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      background: isConnected ? '#10B98122' : "var(--gp-border-light)",
                      color: isConnected ? '#10B981' : '#9CA3AF',
                      border: `1px solid ${isConnected ? '#10B981' : "var(--gp-border-light)"}`,
                    }}
                  >
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: isConnected ? '#10B981' : '#4B5563',
                      }}
                    />
                    {isConnected ? 'Connected' : 'Not Connected'}
                  </div>
                  {isConnected && account?.handle && (
                    <span style={{ color: '#9CA3AF', fontSize: 12 }}>@{account.handle}</span>
                  )}
                </div>
              </div>

              {/* Coming Soon label */}
              <div
                style={{
                  padding: '6px 10px',
                  background: "var(--gp-background)",
                  border: '1px solid var(--gp-border-light)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Zap size={12} color="#F59E0B" />
                <span style={{ color: '#F59E0B', fontSize: 11, fontWeight: 600 }}>
                  Live API sync coming soon (Phase 2)
                </span>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => openConnect(platform)}
                  style={{
                    flex: 1,
                    background: isConnected ? 'transparent' : "var(--gp-blue)",
                    color: isConnected ? '#9CA3AF' : "var(--gp-background)",
                    border: isConnected ? '1px solid var(--gp-border-light)' : 'none',
                    padding: '8px 0',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <LinkIcon size={13} />
                  {isConnected ? 'Edit' : 'Connect'}
                </button>
                {isConnected && (
                  <button
                    onClick={() => disconnectMutation.mutate(platform.id)}
                    disabled={disconnectMutation.isPending}
                    style={{
                      background: 'transparent',
                      color: '#EF4444',
                      border: '1px solid #EF444444',
                      padding: '8px 14px',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Connect Modal */}
      {selectedPlatform && (
        <Modal
          onClose={() => {
            setSelectedPlatform(null)
            setForm(emptyForm)
          }}
          title={`Connect ${selectedPlatform.name}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Note Box */}
            <div
              style={{
                background: '#141414',
                borderLeft: '3px solid #38BDF8',
                padding: '12px 14px',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}
            >
              <AlertCircle size={14} color="var(--gp-blue)" style={{ marginTop: 2, flexShrink: 0 }} />
              <span style={{ color: '#9CA3AF', fontSize: 12, lineHeight: 1.5 }}>{selectedPlatform.note}</span>
            </div>

            {/* Coming Soon notice */}
            <div
              style={{
                background: "var(--gp-card)",
                border: '1px solid #F59E0B44',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Zap size={13} color="#F59E0B" />
              <span style={{ color: '#F59E0B', fontSize: 12 }}>
                Live API sync is Phase 2. Connection saved for when APIs are enabled.
              </span>
            </div>

            {/* Form Fields */}
            <div>
              <label style={{ color: '#9CA3AF', fontSize: 12, display: 'block', marginBottom: 6 }}>
                Username / Handle
              </label>
              <input
                value={form.handle}
                onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))}
                placeholder="@yourusername"
                style={{
                  width: '100%',
                  background: "var(--gp-card)",
                  border: '1px solid var(--gp-border-light)',
                  color: 'var(--gp-black)',
                  padding: '9px 12px',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ color: '#9CA3AF', fontSize: 12, display: 'block', marginBottom: 6 }}>
                API Key / Access Token
              </label>
              <input
                value={form.api_key}
                onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
                placeholder="Paste your API key or access token"
                type="password"
                style={{
                  width: '100%',
                  background: "var(--gp-card)",
                  border: '1px solid var(--gp-border-light)',
                  color: 'var(--gp-black)',
                  padding: '9px 12px',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ color: '#9CA3AF', fontSize: 12, display: 'block', marginBottom: 6 }}>
                Refresh Token{' '}
                <span style={{ color: '#4B5563', fontSize: 11 }}>(optional)</span>
              </label>
              <input
                value={form.refresh_token}
                onChange={(e) => setForm((f) => ({ ...f, refresh_token: e.target.value }))}
                placeholder="Refresh token if applicable"
                type="password"
                style={{
                  width: '100%',
                  background: "var(--gp-card)",
                  border: '1px solid var(--gp-border-light)',
                  color: 'var(--gp-black)',
                  padding: '9px 12px',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                onClick={() => {
                  setSelectedPlatform(null)
                  setForm(emptyForm)
                }}
                style={{
                  background: 'transparent',
                  color: '#9CA3AF',
                  border: '1px solid var(--gp-border-light)',
                  padding: '8px 16px',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending}
                style={{
                  background: "var(--gp-blue)",
                  color: "var(--gp-black)",
                  border: 'none',
                  padding: '8px 20px',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {connectMutation.isPending ? 'Saving...' : 'Save Connection'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
