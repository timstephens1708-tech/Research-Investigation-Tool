-- Sources with NULL or empty/whitespace summary (should return 0 rows after cleanup)
SELECT id, project_id, url, summary
FROM public.sources
WHERE summary IS NULL
   OR length(btrim(summary)) = 0;
