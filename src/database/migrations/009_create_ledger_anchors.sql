-- Migration 009: Cryptographic Merkle Tree Ledger Anchors
CREATE TABLE IF NOT EXISTS ledger_anchors (
    id VARCHAR(36) PRIMARY KEY,
    batch_number INTEGER UNIQUE NOT NULL,
    start_event_id VARCHAR(36),
    end_event_id VARCHAR(36),
    event_count INTEGER NOT NULL,
    merkle_root VARCHAR(64) NOT NULL,
    previous_anchor_root VARCHAR(64) NOT NULL,
    anchor_hash VARCHAR(64) NOT NULL,
    network_tx_hash VARCHAR(66),
    anchored_by VARCHAR(36) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (anchored_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_ledger_anchors_batch ON ledger_anchors(batch_number);
CREATE INDEX IF NOT EXISTS idx_ledger_anchors_root ON ledger_anchors(merkle_root);
