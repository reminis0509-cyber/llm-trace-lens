-- LLM Trace Lens - Initial Schema

CREATE TABLE IF NOT EXISTS traces (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,

  -- Provider/Model
  provider TEXT NOT NULL,
  model TEXT NOT NULL,

  -- Request
  prompt TEXT NOT NULL,
  system_prompt TEXT,
  temperature REAL,

  -- Response
  raw_response TEXT NOT NULL,
  structured_thinking TEXT NOT NULL,
  structured_confidence REAL NOT NULL,
  structured_evidence TEXT NOT NULL,  -- JSON array
  structured_risks TEXT NOT NULL,      -- JSON array
  structured_answer TEXT NOT NULL,

  -- Validation
  validation_overall TEXT NOT NULL,    -- PASS/WARN/FAIL/BLOCK
  validation_score INTEGER NOT NULL,
  validation_rules TEXT NOT NULL,      -- JSON array

  -- Metrics
  latency_ms INTEGER NOT NULL,
  tokens_prompt INTEGER,
  tokens_completion INTEGER,
  tokens_total INTEGER,
  attempts INTEGER NOT NULL DEFAULT 1,

  -- L3/L4 Future
  internal_trace TEXT,                 -- JSON or NULL

  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_traces_timestamp ON traces(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_traces_provider ON traces(provider);
CREATE INDEX IF NOT EXISTS idx_traces_model ON traces(model);
CREATE INDEX IF NOT EXISTS idx_traces_validation_overall ON traces(validation_overall);
CREATE INDEX IF NOT EXISTS idx_traces_created_at ON traces(created_at DESC);

-- MVP v2 traces table (new simplified schema)
CREATE TABLE IF NOT EXISTS traces_v2 (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,

  -- Provider/Model
  provider TEXT NOT NULL,
  model TEXT NOT NULL,

  -- Request
  prompt TEXT NOT NULL,

  -- Structured Response (new format)
  answer TEXT NOT NULL,
  confidence INTEGER NOT NULL,
  evidence TEXT NOT NULL,      -- JSON array
  alternatives TEXT NOT NULL,  -- JSON array

  -- Validation Results
  validation_confidence_status TEXT NOT NULL,
  validation_confidence_issues TEXT NOT NULL,  -- JSON array
  validation_risk_status TEXT NOT NULL,
  validation_risk_issues TEXT NOT NULL,        -- JSON array
  validation_overall TEXT NOT NULL,

  -- Metrics
  latency_ms INTEGER NOT NULL,

  -- L3/L4 Future
  internal_trace TEXT,  -- JSON or NULL

  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_traces_v2_timestamp ON traces_v2(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_traces_v2_provider ON traces_v2(provider);
CREATE INDEX IF NOT EXISTS idx_traces_v2_validation_overall ON traces_v2(validation_overall);
