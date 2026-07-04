-- Support the full Ugandan quotation/invoice document template:
-- editable subject line + terms text on quotations, and a tax rate +
-- editable payment terms text on invoices (previously only tax_amount
-- was stored, with no rate and no terms field).

ALTER TABLE quotations
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS terms TEXT;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) DEFAULT 18,
  ADD COLUMN IF NOT EXISTS payment_terms TEXT;
