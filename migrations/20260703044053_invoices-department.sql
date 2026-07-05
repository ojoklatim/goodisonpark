-- Finance Reports/Dashboard already assumed invoices had a department_id for
-- revenue-by-department breakdowns; that column never existed. Adding it for
-- real, and it's now selectable when creating an invoice.
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);
