import React from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../../lib/insforge'
import { Button } from '../../components/ui/Button'
import { LogIn, LogOut, CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'

const LATE_HOUR = 9 // check-ins after 9:00 AM are marked 'late'

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

export function CheckInWidget() {
  const { company, profile } = useAuth()
  const queryClient = useQueryClient()
  const today = todayStr()

  const { data: record, isLoading } = useQuery({
    queryKey: ['my_attendance_today', profile?.id, today],
    queryFn: async () => {
      const { data, error } = await insforge
        .from('attendance')
        .select('*')
        .eq('profile_id', profile.id)
        .eq('date', today)
        .maybeSingle()
      if (error) throw error
      return data
    },
    enabled: !!profile?.id
  })

  const checkIn = useMutation({
    mutationFn: async () => {
      const now = new Date()
      const status = now.getHours() >= LATE_HOUR ? 'late' : 'present'
      const { error } = await insforge.from('attendance').upsert([{
        company_id: company.id,
        profile_id: profile.id,
        date: today,
        check_in_at: now.toISOString(),
        status,
        source: 'self'
      }], { onConflict: 'profile_id,date' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['my_attendance_today', profile?.id, today])
      queryClient.invalidateQueries(['attendance', company?.id])
    }
  })

  const checkOut = useMutation({
    mutationFn: async () => {
      const { error } = await insforge.from('attendance').update({
        check_out_at: new Date().toISOString()
      }).eq('id', record.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['my_attendance_today', profile?.id, today])
      queryClient.invalidateQueries(['attendance', company?.id])
    }
  })

  if (isLoading) return null

  const hasCheckedIn = !!record?.check_in_at
  const hasCheckedOut = !!record?.check_out_at

  return (
    <div style={{
      background: 'var(--gp-card)', border: '1px solid var(--gp-border-light)',
      padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: '16px', marginBottom: '24px'
    }}>
      <div>
        <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 600, color: 'var(--gp-black)' }}>
          {format(new Date(), 'EEEE, MMMM d')}
        </h3>
        {!hasCheckedIn && <p style={{ margin: 0, fontSize: '13px', color: 'var(--gp-muted)' }}>You haven't checked in yet today.</p>}
        {hasCheckedIn && !hasCheckedOut && (
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--gp-muted)' }}>
            Checked in at <strong style={{ color: 'var(--gp-black)' }}>{format(new Date(record.check_in_at), 'h:mm a')}</strong>
            {record.status === 'late' && <span style={{ color: '#F59E0B', fontWeight: 600 }}> (Late)</span>}
          </p>
        )}
        {hasCheckedOut && (
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--gp-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckCircle2 size={14} color="#22C55E" />
            Checked in {format(new Date(record.check_in_at), 'h:mm a')} · Checked out {format(new Date(record.check_out_at), 'h:mm a')}
          </p>
        )}
      </div>

      {!hasCheckedIn && (
        <Button variant="primary" onClick={() => checkIn.mutate()} disabled={checkIn.isPending}>
          <LogIn size={16} style={{ marginRight: 8 }} /> {checkIn.isPending ? 'Checking In…' : 'Check In'}
        </Button>
      )}
      {hasCheckedIn && !hasCheckedOut && (
        <Button variant="secondary" onClick={() => checkOut.mutate()} disabled={checkOut.isPending}>
          <LogOut size={16} style={{ marginRight: 8 }} /> {checkOut.isPending ? 'Checking Out…' : 'Check Out'}
        </Button>
      )}
    </div>
  )
}
