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
  source_id bigint NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
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
  source_id bigint NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
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

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'evidence'
      AND column_name = 'context_text'
  ) THEN
    ALTER TABLE public.evidence ADD COLUMN context_text text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'evidence'
      AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.evidence ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'evidence'
      AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.evidence ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
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
    ON DELETE SET NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_quotes_source_id ON public.quotes(source_id);
CREATE INDEX IF NOT EXISTS idx_evidence_source_id ON public.evidence(source_id);
CREATE INDEX IF NOT EXISTS idx_evidence_extract_id ON public.evidence(extract_id);
