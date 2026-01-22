-- Research Investigation Tool - Database Schema (AC-1.0 Compliant)
-- Strictly enforces provenance, context, and retraceability.

PRAGMA foreign_keys = ON;

-- Block: Research (Container)
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    research_question TEXT NOT NULL,
    hypothesis TEXT,
    timespan_start DATE,
    timespan_end DATE,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'archived')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Block: SearchRound (Phases)
CREATE TABLE IF NOT EXISTS search_rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    label TEXT NOT NULL,
    objective TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS search_queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    round_id INTEGER NOT NULL,
    query_text TEXT NOT NULL,
    executed_at DATE NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (round_id) REFERENCES search_rounds(id) ON DELETE CASCADE
);

-- Block: Source (Sacred Provenance)
CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    normalized_url TEXT NOT NULL,
    title TEXT,
    summary TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK(source_type IN ('article', 'video', 'paper', 'post', 'other')),
    author TEXT,
    publisher TEXT,
    published_at DATE,
    is_archived BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(project_id, normalized_url)
);

-- Many-to-Many Round-Source Join
CREATE TABLE IF NOT EXISTS round_sources (
    round_id INTEGER NOT NULL,
    source_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (round_id, source_id),
    FOREIGN KEY (round_id) REFERENCES search_rounds(id) ON DELETE CASCADE,
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

-- Block: Extract (Quotes)
CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL,
    quote_text TEXT NOT NULL,
    context_text TEXT NOT NULL,
    location_ref TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

-- Block: Evidence
CREATE TABLE IF NOT EXISTS evidence (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    source_id INTEGER NOT NULL,
    evidence_type TEXT,
    evidence_text TEXT,
    location_ref TEXT NOT NULL,
    why_relevant TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

-- --- Triggers for updated_at ---

CREATE TRIGGER IF NOT EXISTS update_projects_timestamp AFTER UPDATE ON projects
BEGIN UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_rounds_timestamp AFTER UPDATE ON search_rounds
BEGIN UPDATE search_rounds SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_queries_timestamp AFTER UPDATE ON search_queries
BEGIN UPDATE search_queries SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_sources_timestamp AFTER UPDATE ON sources
BEGIN UPDATE sources SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_round_sources_timestamp AFTER UPDATE ON round_sources
BEGIN UPDATE round_sources SET updated_at = CURRENT_TIMESTAMP WHERE round_id = NEW.round_id AND source_id = NEW.source_id; END;

CREATE TRIGGER IF NOT EXISTS update_quotes_timestamp AFTER UPDATE ON quotes
BEGIN UPDATE quotes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS update_evidence_timestamp AFTER UPDATE ON evidence
BEGIN UPDATE evidence SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;
