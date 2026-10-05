-- Migration 014: Add Inspector Scope (works_engineer vs works_inspector vs both)
ALTER TABLE users ADD COLUMN inspector_scope TEXT DEFAULT 'both';
