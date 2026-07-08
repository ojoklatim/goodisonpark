-- ============================================================================
-- GOODISON PARK — Complete Database Setup
-- ============================================================================
-- Run this SQL file ONCE on a fresh InsForge project to create the entire
-- database schema, Row-Level Security policies, functions, triggers, indexes,
-- and storage bucket configuration.
--
-- Usage:
--   npx @insforge/cli db query --file setup.sql
--
-- After running this file, create storage buckets (see Section 7 below).
-- ============================================================================


-- ============================================================================
-- 1. HELPER FUNCTIONS
-- ============================================================================

-- Company tenant isolation helper (used by all RLS policies)
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Auto-update updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- 2. TABLES
-- ============================================================================
-- Tables are created in dependency order. All columns from incremental
-- migrations have been merged into the final CREATE TABLE statements.

-- Core -----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  industry TEXT,
  country TEXT,
  city TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  subscription_plan TEXT DEFAULT 'trial'
    CHECK (subscription_plan IN ('trial','starter','professional','enterprise')),
  subscription_expires_at TIMESTAMPTZ,
  bank_name TEXT,
  bank_account_name TEXT,
  bank_account_number TEXT,
  mobile_money_number TEXT,
  tin_number TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  is_headquarters BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'employee'
    CHECK (role IN ('super_admin','company_admin','manager','team_leader','employee')),
  department TEXT,
  job_title TEXT,
  employee_code TEXT,
  date_joined DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  module TEXT NOT NULL,
  can_view BOOLEAN DEFAULT FALSE,
  can_create BOOLEAN DEFAULT FALSE,
  can_edit BOOLEAN DEFAULT FALSE,
  can_delete BOOLEAN DEFAULT FALSE,
  can_export BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS employee_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id),
  email TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'employee',
  department TEXT,
  job_title TEXT,
  employee_code TEXT,
  date_joined DATE,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sales Pipeline -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES profiles(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company_name TEXT,
  source TEXT,
  status TEXT DEFAULT 'new'
    CHECK (status IN ('new','contacted','qualified','unqualified','converted')),
  priority TEXT DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id),
  assigned_to UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  stage TEXT DEFAULT 'new_lead'
    CHECK (stage IN ('new_lead','contacted','negotiation','proposal','closed_won','closed_lost')),
  value NUMERIC(15,2),
  currency TEXT DEFAULT 'UGX',
  probability INTEGER DEFAULT 0,
  expected_close_date DATE,
  actual_close_date DATE,
  lost_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deal_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  type TEXT NOT NULL,
  title TEXT,
  description TEXT,
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company_name TEXT,
  address TEXT,
  total_deal_value NUMERIC(15,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id),
  client_id UUID REFERENCES clients(id),
  quotation_number TEXT NOT NULL,
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft','sent','accepted','rejected','expired')),
  items JSONB DEFAULT '[]',
  subtotal NUMERIC(15,2) DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 0,
  tax_amount NUMERIC(15,2) DEFAULT 0,
  total NUMERIC(15,2) DEFAULT 0,
  currency TEXT DEFAULT 'UGX',
  valid_until DATE,
  subject TEXT,
  terms TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id),
  profile_id UUID REFERENCES profiles(id),
  amount NUMERIC(15,2),
  rate NUMERIC(5,2),
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','approved','paid')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Operations & Projects (departments MUST come before invoices) --------------

CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  head_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices (depends on quotations, clients, AND departments)
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  quotation_id UUID REFERENCES quotations(id),
  client_id UUID REFERENCES clients(id),
  department_id UUID REFERENCES departments(id),
  invoice_number TEXT NOT NULL,
  status TEXT DEFAULT 'unpaid'
    CHECK (status IN ('draft','unpaid','partial','paid','overdue','cancelled')),
  items JSONB DEFAULT '[]',
  subtotal NUMERIC(15,2) DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 18,
  tax_amount NUMERIC(15,2) DEFAULT 0,
  discount NUMERIC(15,2) DEFAULT 0,
  total NUMERIC(15,2) DEFAULT 0,
  amount_paid NUMERIC(15,2) DEFAULT 0,
  currency TEXT DEFAULT 'UGX',
  due_date DATE,
  paid_at TIMESTAMPTZ,
  payment_terms TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'planning'
    CHECK (status IN ('planning','active','on_hold','completed','cancelled')),
  priority TEXT DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high','critical')),
  start_date DATE,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES profiles(id),
  assigned_by UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo'
    CHECK (status IN ('todo','in_progress','in_review','done','cancelled')),
  priority TEXT DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high','critical')),
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  estimated_hours NUMERIC(5,2),
  actual_hours NUMERIC(5,2),
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  type TEXT NOT NULL,
  reference_id UUID,
  reference_table TEXT,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  file_type TEXT,
  file_size INTEGER,
  category TEXT,
  is_public_to_company BOOLEAN DEFAULT FALSE,
  tags TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id),
  title TEXT NOT NULL,
  content TEXT,
  version TEXT DEFAULT '1.0',
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft','active','archived')),
  last_reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  attendees UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employee Performance -------------------------------------------------------

CREATE TABLE IF NOT EXISTS kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  metric_type TEXT DEFAULT 'number'
    CHECK (metric_type IN ('number','percentage','currency','boolean')),
  target_value NUMERIC(15,2),
  current_value NUMERIC(15,2) DEFAULT 0,
  period TEXT DEFAULT 'monthly'
    CHECK (period IN ('daily','weekly','monthly','quarterly','yearly')),
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS performance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id),
  reviewer_id UUID REFERENCES profiles(id),
  period TEXT,
  overall_score NUMERIC(3,1),
  strengths TEXT,
  areas_for_improvement TEXT,
  goals_for_next_period TEXT,
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','acknowledged')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id),
  date DATE NOT NULL,
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  status TEXT DEFAULT 'present'
    CHECK (status IN ('present','absent','half_day','late','on_leave')),
  marked_by UUID REFERENCES profiles(id),
  source TEXT DEFAULT 'admin'
    CHECK (source IN ('self', 'admin')),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS daily_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id),
  date DATE NOT NULL,
  activities JSONB DEFAULT '[]',
  plan_for_tomorrow TEXT,
  status TEXT DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'reviewed')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  admin_feedback TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id),
  set_by UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active','completed','cancelled')),
  progress INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rewards_penalties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id),
  issued_by UUID REFERENCES profiles(id),
  type TEXT NOT NULL CHECK (type IN ('reward','penalty')),
  title TEXT NOT NULL,
  description TEXT,
  points INTEGER DEFAULT 0,
  amount NUMERIC(15,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HR -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id),
  leave_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count INTEGER,
  reason TEXT,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','cancelled')),
  approved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id),
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  basic_salary NUMERIC(15,2) DEFAULT 0,
  allowances JSONB DEFAULT '{}',
  deductions JSONB DEFAULT '{}',
  gross_salary NUMERIC(15,2) DEFAULT 0,
  net_salary NUMERIC(15,2) DEFAULT 0,
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft','processed','paid')),
  paid_at TIMESTAMPTZ,
  processed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  audience TEXT DEFAULT 'all'
    CHECK (audience IN ('all','department','role')),
  audience_filter TEXT,
  is_pinned BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS training_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  provider TEXT,
  date_completed DATE,
  certificate_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Finance --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  submitted_by UUID REFERENCES profiles(id),
  department_id UUID REFERENCES departments(id),
  category TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(15,2) NOT NULL,
  currency TEXT DEFAULT 'UGX',
  date DATE NOT NULL,
  receipt_url TEXT,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','paid')),
  approved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id),
  category TEXT,
  amount NUMERIC(15,2) NOT NULL,
  period TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Communication --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id),
  recipient_id UUID REFERENCES profiles(id),
  thread_id UUID,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Marketing ------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS social_media_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  platform TEXT NOT NULL
    CHECK (platform IN ('youtube','twitter_x','instagram','tiktok','linkedin')),
  handle TEXT,
  account_name TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  is_connected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS social_media_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES social_media_accounts(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  followers_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  posts_count INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  engagements INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- 3. VIEWS & SECURITY DEFINER FUNCTIONS
-- ============================================================================

-- Profiles view — joins profiles with auth.users to expose email.
-- Uses SECURITY DEFINER to bypass auth schema permission restrictions.
CREATE OR REPLACE FUNCTION public.get_profiles()
RETURNS TABLE (
  id UUID,
  company_id UUID,
  branch_id UUID,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  role TEXT,
  department TEXT,
  job_title TEXT,
  employee_code TEXT,
  date_joined DATE,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  email TEXT
) SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.company_id,
    p.branch_id,
    p.first_name,
    p.last_name,
    p.avatar_url,
    p.phone,
    p.role,
    p.department,
    p.job_title,
    p.employee_code,
    p.date_joined,
    p.is_active,
    p.created_at,
    p.updated_at,
    u.email::text
  FROM public.profiles p
  LEFT JOIN auth.users u ON p.id = u.id;
END;
$$ LANGUAGE plpgsql;

DROP VIEW IF EXISTS public.profiles_view CASCADE;
CREATE OR REPLACE VIEW public.profiles_view AS
SELECT * FROM public.get_profiles();


-- ============================================================================
-- 4. TRIGGERS
-- ============================================================================

-- 4a. updated_at auto-timestamps
DROP TRIGGER IF EXISTS tr_companies_updated_at ON companies;
CREATE TRIGGER tr_companies_updated_at
  BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_profiles_updated_at ON profiles;
CREATE TRIGGER tr_profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_leads_updated_at ON leads;
CREATE TRIGGER tr_leads_updated_at
  BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_deals_updated_at ON deals;
CREATE TRIGGER tr_deals_updated_at
  BEFORE UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_clients_updated_at ON clients;
CREATE TRIGGER tr_clients_updated_at
  BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_tasks_updated_at ON tasks;
CREATE TRIGGER tr_tasks_updated_at
  BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS tr_daily_activity_logs_updated_at ON daily_activity_logs;
CREATE TRIGGER tr_daily_activity_logs_updated_at
  BEFORE UPDATE ON daily_activity_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 4b. Invitation email uniqueness (prevents inviting already-registered emails)
CREATE OR REPLACE FUNCTION public.check_invite_email_uniqueness()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = NEW.email) THEN
    RAISE EXCEPTION 'An account with the email % already exists in the system.', NEW.email;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_check_invite_email_uniqueness ON employee_invitations;
CREATE TRIGGER tr_check_invite_email_uniqueness
  BEFORE INSERT OR UPDATE OF email ON employee_invitations
  FOR EACH ROW EXECUTE FUNCTION check_invite_email_uniqueness();


-- ============================================================================
-- 5. INDEXES
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS attendance_profile_date_unique
  ON attendance (profile_id, date);

CREATE UNIQUE INDEX IF NOT EXISTS daily_activity_logs_profile_date_unique
  ON daily_activity_logs (profile_id, date);

CREATE INDEX IF NOT EXISTS leads_company_id_status_idx
  ON leads(company_id, status);

CREATE INDEX IF NOT EXISTS deals_company_id_stage_idx
  ON deals(company_id, stage);

CREATE INDEX IF NOT EXISTS tasks_company_id_assigned_to_status_idx
  ON tasks(company_id, assigned_to, status);

CREATE INDEX IF NOT EXISTS attendance_company_id_profile_id_date_idx
  ON attendance(company_id, profile_id, date);

CREATE INDEX IF NOT EXISTS expenses_company_id_status_idx
  ON expenses(company_id, status);

CREATE INDEX IF NOT EXISTS notifications_user_id_is_read_idx
  ON notifications(user_id, is_read);

CREATE INDEX IF NOT EXISTS social_media_metrics_account_id_date_idx
  ON social_media_metrics(account_id, date DESC);


-- ============================================================================
-- 6. ROW-LEVEL SECURITY (RLS)
-- ============================================================================

-- ---------- companies (special: uses id instead of company_id) ----------
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "companies_select" ON companies FOR SELECT USING (id = get_my_company_id());
CREATE POLICY "companies_insert" ON companies FOR INSERT WITH CHECK (true);
CREATE POLICY "companies_update" ON companies FOR UPDATE USING (
  id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);
CREATE POLICY "companies_delete" ON companies FOR DELETE USING (
  id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
);

-- ---------- profiles (special: can update own profile) ----------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (
    id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager','company_admin','super_admin')
  )
);
CREATE POLICY "profiles_delete" ON profiles FOR DELETE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);

-- ---------- branches ----------
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branches_select" ON branches FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "branches_insert" ON branches FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "branches_update" ON branches FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager','company_admin','super_admin')
);
CREATE POLICY "branches_delete" ON branches FOR DELETE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);

-- ---------- role_permissions ----------
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "role_permissions_select" ON role_permissions FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "role_permissions_insert" ON role_permissions FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "role_permissions_update" ON role_permissions FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager','company_admin','super_admin')
);
CREATE POLICY "role_permissions_delete" ON role_permissions FOR DELETE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);

-- ---------- employee_invitations ----------
ALTER TABLE employee_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employee_invitations_select" ON employee_invitations FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "employee_invitations_insert" ON employee_invitations FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "employee_invitations_update" ON employee_invitations FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager','company_admin','super_admin')
);
CREATE POLICY "employee_invitations_delete" ON employee_invitations FOR DELETE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);

-- ---------- leads ----------
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads_select" ON leads FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "leads_insert" ON leads FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "leads_update" ON leads FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager','company_admin','super_admin')
);
CREATE POLICY "leads_delete" ON leads FOR DELETE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);

-- ---------- deals ----------
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deals_select" ON deals FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "deals_insert" ON deals FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "deals_update" ON deals FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager','company_admin','super_admin')
);
CREATE POLICY "deals_delete" ON deals FOR DELETE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);

-- ---------- deal_activities (no company_id — uses parent deal) ----------
ALTER TABLE deal_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deal_activities_select" ON deal_activities FOR SELECT USING (
  EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_activities.deal_id AND deals.company_id = get_my_company_id())
);
CREATE POLICY "deal_activities_insert" ON deal_activities FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_activities.deal_id AND deals.company_id = get_my_company_id())
);
CREATE POLICY "deal_activities_update" ON deal_activities FOR UPDATE USING (
  EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_activities.deal_id AND deals.company_id = get_my_company_id())
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager','company_admin','super_admin')
);
CREATE POLICY "deal_activities_delete" ON deal_activities FOR DELETE USING (
  EXISTS (SELECT 1 FROM deals WHERE deals.id = deal_activities.deal_id AND deals.company_id = get_my_company_id())
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);

-- ---------- clients ----------
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_select" ON clients FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "clients_insert" ON clients FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "clients_update" ON clients FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager','company_admin','super_admin')
);
CREATE POLICY "clients_delete" ON clients FOR DELETE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);

-- ---------- quotations ----------
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quotations_select" ON quotations FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "quotations_insert" ON quotations FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "quotations_update" ON quotations FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager','company_admin','super_admin')
);
CREATE POLICY "quotations_delete" ON quotations FOR DELETE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);

-- ---------- invoices ----------
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices_select" ON invoices FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "invoices_insert" ON invoices FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "invoices_update" ON invoices FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager','company_admin','super_admin')
);
CREATE POLICY "invoices_delete" ON invoices FOR DELETE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);

-- ---------- commissions ----------
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commissions_select" ON commissions FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "commissions_insert" ON commissions FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "commissions_update" ON commissions FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager','company_admin','super_admin')
);
CREATE POLICY "commissions_delete" ON commissions FOR DELETE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);

-- ---------- departments ----------
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "departments_select" ON departments FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "departments_insert" ON departments FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "departments_update" ON departments FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager','company_admin','super_admin')
);
CREATE POLICY "departments_delete" ON departments FOR DELETE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);

-- ---------- projects ----------
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects_select" ON projects FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "projects_insert" ON projects FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "projects_update" ON projects FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager','company_admin','super_admin')
);
CREATE POLICY "projects_delete" ON projects FOR DELETE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);

-- ---------- tasks ----------
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tasks_select" ON tasks FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "tasks_insert" ON tasks FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "tasks_update" ON tasks FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager','company_admin','super_admin')
);
CREATE POLICY "tasks_delete" ON tasks FOR DELETE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);

-- ---------- approvals ----------
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approvals_select" ON approvals FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "approvals_insert" ON approvals FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "approvals_update" ON approvals FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager','company_admin','super_admin')
);
CREATE POLICY "approvals_delete" ON approvals FOR DELETE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);

-- ---------- documents ----------
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documents_select" ON documents FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "documents_insert" ON documents FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "documents_update" ON documents FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager','company_admin','super_admin')
);
CREATE POLICY "documents_delete" ON documents FOR DELETE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);

-- ---------- sops ----------
ALTER TABLE sops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sops_select" ON sops FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "sops_insert" ON sops FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "sops_update" ON sops FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager','company_admin','super_admin')
);
CREATE POLICY "sops_delete" ON sops FOR DELETE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);

-- ---------- events ----------
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_select" ON events FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "events_insert" ON events FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "events_update" ON events FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager','company_admin','super_admin')
);
CREATE POLICY "events_delete" ON events FOR DELETE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);

-- ---------- kpis ----------
ALTER TABLE kpis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kpis_select" ON kpis FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "kpis_insert" ON kpis FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "kpis_update" ON kpis FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager','company_admin','super_admin')
);
CREATE POLICY "kpis_delete" ON kpis FOR DELETE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);

-- ---------- performance_reviews ----------
ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "performance_reviews_select" ON performance_reviews FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "performance_reviews_insert" ON performance_reviews FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "performance_reviews_update" ON performance_reviews FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager','company_admin','super_admin')
);
CREATE POLICY "performance_reviews_delete" ON performance_reviews FOR DELETE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);

-- ---------- attendance ----------
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance_select" ON attendance FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "attendance_insert" ON attendance FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "attendance_update" ON attendance FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (
    profile_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager','company_admin','super_admin')
  )
);
CREATE POLICY "attendance_delete" ON attendance FOR DELETE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);

-- ---------- daily_activity_logs ----------
ALTER TABLE daily_activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_activity_logs_select" ON daily_activity_logs FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "daily_activity_logs_insert" ON daily_activity_logs FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "daily_activity_logs_update" ON daily_activity_logs FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (
    profile_id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager','company_admin','super_admin')
  )
);
CREATE POLICY "daily_activity_logs_delete" ON daily_activity_logs FOR DELETE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);

-- ---------- goals ----------
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goals_select" ON goals FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "goals_insert" ON goals FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "goals_update" ON goals FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager','company_admin','super_admin')
);
CREATE POLICY "goals_delete" ON goals FOR DELETE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);

-- ---------- rewards_penalties ----------
ALTER TABLE rewards_penalties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rewards_penalties_select" ON rewards_penalties FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "rewards_penalties_insert" ON rewards_penalties FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "rewards_penalties_update" ON rewards_penalties FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager','company_admin','super_admin')
);
CREATE POLICY "rewards_penalties_delete" ON rewards_penalties FOR DELETE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);

-- ---------- leave_requests ----------
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leave_requests_select" ON leave_requests FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "leave_requests_insert" ON leave_requests FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "leave_requests_update" ON leave_requests FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager','company_admin','super_admin')
);
CREATE POLICY "leave_requests_delete" ON leave_requests FOR DELETE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);

-- ---------- payroll ----------
ALTER TABLE payroll ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payroll_select" ON payroll FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "payroll_insert" ON payroll FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "payroll_update" ON payroll FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager','company_admin','super_admin')
);
CREATE POLICY "payroll_delete" ON payroll FOR DELETE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);

-- ---------- announcements ----------
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "announcements_select" ON announcements FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "announcements_insert" ON announcements FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "announcements_update" ON announcements FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager','company_admin','super_admin')
);
CREATE POLICY "announcements_delete" ON announcements FOR DELETE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);

-- ---------- training_records ----------
ALTER TABLE training_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "training_records_select" ON training_records FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "training_records_insert" ON training_records FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "training_records_update" ON training_records FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager','company_admin','super_admin')
);
CREATE POLICY "training_records_delete" ON training_records FOR DELETE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);

-- ---------- expenses ----------
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses_select" ON expenses FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "expenses_insert" ON expenses FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "expenses_update" ON expenses FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager','company_admin','super_admin')
);
CREATE POLICY "expenses_delete" ON expenses FOR DELETE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);

-- ---------- budgets ----------
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budgets_select" ON budgets FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "budgets_insert" ON budgets FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "budgets_update" ON budgets FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager','company_admin','super_admin')
);
CREATE POLICY "budgets_delete" ON budgets FOR DELETE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);

-- ---------- messages (special: sender/recipient scoping) ----------
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_select" ON messages FOR SELECT USING (
  company_id = get_my_company_id()
  AND (sender_id = auth.uid() OR recipient_id = auth.uid())
);
CREATE POLICY "messages_insert" ON messages FOR INSERT WITH CHECK (
  company_id = get_my_company_id() AND sender_id = auth.uid()
);
CREATE POLICY "messages_update" ON messages FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (sender_id = auth.uid() OR recipient_id = auth.uid())
);
CREATE POLICY "messages_delete" ON messages FOR DELETE USING (
  company_id = get_my_company_id() AND sender_id = auth.uid()
);

-- ---------- notifications (special: user sees only their own) ----------
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications_insert" ON notifications FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "notifications_delete" ON notifications FOR DELETE USING (user_id = auth.uid());

-- ---------- social_media_accounts ----------
ALTER TABLE social_media_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "social_media_accounts_select" ON social_media_accounts FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "social_media_accounts_insert" ON social_media_accounts FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "social_media_accounts_update" ON social_media_accounts FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager','company_admin','super_admin')
);
CREATE POLICY "social_media_accounts_delete" ON social_media_accounts FOR DELETE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);

-- ---------- social_media_metrics ----------
ALTER TABLE social_media_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "social_media_metrics_select" ON social_media_metrics FOR SELECT USING (company_id = get_my_company_id());
CREATE POLICY "social_media_metrics_insert" ON social_media_metrics FOR INSERT WITH CHECK (company_id = get_my_company_id());
CREATE POLICY "social_media_metrics_update" ON social_media_metrics FOR UPDATE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('manager','company_admin','super_admin')
);
CREATE POLICY "social_media_metrics_delete" ON social_media_metrics FOR DELETE USING (
  company_id = get_my_company_id()
  AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('company_admin','super_admin')
);


-- ============================================================================
-- 7. STORAGE BUCKETS
-- ============================================================================
-- Storage buckets must be created via the InsForge CLI (not via SQL).
-- Run these commands AFTER executing this SQL file:
--
--   npx @insforge/cli storage create-bucket documents --public
--   npx @insforge/cli storage create-bucket branding --public
--
-- Buckets:
--   documents  — deal attachments, client documents, exported reports
--   branding   — company logo uploads
-- ============================================================================


-- ============================================================================
-- SETUP COMPLETE ✓
-- ============================================================================
-- Your database is now fully configured. Next steps:
--
-- 1. Create storage buckets (see Section 7 above)
-- 2. Update .env.local with your project's credentials
-- 3. Run: npm install && npm run dev
-- 4. Register your first company admin at /auth/register-company
-- ============================================================================
