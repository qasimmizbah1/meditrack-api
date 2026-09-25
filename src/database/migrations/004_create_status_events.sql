-- 004_create_status_events.sql

CREATE TABLE IF NOT EXISTS status_events (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  status TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  previous_hash TEXT NOT NULL,
  current_hash TEXT NOT NULL,
  notes TEXT,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_status_events_wo ON status_events(work_order_id);
CREATE INDEX IF NOT EXISTS idx_status_events_created ON status_events(created_at);
CREATE INDEX IF NOT EXISTS idx_status_events_current_hash ON status_events(current_hash);
