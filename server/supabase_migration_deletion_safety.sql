-- Deletion Safety & Audit Integrity Migration (AC-1.1)
-- Non-destructive: drops/recreates FK constraints only. Does NOT delete rows.

BEGIN;

-- 1) projects is structural: block hard delete if children exist
ALTER TABLE public.search_rounds
  DROP CONSTRAINT IF EXISTS search_rounds_project_id_fkey;
ALTER TABLE public.search_rounds
  ADD CONSTRAINT search_rounds_project_id_fkey
  FOREIGN KEY (project_id)
  REFERENCES public.projects(id)
  ON DELETE RESTRICT;

ALTER TABLE public.sources
  DROP CONSTRAINT IF EXISTS sources_project_id_fkey;
ALTER TABLE public.sources
  ADD CONSTRAINT sources_project_id_fkey
  FOREIGN KEY (project_id)
  REFERENCES public.projects(id)
  ON DELETE RESTRICT;

-- 2) search_rounds/search_queries are audit entities: never cascade delete silently
ALTER TABLE public.search_queries
  DROP CONSTRAINT IF EXISTS search_queries_round_id_fkey;
ALTER TABLE public.search_queries
  ADD CONSTRAINT search_queries_round_id_fkey
  FOREIGN KEY (round_id)
  REFERENCES public.search_rounds(id)
  ON DELETE RESTRICT;

-- 3) sources are audit entities: do not allow silent deletion of quotes/evidence
ALTER TABLE public.quotes
  DROP CONSTRAINT IF EXISTS quotes_source_id_fkey;
ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_source_id_fkey
  FOREIGN KEY (source_id)
  REFERENCES public.sources(id)
  ON DELETE RESTRICT;

ALTER TABLE public.evidence
  DROP CONSTRAINT IF EXISTS evidence_source_id_fkey;
ALTER TABLE public.evidence
  ADD CONSTRAINT evidence_source_id_fkey
  FOREIGN KEY (source_id)
  REFERENCES public.sources(id)
  ON DELETE RESTRICT;

-- 4) quotes -> evidence must not cascade delete evidence (block quote deletes if referenced)
ALTER TABLE public.evidence
  DROP CONSTRAINT IF EXISTS evidence_extract_source_fkey;
ALTER TABLE public.evidence
  ADD CONSTRAINT evidence_extract_source_fkey
  FOREIGN KEY (extract_id, source_id)
  REFERENCES public.quotes(id, source_id)
  ON DELETE RESTRICT;

-- 5) Link table may cascade-clean links if a parent is hard-deleted
ALTER TABLE public.round_sources
  DROP CONSTRAINT IF EXISTS round_sources_round_id_fkey;
ALTER TABLE public.round_sources
  ADD CONSTRAINT round_sources_round_id_fkey
  FOREIGN KEY (round_id)
  REFERENCES public.search_rounds(id)
  ON DELETE CASCADE;

ALTER TABLE public.round_sources
  DROP CONSTRAINT IF EXISTS round_sources_source_id_fkey;
ALTER TABLE public.round_sources
  ADD CONSTRAINT round_sources_source_id_fkey
  FOREIGN KEY (source_id)
  REFERENCES public.sources(id)
  ON DELETE CASCADE;

COMMIT;
