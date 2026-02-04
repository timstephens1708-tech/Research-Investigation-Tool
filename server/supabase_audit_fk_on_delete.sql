-- Lists foreign keys involving critical tables, including ON DELETE behavior
-- Tables in scope: projects, search_rounds, search_queries, sources, quotes, evidence, round_sources

SELECT
  con.conname                                   AS constraint_name,
  rel_t.relname                                 AS table_name,
  array_agg(att_t.attname ORDER BY u.ord)        AS columns,
  rel_r.relname                                 AS referenced_table,
  array_agg(att_r.attname ORDER BY u.ord)        AS referenced_columns,
  CASE con.confdeltype
    WHEN 'a' THEN 'NO ACTION'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'c' THEN 'CASCADE'
    WHEN 'n' THEN 'SET NULL'
    WHEN 'd' THEN 'SET DEFAULT'
    ELSE con.confdeltype::text
  END                                           AS on_delete
FROM pg_constraint con
JOIN pg_class rel_t ON rel_t.oid = con.conrelid
JOIN pg_namespace nsp_t ON nsp_t.oid = rel_t.relnamespace
JOIN pg_class rel_r ON rel_r.oid = con.confrelid
JOIN pg_namespace nsp_r ON nsp_r.oid = rel_r.relnamespace
JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS u(attnum_t, ord) ON TRUE
JOIN pg_attribute att_t ON att_t.attrelid = con.conrelid AND att_t.attnum = u.attnum_t
JOIN LATERAL unnest(con.confkey) WITH ORDINALITY AS v(attnum_r, ord) ON v.ord = u.ord
JOIN pg_attribute att_r ON att_r.attrelid = con.confrelid AND att_r.attnum = v.attnum_r
WHERE con.contype = 'f'
  AND nsp_t.nspname = 'public'
  AND nsp_r.nspname = 'public'
  AND (
    rel_t.relname IN ('projects','search_rounds','search_queries','sources','quotes','evidence','round_sources')
    OR rel_r.relname IN ('projects','search_rounds','search_queries','sources','quotes','evidence','round_sources')
  )
GROUP BY con.conname, rel_t.relname, rel_r.relname, con.confdeltype
ORDER BY table_name, constraint_name;
