import { useMutation, useQueryClient } from '@tanstack/react-query'
import { insforge } from '../lib/insforge'
import { useAuth } from './useAuth'

export function useCreateInvitation() {
  const { company } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (newData) => {
      if (!company?.id) throw new Error("Company ID is not loaded.")

      // 1. Check if active/pending invitation already exists
      const { data: existingInvite, error: inviteQueryError } = await insforge
        .from('employee_invitations')
        .select('id, expires_at, status')
        .eq('email', newData.email)
        .maybeSingle()
      
      if (inviteQueryError) throw inviteQueryError
      if (existingInvite) {
        const isExpired = new Date(existingInvite.expires_at) < new Date()
        if (existingInvite.status === 'pending' && !isExpired) {
          throw new Error('A pending invitation for this email address already exists.')
        }
      }

      // 2. Check if email is already registered in profiles/auth_users
      const { data: existingProfile, error: profileQueryError } = await insforge
        .from('profiles_view')
        .select('id')
        .eq('email', newData.email)
        .maybeSingle()

      if (profileQueryError) throw profileQueryError
      if (existingProfile) {
        throw new Error('A registered account with this email address already exists.')
      }

      // 3. Insert the invitation and select the returned token
      const { data: insertedData, error: insertError } = await insforge
        .from('employee_invitations')
        .insert([{
          company_id: company.id,
          first_name: newData.first_name,
          last_name: newData.last_name,
          phone: newData.phone || null,
          email: newData.email,
          employee_code: newData.employee_code || null,
          department: newData.department || null,
          job_title: newData.job_title || null,
          branch_id: newData.branch_id || null,
          role: newData.role,
          date_joined: newData.date_joined || null,
          status: 'pending'
        }])
        .select('*')
        .single()

      if (insertError) throw insertError

      // 4. Send email welcome invitation
      const inviteLink = `${window.location.origin}/auth/register?token=${insertedData.token}`
      const emailHtml = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb;">
          <h2 style="color: #1e3a8a;">Welcome to Goodison Park Properties!</h2>
          <p>Hi ${insertedData.first_name},</p>
          <p>You have been invited to join the Goodison Park team as a <strong>${insertedData.role.replace('_', ' ')}</strong>.</p>
          <p>Please click the link below to complete your registration and set up your account password:</p>
          <p style="margin: 24px 0;">
            <a href="${inviteLink}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 4px; display: inline-block;">
              Complete Registration
            </a>
          </p>
          <p style="color: #6b7280; font-size: 12px;">This link will expire in 7 days (on ${new Date(insertedData.expires_at).toLocaleDateString()}).</p>
        </div>
      `

      const { error: emailError } = await insforge.emails.send({
        to: insertedData.email,
        subject: 'Invitation to Join Goodison Park Properties',
        html: emailHtml
      })

      if (emailError) {
        console.error("Email sending failed, fallback to manual link share:", emailError)
      }

      return insertedData
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['employees', company?.id])
      queryClient.invalidateQueries(['profiles', company?.id])
    }
  })
}
