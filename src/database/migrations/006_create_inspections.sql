-- 006_create_inspections.sql

CREATE TABLE IF NOT EXISTS inspections (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  inspector_id TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('PASS', 'FAIL')),
  checklist_results TEXT,
  observations TEXT,
  recommendations TEXT,
  inspected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (inspector_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS inspection_photos (
  id TEXT PRIMARY KEY,
  inspection_id TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  caption TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_inspections_wo ON inspections(work_order_id);
CREATE INDEX IF NOT EXISTS idx_inspections_result ON inspections(result);
CREATE INDEX IF NOT EXISTS idx_inspections_inspector ON inspections(inspector_id);
