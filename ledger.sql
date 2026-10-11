-- ledger.sql
-- Optional backend schema for Ledger. The app currently runs entirely
-- client-side against localStorage; this schema is here for if/when you
-- add a sync server or multi-device backend.

CREATE TABLE IF NOT EXISTS transactions (
    id          TEXT PRIMARY KEY,
    description TEXT NOT NULL,
    amount      NUMERIC(12,2) NOT NULL,   -- negative = expense, positive = income
    category    TEXT NOT NULL,
    txn_date    DATE NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vault_entries (
    id          TEXT PRIMARY KEY,
    site        TEXT NOT NULL,
    username    TEXT,
    notes       TEXT,
    iv          TEXT NOT NULL,            -- AES-GCM initialization vector, base64
    ciphertext  TEXT NOT NULL,            -- AES-GCM encrypted password, base64
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL
);

-- Seed default currency
INSERT INTO settings (key, value) VALUES ('currency', '₹')
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions (txn_date);
