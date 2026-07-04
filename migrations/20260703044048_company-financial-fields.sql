-- Add bank/mobile money/TIN fields to companies so quotations and invoices
-- can auto-populate payment details without re-entering them each time.
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS mobile_money_number TEXT,
  ADD COLUMN IF NOT EXISTS tin_number TEXT;
