/** SQLite schema for the heal store. Run history (test_run, test_result) belongs to @aiqa/reporting-engine. */
export const SCHEMA = `
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
