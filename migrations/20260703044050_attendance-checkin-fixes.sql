-- Attendance.jsx already assumed both of these existed (upsert onConflict
-- 'profile_id,date', and a marked_by column) but neither was actually in
-- the schema — fixing that, and adding what self check-in needs.

ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS marked_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'admin' CHECK (source IN ('self', 'admin'));

-- One attendance row per employee per day, so self check-in can safely upsert.
CREATE UNIQUE INDEX IF NOT EXISTS attendance_profile_date_unique ON attendance (profile_id, date);
