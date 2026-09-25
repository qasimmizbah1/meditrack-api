-- 003_create_work_orders.sql

CREATE TABLE IF NOT EXISTS work_orders (
  id TEXT PRIMARY KEY,
  tracking_number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  facility_id TEXT NOT NULL,
  location_details TEXT,
  category TEXT NOT NULL DEFAULT 'Biomedical Equipment',
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'reported' CHECK (status IN ('reported', 'approved', 'assigned', 'in_progress', 'completed', 'verified', 'closed', 'cancelled')),
  reported_by TEXT NOT NULL,
  assigned_to TEXT,
  contractor_id TEXT,
  estimated_cost REAL DEFAULT 0,
  actual_cost REAL DEFAULT 0,
  due_date DATETIME,
  completed_at DATETIME,
  verified_at DATETIME,
  closed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE RESTRICT,
  FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS work_order_photos (
  id TEXT PRIMARY KEY,
  work_order_id TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  caption TEXT,
  stage TEXT NOT NULL DEFAULT 'initial' CHECK (stage IN ('initial', 'in_progress', 'completed', 'inspection')),
  uploaded_by TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (work_order_id) REFERENCES work_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_work_orders_tracking ON work_orders(tracking_number);
CREATE INDEX IF NOT EXISTS idx_work_orders_facility ON work_orders(facility_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_priority ON work_orders(priority);
CREATE INDEX IF NOT EXISTS idx_work_orders_reported_by ON work_orders(reported_by);
CREATE INDEX IF NOT EXISTS idx_work_order_photos_wo ON work_order_photos(work_order_id);
