-- Migration: create qr_mappings table
-- Run this in your Supabase SQL editor or via psql to persist QR -> member mappings

CREATE TABLE IF NOT EXISTS qr_mappings (
  qr_code_id TEXT PRIMARY KEY,
  member_id UUID NOT NULL,
  event_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qr_mappings_member_id ON qr_mappings(member_id);

-- Enable Row Level Security (follow project pattern)
ALTER TABLE qr_mappings ENABLE ROW LEVEL SECURITY;

-- Basic permissive policy used elsewhere in this project; adapt for your auth needs
CREATE POLICY "Allow all operations on qr_mappings" ON qr_mappings
  FOR ALL USING (true) WITH CHECK (true);

-- Notes:
-- - If you prefer to scope mappings per event, ensure callers pass event_id when saving.
-- - After running this migration, QR mappings saved by the app will be persisted
--   to Supabase and available across devices that use the same DB.
