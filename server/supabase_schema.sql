CREATE TABLE IF NOT EXISTS public.projects (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text NOT NULL,
  research_question text NOT NULL,
  hypothesis text,
  timespan_start date,
  timespan_end date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.search_rounds (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id bigint NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  label text NOT NULL,
  objective text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.search_queries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  round_id bigint NOT NULL REFERENCES public.search_rounds(id) ON DELETE RESTRICT,
  query_text text NOT NULL,
  executed_at date NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sources (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id bigint NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  url text NOT NULL,
  normalized_url text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('article','video','paper','post','other')),
  title text,
  author text,
  publisher text,
  published_at date,
  summary text,
  notes text,
  is_archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sources_project_normalized_url_key UNIQUE (project_id, normalized_url)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sources_summary_nonempty'
  ) THEN
    ALTER TABLE public.sources
      ADD CONSTRAINT sources_summary_nonempty
      CHECK (length(btrim(summary)) > 0)
      NOT VALID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.round_sources (
  round_id bigint NOT NULL REFERENCES public.search_rounds(id) ON DELETE CASCADE,
  source_id bigint NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (round_id, source_id)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'extracts'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'quotes'
  ) THEN
    ALTER TABLE public.extracts RENAME TO quotes;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.quotes (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id bigint NOT NULL REFERENCES public.sources(id) ON DELETE RESTRICT,
  extract_type text NOT NULL CHECK (extract_type IN ('quote','passage')),
  extract_text text NOT NULL,
  context_text text NOT NULL,
  location_ref text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'quotes_id_source_id_key'
  ) THEN
    ALTER TABLE public.quotes
      ADD CONSTRAINT quotes_id_source_id_key UNIQUE (id, source_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.evidence (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id bigint NOT NULL REFERENCES public.sources(id) ON DELETE RESTRICT,
  extract_id bigint,
  evidence_type text NOT NULL CHECK (evidence_type IN ('quote','passage','screenshot','note')),
  evidence_text text NOT NULL,
  context_text text NOT NULL,
  location_ref text NOT NULL,
  why_relevant text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'evidence'
      AND column_name = 'extract_id'
  ) THEN
    ALTER TABLE public.evidence ADD COLUMN extract_id bigint;
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE public.evidence DROP CONSTRAINT IF EXISTS evidence_extract_id_fkey;
  ALTER TABLE public.evidence DROP CONSTRAINT IF EXISTS evidence_extract_source_fkey;
  ALTER TABLE public.evidence
    ADD CONSTRAINT evidence_extract_source_fkey
    FOREIGN KEY (extract_id, source_id)
    REFERENCES public.quotes(id, source_id)
    ON DELETE RESTRICT;
END $$;

CREATE INDEX IF NOT EXISTS idx_search_rounds_project_id ON public.search_rounds(project_id);
CREATE INDEX IF NOT EXISTS idx_search_queries_round_id ON public.search_queries(round_id);
CREATE INDEX IF NOT EXISTS idx_sources_project_id ON public.sources(project_id);
CREATE INDEX IF NOT EXISTS idx_round_sources_round_id ON public.round_sources(round_id);
CREATE INDEX IF NOT EXISTS idx_round_sources_source_id ON public.round_sources(source_id);
CREATE INDEX IF NOT EXISTS idx_quotes_source_id ON public.quotes(source_id);
CREATE INDEX IF NOT EXISTS idx_evidence_source_id ON public.evidence(source_id);
CREATE INDEX IF NOT EXISTS idx_evidence_extract_id ON public.evidence(extract_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_updated_at_projects ON public.projects;
CREATE TRIGGER set_updated_at_projects
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_search_rounds ON public.search_rounds;
CREATE TRIGGER set_updated_at_search_rounds
BEFORE UPDATE ON public.search_rounds
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_search_queries ON public.search_queries;
CREATE TRIGGER set_updated_at_search_queries
BEFORE UPDATE ON public.search_queries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_sources ON public.sources;
CREATE TRIGGER set_updated_at_sources
BEFORE UPDATE ON public.sources
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_round_sources ON public.round_sources;
CREATE TRIGGER set_updated_at_round_sources
BEFORE UPDATE ON public.round_sources
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_quotes ON public.quotes;
CREATE TRIGGER set_updated_at_quotes
BEFORE UPDATE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_evidence ON public.evidence;
CREATE TRIGGER set_updated_at_evidence
BEFORE UPDATE ON public.evidence
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
