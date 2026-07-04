-- Daily field-activity tracking: employees log what they did today (a simple
-- checklist) plus a plan for tomorrow, submitted once per day. Admins/managers
-- review each submission and can leave feedback.

CREATE TABLE IF NOT EXISTS daily_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES profiles(id),
  date DATE NOT NULL,
  activities JSONB DEFAULT '[]', -- [{id, text, completed}]
  plan_for_tomorrow TEXT,
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'reviewed')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  admin_feedback TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS daily_activity_logs_profile_date_unique ON daily_activity_logs (profile_id, date);

DROP TRIGGER IF EXISTS tr_daily_activity_logs_updated_at ON daily_activity_logs;
CREATE TRIGGER tr_daily_activity_logs_updated_at
BEFORE UPDATE ON daily_activity_logs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();
