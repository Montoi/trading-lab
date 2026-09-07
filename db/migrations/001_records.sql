BEGIN;
SELECT pg_advisory_xact_lock(61243017);
CREATE TABLE IF NOT EXISTS schema_migrations (
  version integer PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS records (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('strategy','run')),
  payload text NOT NULL,
  updated timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS records_updated_idx ON records (updated DESC);
INSERT INTO schema_migrations(version) VALUES (1) ON CONFLICT DO NOTHING;
COMMIT;
