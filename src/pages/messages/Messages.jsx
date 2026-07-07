import React, { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { useAuth } from '../../hooks/useAuth'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { MessageSquare, Search, Send, Plus, X } from 'lucide-react'

export function Messages() {
  const { company, user } = useAuth()
  const queryClient = useQueryClient()
  const [activeConv, setActiveConv] = useState(null)
  const [msgText, setMsgText] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewModal, setShowNewModal] = useState(false)
  const [newSearchQuery, setNewSearchQuery] = useState('')
  const messagesEndRef = useRef(null)

  const userId = user?.id

  // Fetch all messages for the current user
  const { data: allMessages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ['messages', userId],
    queryFn: async () => {
      if (!userId) return []
      const { data, error } = await insforge
        .from('messages')
        .select('*, sender:profiles!sender_id(id,first_name,last_name,role), recipient:profiles!recipient_id(id,first_name,last_name,role)')
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data || []
    },
    enabled: !!userId,
  })

  // Fetch profiles for new conversation modal
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles', company?.id],
    queryFn: async () => {
      if (!company?.id) return []
      const { data, error } = await insforge
        .from('profiles')
        .select('id, first_name, last_name, role')
        .eq('company_id', company.id)
        .neq('id', userId)
      if (error) throw error
      return data || []
    },
    enabled: !!company?.id && !!userId,
  })

  // Derive conversations from messages
  const conversations = React.useMemo(() => {
    const convMap = {}
    allMessages.forEach((msg) => {
      const otherId = msg.sender_id === userId ? msg.recipient_id : msg.sender_id
      const otherProfile = msg.sender_id === userId ? msg.recipient : msg.sender
      if (!convMap[otherId]) {
        convMap[otherId] = {
          other_id: otherId,
          other_name: otherProfile ? `${otherProfile.first_name || ''} ${otherProfile.last_name || ''}` : 'Unknown',
          other_role: otherProfile?.role || '',
          messages: [],
          unread: 0,
        }
      }
      convMap[otherId].messages.push(msg)
      if (msg.recipient_id === userId && !msg.is_read) {
        convMap[otherId].unread += 1
      }
    })
    return Object.values(convMap).map((conv) => ({
      ...conv,
      lastMessage: conv.messages[conv.messages.length - 1],
    }))
  }, [allMessages, userId])

  const filteredConversations = conversations.filter((c) =>
    c.other_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const activeMessages = activeConv
    ? allMessages.filter(
        (m) =>
          (m.sender_id === userId && m.recipient_id === activeConv.other_id) ||
          (m.recipient_id === userId && m.sender_id === activeConv.other_id)
      )
    : []

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages.length])

  // Realtime subscription
  useEffect(() => {
    if (!userId) return
    const sub = insforge
      .channel('messages-' + userId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries(['messages', userId])
        }
      )
      .subscribe()
    return () => insforge.removeChannel(sub)
  }, [userId, queryClient])

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!msgText.trim() || !activeConv) return
      const { error } = await insforge.from('messages').insert([
        {
          sender_id: userId,
          recipient_id: activeConv.other_id,
          content: msgText.trim(),
          company_id: company?.id,
        },
      ])
      if (error) throw error
    },
    onSuccess: () => {
      setMsgText('')
      queryClient.invalidateQueries(['messages', userId])
    },
  })

  const handleSend = () => {
    if (msgText.trim()) sendMutation.mutate()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const getInitials = (name) => {
    if (!name) return '?'
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const formatTime = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    const today = new Date()
    if (d.toDateString() === today.toDateString()) return formatTime(ts)
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  const filteredProfiles = profiles.filter((p) => {
    const fullName = `${p.first_name || ''} ${p.last_name || ''}`;
    return fullName.toLowerCase().includes(newSearchQuery.toLowerCase());
  })

  const startConversation = (profile) => {
    setActiveConv({
      other_id: profile.id,
      other_name: `${profile.first_name || ''} ${profile.last_name || ''}`,
      other_role: profile.role,
    })
    setShowNewModal(false)
    setNewSearchQuery('')
  }

  return (
    <div
      style={{
        display: 'flex',
        height: 'calc(100vh - 64px)',
        background: "var(--gp-background)",
        overflow: 'hidden',
      }}
    >
      {/* Left Panel */}
      <div
        style={{
          width: 280,
          borderRight: '1px solid var(--gp-border-light)',
          background: "var(--gp-background)",
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px',
            borderBottom: '1px solid var(--gp-border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ color: 'var(--gp-black)', fontWeight: 700, fontSize: 16 }}>Messages</span>
          <button
            onClick={() => setShowNewModal(true)}
            style={{
              background: "var(--gp-blue)",
              color: "var(--gp-black)",
              border: 0,
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Plus size={12} />
            New
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '8px' }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#4B5563',
              }}
            />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              style={{
                width: '100%',
                padding: '8px 8px 8px 28px',
                background: "var(--gp-card)",
                border: '1px solid var(--gp-border-light)',
                color: 'var(--gp-black)',
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Conversation List */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loadingMessages && (
            <div style={{ padding: 24, textAlign: 'center' }}>
              <Spinner />
            </div>
          )}
          {!loadingMessages && filteredConversations.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--gp-muted)', fontSize: 13 }}>
              No conversations yet
            </div>
          )}
          {filteredConversations.map((conv) => {
            const isActive = activeConv?.other_id === conv.other_id
            return (
              <div
                key={conv.other_id}
                onClick={() => setActiveConv(conv)}
                style={{
                  padding: '12px 16px',
                  cursor: 'pointer',
                  borderBottom: '1px solid var(--gp-border-light)',
                  background: isActive ? "var(--gp-card)" : 'transparent',
                  borderLeft: isActive ? '2px solid var(--gp-blue)' : '2px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    background: "var(--gp-border-light)",
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--gp-blue)",
                  }}
                >
                  {getInitials(conv.other_name)}
                </div>

                {/* Name + Preview */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: 'var(--gp-black)', fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {conv.other_name}
                  </div>
                  <div style={{ color: 'var(--gp-muted)', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {conv.lastMessage?.content || ''}
                  </div>
                </div>

                {/* Time + Unread */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                  <span style={{ color: 'var(--gp-muted)', fontSize: 10 }}>
                    {formatDate(conv.lastMessage?.created_at)}
                  </span>
                  {conv.unread > 0 && (
                    <div
                      style={{
                        background: "var(--gp-blue)",
                        color: "var(--gp-black)",
                        fontSize: 10,
                        fontWeight: 700,
                        borderRadius: '50%',
                        width: 16,
                        height: 16,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {conv.unread}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right Panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: "var(--gp-background)" }}>
        {!activeConv ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
            }}
          >
            <MessageSquare size={48} color="var(--gp-border-light)" />
            <span style={{ color: 'var(--gp-muted)', fontSize: 15 }}>Select a conversation to start messaging</span>
          </div>
        ) : (
          <>
            {/* Conversation Header */}
            <div
              style={{
                padding: '16px',
                borderBottom: '1px solid var(--gp-border-light)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  background: "var(--gp-border-light)",
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--gp-blue)",
                }}
              >
                {getInitials(activeConv.other_name)}
              </div>
              <div>
                <div style={{ color: 'var(--gp-black)', fontWeight: 700, fontSize: 14 }}>
                  {activeConv.other_name}
                </div>
                <div style={{ color: 'var(--gp-muted)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: '#10B981',
                    }}
                  />
                  {activeConv.other_role || 'Team Member'}
                </div>
              </div>
            </div>

            {/* Message Thread */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {activeMessages.map((msg) => {
                const isMine = msg.sender_id === userId
                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignSelf: isMine ? 'flex-end' : 'flex-start',
                      maxWidth: '60%',
                      marginLeft: isMine ? 'auto' : 0,
                    }}
                  >
                    <div
                      style={{
                        background: isMine ? "var(--gp-blue)" : "var(--gp-card)",
                        color: isMine ? "#FFFFFF" : "var(--gp-black)",
                        border: isMine ? 'none' : '1px solid var(--gp-border-light)',
                        padding: '8px 12px',
                        fontSize: 13,
                        lineHeight: 1.5,
                        wordBreak: 'break-word',
                      }}
                    >
                      {msg.content}
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        color: 'var(--gp-muted)',
                        marginTop: 2,
                        alignSelf: isMine ? 'flex-end' : 'flex-start',
                      }}
                    >
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div
              style={{
                padding: '12px',
                borderTop: '1px solid var(--gp-border-light)',
                display: 'flex',
                gap: 8,
                alignItems: 'center',
              }}
            >
              <input
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                style={{
                  flex: 1,
                  background: "var(--gp-card)",
                  border: '1px solid var(--gp-border-light)',
                  color: 'var(--gp-black)',
                  padding: '8px 12px',
                  fontSize: 13,
                  outline: 'none',
                  borderRadius: 0,
                }}
              />
              <button
                onClick={handleSend}
                disabled={sendMutation.isPending || !msgText.trim()}
                style={{
                  background: "var(--gp-blue)",
                  color: "var(--gp-black)",
                  padding: '8px 16px',
                  fontWeight: 700,
                  border: 0,
                  cursor: msgText.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  opacity: msgText.trim() ? 1 : 0.5,
                }}
              >
                <Send size={14} />
                Send
              </button>
            </div>
          </>
        )}
      </div>

      {/* New Conversation Modal */}
      {showNewModal && (
        <Modal isOpen={showNewModal} onClose={() => setShowNewModal(false)} title="New Conversation">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#4B5563',
                }}
              />
              <input
                value={newSearchQuery}
                onChange={(e) => setNewSearchQuery(e.target.value)}
                placeholder="Search team members..."
                style={{
                  width: '100%',
                  padding: '10px 10px 10px 32px',
                  background: "var(--gp-card)",
                  border: '1px solid var(--gp-border-light)',
                  color: 'var(--gp-black)',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div
              style={{
                maxHeight: 300,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              {filteredProfiles.length === 0 && (
                <div style={{ color: 'var(--gp-muted)', fontSize: 13, padding: '12px 0', textAlign: 'center' }}>
                  No team members found
                </div>
              )}
              {filteredProfiles.map((profile) => (
                <div
                  key={profile.id}
                  onClick={() => startConversation(profile)}
                  style={{
                    padding: '10px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: "var(--gp-card)",
                    border: '1px solid var(--gp-border-light)',
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      background: "var(--gp-border-light)",
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--gp-blue)",
                      flexShrink: 0,
                    }}
                  >
                    {getInitials(`${profile.first_name || ''} ${profile.last_name || ''}`)}
                  </div>
                  <div>
                    <div style={{ color: 'var(--gp-black)', fontWeight: 600, fontSize: 13 }}>
                      {profile.first_name} {profile.last_name}
                    </div>
                    <div style={{ color: '#9CA3AF', fontSize: 11 }}>{profile.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
