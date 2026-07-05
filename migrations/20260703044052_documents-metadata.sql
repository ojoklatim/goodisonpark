-- Lets generated reports record row counts / generation details for display
-- in the Export Center's "Recently Generated" list.
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
