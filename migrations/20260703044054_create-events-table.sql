-- Calendar.jsx has always queried/inserted into an 'events' table that was
-- never actually created — the read path silently swallowed the resulting
-- "undefined_table" error (42P01) and rendered an empty calendar, and
-- creating an event has always failed outright. Adding the real table.

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
