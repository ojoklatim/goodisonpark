-- Add secure token, expiration time, and status tracking to employee_invitations
ALTER TABLE employee_invitations
ADD COLUMN IF NOT EXISTS token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired'));
