CREATE TABLE videos (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE frames (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL REFERENCES videos(id),
  ts_seconds NUMERIC NOT NULL,
  image_uri TEXT NOT NULL,
  ui_labels JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE transcripts (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL REFERENCES videos(id),
  start_seconds NUMERIC NOT NULL,
  end_seconds NUMERIC NOT NULL,
  text TEXT NOT NULL
);

CREATE TABLE skills (
  id TEXT PRIMARY KEY,
  software TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  level TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]',
  description TEXT NOT NULL,
  confidence NUMERIC NOT NULL DEFAULT 0.6,
  quality INTEGER NOT NULL DEFAULT 60,
  parent_id TEXT,
  variant_of TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE skill_steps (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES skills(id),
  step_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  shortcut JSONB NOT NULL DEFAULT '[]',
  start_seconds NUMERIC,
  end_seconds NUMERIC
);

CREATE TABLE skill_evidence (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES skills(id),
  video_id TEXT NOT NULL REFERENCES videos(id),
  source TEXT NOT NULL,
  weight NUMERIC NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
