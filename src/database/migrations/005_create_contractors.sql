-- 005_create_contractors.sql

CREATE TABLE IF NOT EXISTS contractors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  registration_number TEXT NOT NULL UNIQUE,
  specialty TEXT NOT NULL,
  contact_person TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  compliance_status TEXT NOT NULL DEFAULT 'compliant' CHECK (compliance_status IN ('compliant', 'warning', 'non_compliant')),
  rating REAL DEFAULT 5.0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contractor_documents (
  id TEXT PRIMARY KEY,
  contractor_id TEXT NOT NULL,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'License',
  file_url TEXT NOT NULL,
  expiry_date DATETIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'expiring_soon', 'expired')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contractor_id) REFERENCES contractors(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_contractors_reg ON contractors(registration_number);
CREATE INDEX IF NOT EXISTS idx_contractors_compliance ON contractors(compliance_status);
CREATE INDEX IF NOT EXISTS idx_contractor_docs_contractor ON contractor_documents(contractor_id);
CREATE INDEX IF NOT EXISTS idx_contractor_docs_expiry ON contractor_documents(expiry_date);
