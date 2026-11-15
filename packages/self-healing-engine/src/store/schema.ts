/** SQLite schema. test_run and test_result are created now and filled by the reporter in a later sprint. */
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS test_run (
  id TEXT PRIMARY KEY, started_at TEXT NOT NULL, finished_at TEXT,
  git_sha TEXT, branch TEXT, environment TEXT NOT NULL, project TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS test_result (
  run_id TEXT NOT NULL REFERENCES test_run(id), test_id TEXT NOT NULL, retry INTEGER NOT NULL,
  title TEXT NOT NULL, file TEXT NOT NULL, status TEXT NOT NULL, duration_ms INTEGER NOT NULL,
  error_message TEXT, failure_category TEXT,
  PRIMARY KEY (run_id, test_id, retry)
);
CREATE TABLE IF NOT EXISTS locator_fingerprint (
  locator_key TEXT PRIMARY KEY, selector TEXT NOT NULL, tag TEXT, role TEXT,
  accessible_name TEXT, text TEXT, test_id_attr TEXT, attributes TEXT NOT NULL,
  ancestor_path TEXT NOT NULL, css_path TEXT NOT NULL, context TEXT NOT NULL DEFAULT '', page_url TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS heal_event (
  id INTEGER PRIMARY KEY, test_id TEXT NOT NULL, locator_key TEXT NOT NULL,
  failed_selector TEXT NOT NULL, healed_selector TEXT, strategy TEXT NOT NULL,
  score REAL NOT NULL, outcome TEXT NOT NULL, created_at TEXT NOT NULL
);
`;
