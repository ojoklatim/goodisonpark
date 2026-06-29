/**
 * @typedef {Object} Company
 * @property {string} id - UUID
 * @property {string} name
 * @property {string} slug
 * @property {string} logo_url
 * @property {string} industry
 * @property {string} country
 * @property {string} city
 * @property {string} address
 * @property {string} phone
 * @property {string} email
 * @property {string} website
 * @property {string} subscription_plan
 * @property {string} subscription_expires_at
 * @property {boolean} is_active
 * @property {string} created_at
 * @property {string} updated_at
 *
 * @typedef {Object} Profile
 * @property {string} id - UUID
 * @property {string} company_id - UUID
 * @property {string} branch_id - UUID
 * @property {string} first_name
 * @property {string} last_name
 * @property {string} avatar_url
 * @property {string} phone
 * @property {string} role - 'super_admin'|'company_admin'|'manager'|'team_leader'|'employee'
 * @property {string} department
 * @property {string} job_title
 * @property {string} employee_code
 * @property {string} date_joined
 * @property {boolean} is_active
 * @property {string} created_at
 * @property {string} updated_at
 *
 * @typedef {Object} Lead
 * @property {string} id - UUID
 * @property {string} company_id - UUID
 * @property {string} assigned_to - UUID
 * @property {string} first_name
 * @property {string} last_name
 * @property {string} email
 * @property {string} phone
 * @property {string} company_name
 * @property {string} source
 * @property {string} status - 'new'|'contacted'|'qualified'|'unqualified'|'converted'
 * @property {string} priority - 'low'|'medium'|'high'
 * @property {string} notes
 * @property {string} created_at
 * @property {string} updated_at
 *
 * @typedef {Object} Deal
 * @property {string} id - UUID
 * @property {string} company_id - UUID
 * @property {string} lead_id - UUID
 * @property {string} assigned_to - UUID
 * @property {string} title
 * @property {string} stage - 'new_lead'|'contacted'|'negotiation'|'proposal'|'closed_won'|'closed_lost'
 * @property {number} value
 * @property {string} currency
 * @property {number} probability
 * @property {string} expected_close_date
 * @property {string} actual_close_date
 * @property {string} lost_reason
 * @property {string} notes
 * @property {string} created_at
 * @property {string} updated_at
 *
 * @typedef {Object} Task
 * @property {string} id - UUID
 * @property {string} company_id - UUID
 * @property {string} project_id - UUID
 * @property {string} parent_task_id - UUID
 * @property {string} assigned_to - UUID
 * @property {string} assigned_by - UUID
 * @property {string} title
 * @property {string} description
 * @property {string} status - 'todo'|'in_progress'|'in_review'|'done'|'cancelled'
 * @property {string} priority - 'low'|'medium'|'high'|'critical'
 * @property {string} due_date
 * @property {string} completed_at
 * @property {number} estimated_hours
 * @property {number} actual_hours
 * @property {string[]} tags
 * @property {string} created_at
 * @property {string} updated_at
 */
export {}
