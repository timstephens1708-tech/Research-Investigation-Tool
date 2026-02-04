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

-- Optional: once you've cleaned up any existing empty summaries, run:
-- ALTER TABLE public.sources VALIDATE CONSTRAINT sources_summary_nonempty;
