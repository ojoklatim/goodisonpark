import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'

export function Calendar() {
  const { company, user } = useAuth()
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [currentDate, setCurrentDate] = useState(new Date())

  const [formData, setFormData] = useState({ title: '', description: '', starts_at: '', ends_at: '', attendees: [] })

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('tasks')
        .select('id, title, due_date, status')
        .eq('company_id', company?.id)
      if (error) throw error
      return data
    },
    enabled: !!company?.id
  })

  const { data: events = [] } = useQuery({
    queryKey: ['events', company?.id],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('events')
        .select('*')
        .eq('company_id', company?.id)
      if (error && error.code !== '42P01') throw error // ignore undefined table error
      return data || []
    },
    enabled: !!company?.id
  })

  const createEvent = useMutation({
    mutationFn: async (payload) => {
      const { error } = await insforge.from('events').insert([payload])
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['events', company?.id])
      setShowModal(false)
      setFormData({ title: '', description: '', starts_at: '', ends_at: '', attendees: [] })
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    createEvent.mutate({
      company_id: company.id,
      created_by: user.id,
      title: formData.title,
      description: formData.description,
      starts_at: formData.starts_at ? new Date(formData.starts_at).toISOString() : null,
      ends_at: formData.ends_at ? new Date(formData.ends_at).toISOString() : null,
      attendees: formData.attendees
    })
  }

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  
  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate()
  }
  
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDayOfMonth = new Date(year, month, 1).getDay()

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const getItemsForDay = (dayNum) => {
    const d = new Date(year, month, dayNum)
    const dayStart = d.toISOString().split('T')[0]
    
    const dayTasks = tasks.filter(t => t.due_date && t.due_date.startsWith(dayStart) && t.status !== 'done')
    const dayEvents = events.filter(e => e.starts_at && e.starts_at.startsWith(dayStart))
    
    return { dayTasks, dayEvents }
  }

  return (
    <div>
      <PageHeader 
        title="Calendar" 
        subtitle="Company schedule and events"
        action={<Button variant="primary" onClick={() => setShowModal(true)}>New Event</Button>}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700 }}>
          {currentDate.toLocaleString('default', { month: 'long' })} {year}
        </h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" onClick={handlePrevMonth}>Prev</Button>
          <Button variant="secondary" onClick={handleNextMonth}>Next</Button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: "var(--gp-border-light)", border: "1px solid var(--gp-border-light)" }}>
        {days.map(d => (
          <div key={d} style={{ background: "var(--gp-card)", padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: 600 }}>{d}</div>
        ))}
        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
          <div key={`empty-${i}`} style={{ background: '#F9FAFB', padding: '8px', minHeight: '120px' }}></div>
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const dayNum = i + 1
          const { dayTasks, dayEvents } = getItemsForDay(dayNum)
          
          return (
            <div key={dayNum} style={{ background: "var(--gp-card)", padding: '8px', minHeight: '120px', display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13px', color: '#4B5563', marginBottom: '8px', fontWeight: 600 }}>{dayNum}</span>
              
              {dayEvents.map(ev => (
                <div key={ev.id} title={ev.title} style={{ background: 'rgba(245, 158, 11, 0.1)', borderLeft: '2px solid #F59E0B', padding: '4px', fontSize: '11px', color: "var(--gp-black)", marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ev.title}
                </div>
              ))}
              
              {dayTasks.map(t => (
                <div key={t.id} title={t.title} style={{ background: 'rgba(56, 189, 248, 0.1)', borderLeft: '2px solid #38BDF8', padding: '4px', fontSize: '11px', color: "var(--gp-black)", marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  Task: {t.title}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Event">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto', padding: '4px' }}>
          <Input label="Event Title" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required />
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}><Input label="Starts At" type="datetime-local" value={formData.starts_at} onChange={e => setFormData({...formData, starts_at: e.target.value})} required /></div>
            <div style={{ flex: 1 }}><Input label="Ends At" type="datetime-local" value={formData.ends_at} onChange={e => setFormData({...formData, ends_at: e.target.value})} required /></div>
          </div>
          <Input label="Description" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={createEvent.isPending}>{createEvent.isPending ? 'Saving...' : 'Save Event'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
