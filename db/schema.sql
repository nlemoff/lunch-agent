CREATE TABLE office (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  headcount INTEGER NOT NULL,
  budget_per_person REAL,
  dietary_notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE restaurants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cuisine TEXT NOT NULL,
  distance_miles REAL NOT NULL,
  rating REAL NOT NULL,
  review_count INTEGER NOT NULL,
  catering_max INTEGER NOT NULL,
  prep_minutes INTEGER NOT NULL
);

CREATE TABLE menu_items (
  id TEXT PRIMARY KEY,
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  name TEXT NOT NULL,
  price REAL NOT NULL,
  serves INTEGER NOT NULL DEFAULT 1,
  tags TEXT NOT NULL DEFAULT ''
);

CREATE TABLE runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'done', 'failed')),
  final_message TEXT,
  error TEXT,
  model TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT
);

CREATE TABLE run_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES runs(id),
  kind TEXT NOT NULL CHECK (kind IN ('llm', 'tool')),
  name TEXT NOT NULL,
  input TEXT,
  output TEXT,
  error TEXT,
  duration_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER REFERENCES runs(id),
  restaurant_id TEXT NOT NULL REFERENCES restaurants(id),
  items TEXT NOT NULL,
  total REAL NOT NULL,
  eta TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('proposed', 'placed', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
