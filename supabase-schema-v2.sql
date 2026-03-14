-- Finance Tracker v2 schema
-- Composite primary key: (user_id, year)
-- Each row stores one year's worth of data for a user

CREATE TABLE IF NOT EXISTS tracker_data (
  user_id    TEXT    NOT NULL,
  year       INTEGER NOT NULL DEFAULT 2026,
  data       JSONB   NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, year)
);

-- Index for fast lookup of all years for a user
CREATE INDEX IF NOT EXISTS idx_tracker_data_user
  ON tracker_data (user_id, year DESC);

-- Row-level security (optional, adjust to your auth setup)
ALTER TABLE tracker_data ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anon key (simple username-based auth)
CREATE POLICY "Allow all for anon"
  ON tracker_data
  FOR ALL
  USING (true)
  WITH CHECK (true);
