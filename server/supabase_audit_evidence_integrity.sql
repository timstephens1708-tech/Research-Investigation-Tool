-- Evidence without a valid source (should be empty if FK exists)
SELECT e.*
FROM public.evidence e
LEFT JOIN public.sources s ON s.id = e.source_id
WHERE s.id IS NULL;

-- Evidence referencing a quote from a different source (violations)
SELECT e.id AS evidence_id,
       e.source_id AS evidence_source_id,
       e.extract_id,
       q.source_id AS quote_source_id
FROM public.evidence e
JOIN public.quotes q ON q.id = e.extract_id
WHERE e.extract_id IS NOT NULL
  AND q.source_id <> e.source_id;

-- Evidence traceability to project (should be empty)
SELECT e.id AS evidence_id
FROM public.evidence e
LEFT JOIN public.sources s ON s.id = e.source_id
LEFT JOIN public.projects p ON p.id = s.project_id
WHERE p.id IS NULL;
